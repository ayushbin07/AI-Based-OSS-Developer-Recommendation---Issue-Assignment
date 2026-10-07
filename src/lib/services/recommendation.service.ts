/**
 * Recommendation Engine
 *
 * Given a GitHub issue, produces a ranked list of developers STRICTLY from
 * the contributors of the issue's repository by combining:
 *   1. Special Keyword & Domain Match — LLM-analyzed matching of developer expertise keywords
 *      (HEAVY WEIGHTAGE: 45% when keywords are configured)
 *   2. Vector (semantic) similarity — issue embedding vs developer embedding (30%)
 *   3. Contribution signals — recency (15%), commit + PR volume (10%)
 *
 * Candidate developers are strictly constrained to contributors who have contributed
 * to this specific repository (no cross-repository leaks).
 *
 * Then uses the LLM to generate an explanation that explicitly mentions the
 * matching keyword expertise when applicable.
 */

import { sql, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  developerEmbeddings,
  issueRecommendations,
  repoContributors,
  commits,
  pullRequests,
  type Issue,
  type Developer,
} from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { getGitHubClient } from "@/lib/github/client";
import { upsertDeveloperEmbedding } from "./embedding.service";

export interface RecommendedDeveloper {
  developerId: number;
  login: string;
  avatarUrl: string | null;
  score: number;          // 0-100 percentage
  vectorScore: number;
  recencyScore: number;
  volumeScore: number;
  keywordScore?: number;
  specialKeywords?: string | null;
  keywordMatch?: string | null;
  reason: string;         // LLM-generated explanation (top dev only)
}

const TOP_K = 5;

// -------------------------------------------------------------------------
// Main entry point
// -------------------------------------------------------------------------
export async function recommendForIssue(
  issue: Issue,
  topK = TOP_K
): Promise<RecommendedDeveloper[]> {
  const ai = getAIProvider();

  // 1. Identify valid candidate developers STRICTLY for this repository
  let candidateDevIds = await getRepoContributorIds(issue.repoFullName);

  if (candidateDevIds.length === 0) {
    console.warn(`[recommendation] No contributors found for repo ${issue.repoFullName}`);
    return [];
  }

  // 2. Ensure all candidate developers have embeddings generated
  await ensureCandidateEmbeddings(candidateDevIds);

  // 3. Build issue text and generate embedding
  const issueText = buildIssueText(issue);
  const { embedding: issueEmbedding } = await ai.embed(issueText);
  const embeddingLiteral = `[${issueEmbedding.join(",")}]`;

  // 4. Query candidate developers with cosine vector similarity
  interface CandidateDbRow {
    developer_id: number;
    login: string;
    avatar_url: string | null;
    special_keywords: string | null;
    repo_commits: number;
    total_commits: number;
    total_prs: number;
    last_updated: string;
    vector_score: number;
  }

  const candidateIdList = candidateDevIds.map((id) => sql`${id}`);

  const queryResult = await db.execute(sql`
    SELECT
      d.id                                                AS developer_id,
      d.login,
      d.avatar_url,
      d.special_keywords,
      COALESCE(rc.contributions_count, d.total_commits)  AS repo_commits,
      d.total_commits,
      d.total_prs,
      COALESCE(de.updated_at, d.updated_at)               AS last_updated,
      CASE
        WHEN de.embedding IS NOT NULL THEN (1 - (de.embedding <=> ${embeddingLiteral}::vector))
        ELSE 0.5
      END                                                 AS vector_score
    FROM developers d
    LEFT JOIN developer_embeddings de ON d.id = de.developer_id
    LEFT JOIN repo_contributors rc ON rc.developer_id = d.id AND rc.repo_full_name = ${issue.repoFullName}
    WHERE d.id IN (${sql.join(candidateIdList, sql`, `)})
  `);

  const candidates = Array.from(queryResult) as unknown as CandidateDbRow[];

  if (candidates.length === 0) {
    return [];
  }

  // 5. Evaluate Special Keyword matches for candidates
  const keywordMatches = await evaluateKeywordMatches(issue, candidates);

  // 6. Normalise volume score across the candidates
  const maxCommits = Math.max(...candidates.map((r) => r.repo_commits || r.total_commits), 1);
  const maxPRs = Math.max(...candidates.map((r) => r.total_prs), 1);

  const now = Date.now();
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  // Check if any candidate has special keywords configured
  const hasConfiguredKeywords = candidates.some(
    (c) => c.special_keywords && c.special_keywords.trim().length > 0
  );

  // When special keywords are present, assign HEAVY WEIGHTAGE (45%)
  const weights = hasConfiguredKeywords
    ? { keyword: 0.45, vector: 0.30, recency: 0.15, volume: 0.10 }
    : { keyword: 0.00, vector: 0.60, recency: 0.25, volume: 0.15 };

  // 7. Compute final composite scores
  const scored: RecommendedDeveloper[] = candidates.map((row) => {
    const vectorScore = Math.max(0, Math.min(1, row.vector_score));

    // Recency: how recently they contributed or updated
    const ageMs = now - new Date(row.last_updated).getTime();
    const recencyScore = Math.max(0, 1 - ageMs / ONE_YEAR_MS);

    // Volume: commit + PR count
    const effectiveCommits = row.repo_commits || row.total_commits;
    const volumeScore =
      0.6 * (effectiveCommits / maxCommits) +
      0.4 * (row.total_prs / maxPRs);

    const km = keywordMatches.get(row.developer_id);
    const keywordNormalized = km ? km.score / 100 : 0;

    const finalScore =
      weights.keyword * keywordNormalized +
      weights.vector * vectorScore +
      weights.recency * recencyScore +
      weights.volume * volumeScore;

    return {
      developerId: row.developer_id,
      login: row.login,
      avatarUrl: row.avatar_url,
      specialKeywords: row.special_keywords,
      score: Math.round(finalScore * 100),
      vectorScore: Math.round(vectorScore * 100),
      recencyScore: Math.round(recencyScore * 100),
      volumeScore: Math.round(volumeScore * 100),
      keywordScore: km ? Math.round(km.score) : 0,
      keywordMatch: km?.matchedKeyword ?? null,
      reason: "",
    };
  });

  // 8. Sort strictly by final score descending
  const topDevelopers = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // 9. Generate LLM explanation for the top developer
  if (topDevelopers.length > 0) {
    topDevelopers[0].reason = await generateExplanation(
      issue,
      topDevelopers[0]
    );
  }

  return topDevelopers;
}

