/**
 * Embedding Service
 *
 * Builds a human-readable summary text for each developer from their
 * historical contributions, then generates and upserts an embedding into
 * the developer_embeddings table.
 *
 * The summary text is designed to capture:
 *   - Languages / file types the developer works on
 *   - Commit messages (intent + domain)
 *   - PR titles and descriptions
 *   - Issue areas they resolved
 */

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  developerEmbeddings,
  commits,
  pullRequests,
  changedFiles,
  issues,
  type Developer,
} from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";

// Maximum characters in the summary text sent to the embedding model
const MAX_SUMMARY_CHARS = 4000;

// -------------------------------------------------------------------------
// Build summary text for one developer
// -------------------------------------------------------------------------
export async function buildDeveloperSummary(developer: Developer): Promise<string> {
  // Recent commits (messages + file paths)
  const recentCommits = await db
    .select({
      message: commits.message,
      committedAt: commits.committedAt,
    })
    .from(commits)
    .where(eq(commits.authorId, developer.id))
    .orderBy(desc(commits.committedAt))
    .limit(50);

  // Changed files across all their commits
  const touchedFiles = await db
    .select({ filePath: changedFiles.filePath })
    .from(changedFiles)
    .innerJoin(commits, eq(changedFiles.commitId, commits.id))
    .where(eq(commits.authorId, developer.id))
    .limit(200);

  // PR titles they authored
  const authoredPRs = await db
    .select({ title: pullRequests.title, body: pullRequests.body })
    .from(pullRequests)
    .where(eq(pullRequests.authorId, developer.id))
    .orderBy(desc(pullRequests.githubCreatedAt))
    .limit(30);

  // Build the text
  const lines: string[] = [
    `Developer: ${developer.login}`,
    developer.specialKeywords ? `Special Expertise & Keywords: ${developer.specialKeywords}` : "",
    `Total commits: ${developer.totalCommits}`,
    `Total PRs: ${developer.totalPrs}`,
    "",
  ].filter(Boolean);


  if (recentCommits.length > 0) {
    lines.push("Recent commit messages:");
    recentCommits.forEach((c) => lines.push(`- ${c.message.split("\n")[0]}`));
    lines.push("");
  }

  if (authoredPRs.length > 0) {
    lines.push("Pull requests authored:");
    authoredPRs.forEach((pr) => {
      lines.push(`- ${pr.title}`);
      if (pr.body) {
        const excerpt = pr.body.split("\n")[0].slice(0, 120);
        if (excerpt) lines.push(`  ${excerpt}`);
      }
    });
    lines.push("");
  }

  if (touchedFiles.length > 0) {
    // Unique file paths — gives signal about which parts of the codebase
    const unique = [...new Set(touchedFiles.map((f) => f.filePath))];
    lines.push("Files touched:");
    unique.slice(0, 100).forEach((f) => lines.push(`- ${f}`));
  }

  const summary = lines.join("\n");
  // Truncate to avoid hitting embedding model token limits
  return summary.length > MAX_SUMMARY_CHARS
    ? summary.slice(0, MAX_SUMMARY_CHARS)
    : summary;
}

// -------------------------------------------------------------------------
// Generate and upsert embedding for one developer
// -------------------------------------------------------------------------
export async function upsertDeveloperEmbedding(
  developer: Developer
): Promise<void> {
  const ai = getAIProvider();
  const summaryText = await buildDeveloperSummary(developer);

  const { embedding } = await ai.embed(summaryText);

  const modelName =
    ai.name === "google"
      ? (process.env.GOOGLE_EMBED_MODEL ?? "gemini-embedding-001")
      : (process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text");

  await db
    .insert(developerEmbeddings)
    .values({
      developerId: developer.id,
      sourceText: summaryText,
      embedding,
      provider: ai.name,
      model: modelName,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: developerEmbeddings.developerId,
      set: {
        sourceText: summaryText,
        embedding,
        provider: ai.name,
        model: modelName,
        updatedAt: new Date(),
      },
    });

  console.log(`[embedding] Upserted embedding for ${developer.login}`);
}

// -------------------------------------------------------------------------
// Batch: regenerate embeddings for all developers
// -------------------------------------------------------------------------
export async function upsertAllEmbeddings(): Promise<{
  updated: number;
  errors: string[];
}> {
  const allDevs = await db.select().from(developers);
  let updated = 0;
  const errors: string[] = [];

  for (const dev of allDevs) {
    try {
      await upsertDeveloperEmbedding(dev);
      updated++;
    } catch (err) {
      errors.push(`${dev.login}: ${String(err)}`);
    }
  }

  console.log(`[embedding] Done. Updated=${updated} Errors=${errors.length}`);
  return { updated, errors };
}
