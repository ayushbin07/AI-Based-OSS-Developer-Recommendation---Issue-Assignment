import { Suspense } from "react";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  issues,
  pullRequests,
  commits,
  developerEmbeddings,
} from "@/lib/db/schema";
import { SyncView } from "./SyncView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sync Data | AI Dev Recommender",
  description: "Synchronize GitHub contributors, issues, PRs, and generate developer vector embeddings.",
};

async function getSyncStats(targetRepo?: string) {
  try {
    if (targetRepo) {
      const [issueCount] = await db
        .select({ count: count() })
        .from(issues)
        .where(eq(issues.repoFullName, targetRepo));

      const [prCount] = await db
        .select({ count: count() })
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, targetRepo));

      const [commitCount] = await db
        .select({ count: count() })
        .from(commits)
        .where(eq(commits.repoFullName, targetRepo));

      const repoCommits = await db
        .select({ authorId: commits.authorId })
        .from(commits)
        .where(eq(commits.repoFullName, targetRepo));

      const repoPRs = await db
        .select({ authorId: pullRequests.authorId })
        .from(pullRequests)
        .where(eq(pullRequests.repoFullName, targetRepo));

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

      return {
        devCount: authorIds.size,
        issueCount: issueCount?.count ?? 0,
        prCount: prCount?.count ?? 0,
        commitCount: commitCount?.count ?? 0,
        embCount,
      };
    }

    const [devCount] = await db.select({ count: count() }).from(developers);
    const [issueCount] = await db.select({ count: count() }).from(issues);
    const [prCount] = await db.select({ count: count() }).from(pullRequests);
    const [commitCount] = await db.select({ count: count() }).from(commits);
    const [embCount] = await db.select({ count: count() }).from(developerEmbeddings);

    return {
      devCount: devCount?.count ?? 0,
      issueCount: issueCount?.count ?? 0,
      prCount: prCount?.count ?? 0,
      commitCount: commitCount?.count ?? 0,
      embCount: embCount?.count ?? 0,
    };
  } catch (err) {
    console.warn("[SyncPage] Database query warning:", err);
    return {
      devCount: 0,
      issueCount: 0,
      prCount: 0,
      commitCount: 0,
      embCount: 0,
    };
  }
}

export default async function SyncPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const resolvedParams = await searchParams;

  const defaultOwner = process.env.GITHUB_REPO_OWNER ?? "ayushbin07";
  const defaultName = process.env.GITHUB_REPO_NAME ?? "Samaj";
  const defaultFullName = `${defaultOwner}/${defaultName}`;

  const targetRepo = resolvedParams.repo || defaultFullName;
  const [repoOwner, repoName] = targetRepo.includes("/")
    ? targetRepo.split("/")
    : [defaultOwner, targetRepo];

  const initialStats = await getSyncStats(targetRepo);
  const provider = process.env.AI_PROVIDER ?? "ollama";

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Synchronization</h1>
          <p className="page-sub">
            Collect repository history from GitHub and calculate vector embeddings for contributor matching.
          </p>
        </div>
      </div>

      <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading synchronization panel...</div>}>
        <SyncView
          repoOwner={repoOwner}
          repoName={repoName}
          provider={provider}
          initialStats={initialStats}
        />
      </Suspense>
    </>
  );
}
