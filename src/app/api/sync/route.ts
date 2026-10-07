/**
 * POST /api/sync
 *
 * Admin endpoint to trigger a full GitHub data sync + embedding refresh.
 * Protected by SYNC_SECRET env var in production.
 *
 * Body (optional): { secret: string }
 */

import { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  issues,
  pullRequests,
  commits,
  developerEmbeddings,
} from "@/lib/db/schema";
import { collectRepositoryData } from "@/lib/services/collector.service";
import { upsertAllEmbeddings } from "@/lib/services/embedding.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const repoFullName = searchParams.get("repo");

    if (repoFullName) {
      const [issueCount] = await db
        .select({ count: count() })
        .from(issues)
        .where(eq(issues.repoFullName, repoFullName));

      const [prCount] = await db
        .select({ count: count() })
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, repoFullName));

      const [commitCount] = await db
        .select({ count: count() })
        .from(commits)
        .where(eq(commits.repoFullName, repoFullName));

      // Get developers who have commits or PRs in this repo
      const repoCommits = await db
        .select({ authorId: commits.authorId })
        .from(commits)
        .where(eq(commits.repoFullName, repoFullName));

      const repoPRs = await db
        .select({ authorId: pullRequests.authorId })
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, repoFullName));

      const authorIds = new Set<number>();
      for (const c of repoCommits) if (c.authorId) authorIds.add(c.authorId);
      for (const p of repoPRs) if (p.authorId) authorIds.add(p.authorId);

      const allEmbeddings = await db
        .select({ developerId: developerEmbeddings.developerId })
        .from(developerEmbeddings);
      const embeddedDevIds = new Set(allEmbeddings.map((e) => e.developerId));
      let embCount = 0;
      for (const id of authorIds) {
        if (embeddedDevIds.has(id)) embCount++;
      }

      return Response.json({
        devCount: authorIds.size,
        issueCount: issueCount?.count ?? 0,
        prCount: prCount?.count ?? 0,
        commitCount: commitCount?.count ?? 0,
        embCount,
      });
    }

    const [devCount] = await db.select({ count: count() }).from(developers);
    const [issueCount] = await db.select({ count: count() }).from(issues);
    const [prCount] = await db.select({ count: count() }).from(pullRequests);
    const [commitCount] = await db.select({ count: count() }).from(commits);
    const [embCount] = await db.select({ count: count() }).from(developerEmbeddings);

    return Response.json({
      devCount: devCount?.count ?? 0,
      issueCount: issueCount?.count ?? 0,
      prCount: prCount?.count ?? 0,
      commitCount: commitCount?.count ?? 0,
      embCount: embCount?.count ?? 0,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch stats", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Simple secret-based auth
  const syncSecret = process.env.SYNC_SECRET;
  let body: { secret?: string; repo?: string; repoOwner?: string; repoName?: string } = {};
  try {
    body = await req.json();
  } catch {}

  if (syncSecret && body.secret !== syncSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let owner: string | undefined = body.repoOwner;
  let repo: string | undefined = body.repoName;

  if (body.repo && body.repo.includes("/")) {
    const parts = body.repo.split("/");
    owner = parts[0];
    repo = parts[1];
  }

  try {
    console.log(`[sync] Starting GitHub data collection for ${owner ?? "default"}/${repo ?? "default"}...`);
    const collectionResult = await collectRepositoryData(owner, repo);

    console.log("[sync] Starting embedding refresh...");
    const embeddingResult = await upsertAllEmbeddings();

    const targetRepoFullName = owner && repo ? `${owner}/${repo}` : null;

    let devCountNum = 0;
    let issueCountNum = 0;
    let prCountNum = 0;
    let commitCountNum = 0;
    let embCountNum = 0;

    if (targetRepoFullName) {
      const [issueCount] = await db
        .select({ count: count() })
        .from(issues)
        .where(eq(issues.repoFullName, targetRepoFullName));

      const [prCount] = await db
        .select({ count: count() })
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, targetRepoFullName));

      const [commitCount] = await db
        .select({ count: count() })
        .from(commits)
        .where(eq(commits.repoFullName, targetRepoFullName));

      const repoCommits = await db
        .select({ authorId: commits.authorId })
        .from(commits)
        .where(eq(commits.repoFullName, targetRepoFullName));

      const repoPRs = await db
        .select({ authorId: pullRequests.authorId })
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, targetRepoFullName));

      const authorIds = new Set<number>();
      for (const c of repoCommits) if (c.authorId) authorIds.add(c.authorId);
      for (const p of repoPRs) if (p.authorId) authorIds.add(p.authorId);

      const allEmbeddings = await db
        .select({ developerId: developerEmbeddings.developerId })
        .from(developerEmbeddings);
      const embeddedDevIds = new Set(allEmbeddings.map((e) => e.developerId));
      for (const id of authorIds) {
        if (embeddedDevIds.has(id)) embCountNum++;
      }

      devCountNum = authorIds.size;
      issueCountNum = issueCount?.count ?? 0;
      prCountNum = prCount?.count ?? 0;
      commitCountNum = commitCount?.count ?? 0;
    } else {
      const [devCount] = await db.select({ count: count() }).from(developers);
      const [issueCount] = await db.select({ count: count() }).from(issues);
      const [prCount] = await db.select({ count: count() }).from(pullRequests);
      const [commitCount] = await db.select({ count: count() }).from(commits);
      const [embCount] = await db.select({ count: count() }).from(developerEmbeddings);

      devCountNum = devCount?.count ?? 0;
      issueCountNum = issueCount?.count ?? 0;
      prCountNum = prCount?.count ?? 0;
      commitCountNum = commitCount?.count ?? 0;
      embCountNum = embCount?.count ?? 0;
    }

    return Response.json({
      ok: true,
      collection: collectionResult,
      embeddings: embeddingResult,
      stats: {
        devCount: devCountNum,
        issueCount: issueCountNum,
        prCount: prCountNum,
        commitCount: commitCountNum,
        embCount: embCountNum,
      },
    });
  } catch (err) {
    console.error("[sync] Failed:", err);
    return Response.json(
      { error: "Sync failed", detail: String(err) },
      { status: 500 }
    );
  }
}
