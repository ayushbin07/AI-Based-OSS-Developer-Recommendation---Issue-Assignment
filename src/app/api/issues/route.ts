/**
 * GET  /api/issues            – list issues with recommendation status
 * GET  /api/issues/[id]       – get issue + recommendations
 * POST /api/issues/[id]/recommend – (re)run recommendation for an issue
 */

import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues, issueRecommendations } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repoFullName = searchParams.get("repo");

  const query = db
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

  const allIssues = repoFullName
    ? await query.where(eq(issues.repoFullName, repoFullName)).orderBy(desc(issues.githubCreatedAt)).limit(200)
    : await query.orderBy(desc(issues.githubCreatedAt)).limit(200);

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

  const enriched = allIssues.map((issue) => {
    const rec = recMap.get(issue.id);
    return {
      ...issue,
      hasRecommendation: rec?.hasRec ?? false,
      recommendationConfirmed: rec?.confirmed ?? false,
    };
  });

  return Response.json({ issues: enriched });
}
