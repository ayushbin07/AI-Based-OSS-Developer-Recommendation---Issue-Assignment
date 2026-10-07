/**
 * POST /api/issues/[id]/recommend
 *
 * (Re)runs the recommendation pipeline for a specific issue.
 * Useful for manual triggering from the UI or admin panel.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues } from "@/lib/db/schema";
import {
  recommendForIssue,
  persistRecommendations,
} from "@/lib/services/recommendation.service";

export async function POST(
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
    return Response.json({ error: "Issue not found" }, { status: 404 });
  }

  try {
    const recommendations = await recommendForIssue(issue);

    if (recommendations.length === 0) {
      return Response.json(
        { error: "No developer embeddings found. Run a data sync first." },
        { status: 422 }
      );
    }

    const recId = await persistRecommendations(issueId, recommendations);

    return Response.json({ recommendationId: recId, recommendations });
  } catch (err) {
    console.error("[api/recommend]", err);
    return Response.json(
      { error: "Recommendation failed", detail: String(err) },
      { status: 500 }
    );
  }
}