// -------------------------------------------------------------------------
// Strict Contributor Lookup
// -------------------------------------------------------------------------
async function getRepoContributorIds(repoFullName: string): Promise<number[]> {
  const contribRows = await db.execute(sql`
    SELECT DISTINCT developer_id FROM (
      SELECT developer_id FROM repo_contributors WHERE repo_full_name = ${repoFullName}
      UNION
      SELECT author_id AS developer_id FROM commits WHERE repo_full_name = ${repoFullName} AND author_id IS NOT NULL
      UNION
      SELECT author_id AS developer_id FROM pull_requests WHERE repo_full_name = ${repoFullName} AND author_id IS NOT NULL
    ) sub
  `);

  let ids = Array.from(contribRows)
    .map((r: any) => Number(r.developer_id))
    .filter((id) => !isNaN(id) && id > 0);

  // If no contributors recorded in DB yet, dynamically fetch from GitHub
  if (ids.length === 0) {
    try {
      const [owner, name] = repoFullName.split("/");
      if (owner && name) {
        const github = getGitHubClient();
        const ghContributors = await github.getContributors(owner, name);
        for (const c of ghContributors) {
          const [dev] = await db
            .insert(developers)
            .values({
              githubId: c.githubId,
              login: c.login,
              avatarUrl: c.avatarUrl,
              profileUrl: c.profileUrl,
              totalCommits: c.totalCommits,
            })
            .onConflictDoUpdate({
              target: developers.githubId,
              set: {
                login: c.login,
                avatarUrl: c.avatarUrl,
                profileUrl: c.profileUrl,
                totalCommits: c.totalCommits,
              },
            })
            .returning({ id: developers.id });

          if (dev?.id) {
            ids.push(dev.id);
            await db
              .insert(repoContributors)
              .values({
                repoFullName,
                developerId: dev.id,
                contributionsCount: c.totalCommits,
              })
              .onConflictDoNothing();
          }
        }
      }
    } catch (err) {
      console.warn(`[recommendation] Could not fetch contributors from GitHub for ${repoFullName}:`, err);
    }
  }

  return [...new Set(ids)];
}

