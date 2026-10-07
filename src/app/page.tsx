import { desc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  issues,
  issueRecommendations,
  developerEmbeddings,
  commits,
  pullRequests,
} from "@/lib/db/schema";
import { DashboardView, type DashboardStats } from "./DashboardView";

export const dynamic = "force-dynamic";

async function getDashboardStats(targetRepo?: string): Promise<DashboardStats> {
  try {
    if (targetRepo) {
      const [issueCount] = await db
        .select({ count: count() })
        .from(issues)
        .where(eq(issues.repoFullName, targetRepo));

      const recentIssues = await db
        .select({
          id: issues.id,
          number: issues.number,
          title: issues.title,
          state: issues.state,
          labels: issues.labels,
          repoFullName: issues.repoFullName,
          createdAt: issues.githubCreatedAt,
        })
        .from(issues)
        .where(eq(issues.repoFullName, targetRepo))
        .orderBy(desc(issues.githubCreatedAt))
        .limit(5);

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

      const repoIssues = await db
        .select({ id: issues.id })
        .from(issues)
        .where(eq(issues.repoFullName, targetRepo));
      const issueIds = new Set(repoIssues.map((i) => i.id));

      const allRecs = await db
        .select({ issueId: issueRecommendations.issueId })
        .from(issueRecommendations);
      let recCount = 0;
      for (const r of allRecs) {
        if (issueIds.has(r.issueId)) recCount++;
      }

      return {
        devCount: authorIds.size,
        issueCount: issueCount?.count ?? 0,
        embCount,
        recCount,
        recentIssues,
        dbConnected: true,
      };
    }

    const [devCount] = await db.select({ count: count() }).from(developers);
    const [issueCount] = await db.select({ count: count() }).from(issues);
    const [embCount] = await db.select({ count: count() }).from(developerEmbeddings);
    const [recCount] = await db.select({ count: count() }).from(issueRecommendations);

    const recentIssues = await db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
        state: issues.state,
        labels: issues.labels,
        repoFullName: issues.repoFullName,
        createdAt: issues.githubCreatedAt,
      })
      .from(issues)
      .orderBy(desc(issues.githubCreatedAt))
      .limit(5);

    return {
      devCount: devCount?.count ?? 0,
      issueCount: issueCount?.count ?? 0,
      embCount: embCount?.count ?? 0,
      recCount: recCount?.count ?? 0,
      recentIssues,
      dbConnected: true,
    };
  } catch (err) {
    console.warn("[DashboardPage] Database not connected:", err);
    return {
      devCount: 0,
      issueCount: 0,
      embCount: 0,
      recCount: 0,
      recentIssues: [],
      dbConnected: false,
    };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const resolvedParams = await searchParams;
  const targetRepo =
    resolvedParams.repo ||
    (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
      ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
      : undefined);

  const stats = await getDashboardStats(targetRepo);

  return <DashboardView initialStats={stats} initialRepo={targetRepo} />;
}
