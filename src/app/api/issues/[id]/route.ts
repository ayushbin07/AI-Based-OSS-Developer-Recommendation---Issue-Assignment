/**
 * GET  /api/issues/[id]  – fetch a single issue + its latest recommendations
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues, issueRecommendations } from "@/lib/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const issueId = parseInt(id, 10);

  if (isNaN(issueId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [recommendation] = await db
    .select()
    .from(issueRecommendations)
    .where(eq(issueRecommendations.issueId, issueId))
    .orderBy(issueRecommendations.createdAt)
    .limit(1);

  return Response.json({
    issue,
    recommendation: recommendation
      ? {
          id: recommendation.id,
          recommendations: JSON.parse(recommendation.recommendations),
          provider: recommendation.provider,
          confirmed: recommendation.confirmed,
          confirmedAt: recommendation.confirmedAt,
          assignedDeveloperId: recommendation.assignedDeveloperId,
          createdAt: recommendation.createdAt,
        }
      : null,
  });
}