// -------------------------------------------------------------------------
// Ensure Candidate Embeddings
// -------------------------------------------------------------------------
async function ensureCandidateEmbeddings(candidateDevIds: number[]): Promise<void> {
  const candidateIdList = candidateDevIds.map((id) => sql`${id}`);
  const dbDevs = await db
    .select()
    .from(developers)
    .where(sql`${developers.id} IN (${sql.join(candidateIdList, sql`, `)})`);

  for (const dev of dbDevs) {
    const [existing] = await db
      .select({ id: developerEmbeddings.id })
      .from(developerEmbeddings)
      .where(eq(developerEmbeddings.developerId, dev.id))
      .limit(1);

    if (!existing) {
      try {
        await upsertDeveloperEmbedding(dev as Developer);
      } catch (err) {
        console.warn(`[recommendation] Failed to auto-embed developer ${dev.login}:`, err);
      }
    }
  }
}

// -------------------------------------------------------------------------
// Evaluate Special Keyword Relevance
// -------------------------------------------------------------------------
interface KeywordMatchResult {
  score: number;           // 0 - 100
  matchedKeyword: string | null;
  reason: string;
}

async function evaluateKeywordMatches(
  issue: Issue,
  candidates: Array<{ developer_id: number; login: string; special_keywords: string | null }>
): Promise<Map<number, KeywordMatchResult>> {
  const results = new Map<number, KeywordMatchResult>();

  // Filter candidates who have keywords
  const candidatesWithKeywords = candidates.filter(
    (c) => c.special_keywords && c.special_keywords.trim().length > 0
  );

  if (candidatesWithKeywords.length === 0) {
    return results;
  }

  const ai = getAIProvider();
  const issueText = `Title: "${issue.title}"\nDescription: "${(issue.body ?? "").slice(0, 500)}"\nLabels: ${(issue.labels || []).join(", ")}`;

  const prompt = `You are evaluating developer assignments for a GitHub issue.
Analyze the issue and score how well each candidate developer's designated special expertise keyword matches what this issue requires.

Issue Details:
${issueText}

Candidate Developers and their Special Keywords:
${candidatesWithKeywords.map((c) => `- ID ${c.developer_id} (@${c.login}): "${c.special_keywords}"`).join("\n")}

Instructions:
1. Identify what domain/technology the issue is about (e.g., frontend, UI/UX, backend, database, auth, API, devops, etc.).
2. Evaluate each developer's special keyword:
   - 90-100: Exact domain match (e.g., keyword 'frontend expert' or 'UI' for a hero section redesign; 'backend expert' for an API/database issue).
   - 60-89: Strong partial or related match.
   - 20-50: Slight relevance.
   - 0: Unrelated domain (e.g. backend expert for pure CSS styling, or frontend expert for database optimization).
3. Return ONLY a valid JSON array matching this format:
[
  { "developerId": <number>, "score": <number>, "matchedKeyword": "<string or null>", "reason": "<short explanation>" }
]`;

  try {
    const completion = await ai.complete([{ role: "user", content: prompt }], {
      temperature: 0.1,
      maxTokens: 400,
    });

    const cleanJson = completion.text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.developerId) {
          results.set(Number(item.developerId), {
            score: Math.max(0, Math.min(100, Number(item.score) || 0)),
            matchedKeyword: item.matchedKeyword || null,
            reason: item.reason || "",
          });
        }
      }
    }
  } catch (err) {
    console.warn("[recommendation] LLM keyword evaluation fallback to heuristic:", err);
  }

  // Ensure every candidate with keywords has at least heuristic scoring
  for (const c of candidatesWithKeywords) {
    if (!results.has(c.developer_id)) {
      const heuristic = computeHeuristicKeywordScore(issue, c.special_keywords || "");
      results.set(c.developer_id, heuristic);
    }
  }

  return results;
}

/**
 * Robust heuristic keyword matcher (works even if LLM is offline)
 */
