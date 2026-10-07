/**
 * POST /api/webhooks/github
 *
 * Receives GitHub webhook events.
 * Verifies HMAC-SHA256 signature, then triggers the recommendation
 * pipeline when a new issue is opened.
 *
 * Setup in GitHub: Settings → Webhooks → Add webhook
 *   Payload URL: https://your-app.vercel.app/api/webhooks/github
 *   Content type: application/json
 *   Secret: value of GITHUB_WEBHOOK_SECRET
 *   Events: Issues
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues } from "@/lib/db/schema";
import { recommendForIssue, persistRecommendations } from "@/lib/services/recommendation.service";

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify GitHub HMAC signature
  const signature = req.headers.get("x-hub-signature-256");
  if (!verifySignature(body, signature)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  if (event !== "issues") {
    // Acknowledge non-issue events without processing
    return Response.json({ ok: true, event });
  }

  let payload: GitHubIssueEvent;
  try {
    payload = JSON.parse(body) as GitHubIssueEvent;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only trigger on opened issues
  if (payload.action !== "opened") {
    return Response.json({ ok: true, action: payload.action });
  }

  const ghIssue = payload.issue;
  const repoFullName = payload.repository.full_name;

  // Upsert the issue into the DB
  const [dbIssue] = await db
    .insert(issues)
    .values({
      githubId: ghIssue.id,
      repoFullName,
      number: ghIssue.number,
      title: ghIssue.title,
      body: ghIssue.body ?? null,
      state: "open",
      labels: ghIssue.labels.map((l: { name: string }) => l.name),
      githubCreatedAt: new Date(ghIssue.created_at),
    })
    .onConflictDoUpdate({
      target: [issues.repoFullName, issues.number],
      set: {
        title: ghIssue.title,
        body: ghIssue.body ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!dbIssue) {
    return Response.json({ error: "DB upsert failed" }, { status: 500 });
  }

  // Run recommendation pipeline in background (don't block the webhook response)
  void runRecommendationPipeline(dbIssue.id);

  return Response.json({ ok: true, issueId: dbIssue.id });
}

async function runRecommendationPipeline(issueId: number) {
  try {
    const [issue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1);

    if (!issue) return;

    const recommendations = await recommendForIssue(issue);
    await persistRecommendations(issueId, recommendations);
    console.log(`[webhook] Recommendations generated for issue #${issue.number}`);
  } catch (err) {
    console.error("[webhook] Recommendation pipeline failed:", err);
  }
}

// -------------------------------------------------------------------------
// HMAC verification
// -------------------------------------------------------------------------
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    // In development without a secret configured, skip verification
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expected = `sha256=${hmac.digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------------
// GitHub webhook event types (minimal)
// -------------------------------------------------------------------------
interface GitHubIssueEvent {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    labels: { name: string }[];
    created_at: string;
  };
  repository: {
    full_name: string;
  };
}
