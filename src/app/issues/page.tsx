import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues, issueRecommendations } from "@/lib/db/schema";
import { IssuesList, type IssueItem } from "./IssuesList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Issues | AI Dev Recommender",
  description: "Browse GitHub issues and view AI developer recommendations.",
};

async function getIssuesData(targetRepo?: string): Promise<IssueItem[]> {
  try {
    const baseQuery = db
      .select({
        id: issues.id,
        number: issues.number,
        repoFullName: issues.repoFullName,
        title: issues.title,
        body: issues.body,
        state: issues.state,
        labels: issues.labels,
        assigneeLogin: issues.assigneeLogin,
        githubCreatedAt: issues.githubCreatedAt,
      })
      .from(issues);

    const allIssues = targetRepo
      ? await baseQuery
          .where(eq(issues.repoFullName, targetRepo))
          .orderBy(desc(issues.githubCreatedAt))
      : await baseQuery.orderBy(desc(issues.githubCreatedAt));

    const allRecs = await db
      .select({
        issueId: issueRecommendations.issueId,
        confirmed: issueRecommendations.confirmed,
      })
      .from(issueRecommendations);

    const recMap = new Map<number, { hasRec: boolean; confirmed: boolean }>();
    for (const r of allRecs) {
      const existing = recMap.get(r.issueId);
      if (!existing || (!existing.confirmed && r.confirmed)) {
        recMap.set(r.issueId, { hasRec: true, confirmed: r.confirmed });
      }
    }

    return allIssues.map((issue) => {
      const rec = recMap.get(issue.id);
      return {
        id: issue.id,
        number: issue.number,
        repoFullName: issue.repoFullName,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels,
        assigneeLogin: issue.assigneeLogin,
        githubCreatedAt: issue.githubCreatedAt,
        hasRecommendation: rec?.hasRec ?? false,
        recommendationConfirmed: rec?.confirmed ?? false,
      };
    });
  } catch (err) {
    console.warn("[IssuesPage] Database query warning:", err);
    return [];
  }
}

export default async function IssuesPage({
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

  const issuesData = await getIssuesData(targetRepo);

  return <IssuesList initialIssues={issuesData} initialRepo={targetRepo} />;
}