function computeHeuristicKeywordScore(
  issue: Issue,
  keywordsStr: string
): KeywordMatchResult {
  const text = `${issue.title} ${issue.body || ""} ${(issue.labels || []).join(" ")}`.toLowerCase();
  const keywords = keywordsStr.toLowerCase().split(/[,;|]+/).map((k) => k.trim()).filter(Boolean);

  const DOMAINS: Record<string, string[]> = {
    frontend: ["frontend", "ui", "ux", "redesign", "hero", "css", "html", "react", "component", "style", "page", "button", "layout", "view", "navbar"],
    backend: ["backend", "api", "database", "postgres", "sql", "server", "controller", "route", "query", "endpoint", "auth", "token", "jwt", "model"],
    devops: ["devops", "docker", "ci", "cd", "deploy", "pipeline", "kubernetes", "aws", "action"],
    database: ["database", "db", "postgres", "sql", "mongo", "prisma", "drizzle", "migration", "schema"],
    security: ["security", "auth", "login", "password", "vulnerability", "encryption", "oauth"],
  };

  let bestScore = 0;
  let matchedKeyword: string | null = null;

  for (const kw of keywords) {
    // 1. Direct word inclusion
    if (text.includes(kw)) {
      bestScore = Math.max(bestScore, 95);
      matchedKeyword = kw;
      continue;
    }

    // 2. Domain synonym overlap
    for (const [domain, synonyms] of Object.entries(DOMAINS)) {
      const kwMatchesDomain = kw.includes(domain) || synonyms.some((s) => kw.includes(s));
      if (kwMatchesDomain) {
        const issueMatchesDomain = synonyms.some((s) => text.includes(s));
        if (issueMatchesDomain) {
          bestScore = Math.max(bestScore, 90);
          matchedKeyword = kw;
          break;
        }
      }
    }
  }

  return {
    score: bestScore,
    matchedKeyword,
    reason: matchedKeyword
      ? `Special keyword '${matchedKeyword}' strongly matches domain of this issue.`
      : "Keywords evaluated against issue context.",
  };
}

// -------------------------------------------------------------------------
// Persist recommendations and return the stored record id
// -------------------------------------------------------------------------
export async function persistRecommendations(
  issueId: number,
  recommendations: RecommendedDeveloper[]
): Promise<number> {
  const ai = getAIProvider();

  const [record] = await db
    .insert(issueRecommendations)
    .values({
      issueId,
      recommendations: JSON.stringify(recommendations),
      provider: ai.name,
    })
    .onConflictDoNothing()
    .returning({ id: issueRecommendations.id });

  return record?.id ?? -1;
}

// -------------------------------------------------------------------------
// LLM explanation for the top recommended developer
// -------------------------------------------------------------------------
async function generateExplanation(
  issue: Issue,
  dev: RecommendedDeveloper
): Promise<string> {
  const ai = getAIProvider();

  const prompt = `You are assigning a GitHub issue to the best developer strictly among contributors of repository "${issue.repoFullName}".

Issue: #${issue.number} - "${issue.title}"
Description: "${(issue.body ?? "").slice(0, 400)}"
Labels: ${issue.labels?.join(", ") || "none"}

Top candidate: @${dev.login}
Special Keyword: "${dev.specialKeywords || "None"}"
Keyword Match Score: ${dev.keywordScore || 0}% ${dev.keywordMatch ? `(matched: "${dev.keywordMatch}")` : ""}
Semantic Vector Score: ${dev.vectorScore}%
Activity Recency Score: ${dev.recencyScore}%
Contribution Volume Score: ${dev.volumeScore}%

Write a single concise sentence (max 35 words) explaining why @${dev.login} is the top match for this issue.
CRITICAL INSTRUCTION: If @${dev.login} has a special keyword that matches this issue (e.g. "${dev.specialKeywords}"), you MUST explicitly explain that their keyword expertise directly matches this issue.`;

  try {
    const result = await ai.complete([{ role: "user", content: prompt }], {
      maxTokens: 90,
      temperature: 0.3,
    });
    return result.text.trim();
  } catch {
    if (dev.keywordMatch || (dev.keywordScore && dev.keywordScore >= 70)) {
      return `@${dev.login} is the top match because their special keyword "${dev.specialKeywords}" directly aligns with this issue, combined with their active contributions in this repository.`;
    }
    return `@${dev.login} is recommended based on strong semantic similarity (${dev.vectorScore}%) and contribution history in this repository.`;
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------
function buildIssueText(issue: Issue): string {
  const parts = [
    `Title: ${issue.title}`,
    issue.labels && issue.labels.length > 0 ? `Labels: ${issue.labels.join(", ")}` : "",
    issue.body ? `Description: ${issue.body.slice(0, 1500)}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}
