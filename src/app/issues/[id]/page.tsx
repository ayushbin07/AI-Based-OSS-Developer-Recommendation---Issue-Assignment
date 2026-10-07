import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues, issueRecommendations } from "@/lib/db/schema";
import { IssueDetailView, type RecommendationData } from "./IssueDetailView";

export const dynamic = "force-dynamic";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const issueId = parseInt(id, 10);

  if (isNaN(issueId)) {
    notFound();
  }

  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) {
    notFound();
  }

  const [recRecord] = await db
    .select()
    .from(issueRecommendations)
    .where(eq(issueRecommendations.issueId, issueId))
    .orderBy(desc(issueRecommendations.createdAt))
    .limit(1);

  let initialRecommendation: RecommendationData | null = null;
  if (recRecord) {
    try {
      initialRecommendation = {
        id: recRecord.id,
        recommendations: JSON.parse(recRecord.recommendations),
        provider: recRecord.provider,
        confirmed: recRecord.confirmed,
        confirmedAt: recRecord.confirmedAt,
        assignedDeveloperId: recRecord.assignedDeveloperId,
      };
    } catch (e) {
      console.error("[IssueDetailPage] Failed to parse recommendations JSON", e);
    }
  }

  const activeProvider = process.env.AI_PROVIDER ?? "ollama";

  return (
    <IssueDetailView
      issue={{
        id: issue.id,
        githubId: issue.githubId,
        repoFullName: issue.repoFullName,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels,
        assigneeLogin: issue.assigneeLogin,
        githubCreatedAt: issue.githubCreatedAt,
      }}
      initialRecommendation={initialRecommendation}
      activeProvider={activeProvider}
    />
  );
}
