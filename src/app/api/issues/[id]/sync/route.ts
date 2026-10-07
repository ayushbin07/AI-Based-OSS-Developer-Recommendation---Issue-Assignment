import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues, issueRecommendations, developers } from "@/lib/db/schema";
import { getGitHubClient } from "@/lib/github/client";

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
    const github = getGitHubClient();
    let owner = github.owner;
    let repo = github.repo;

    if (issue.repoFullName && issue.repoFullName.includes("/")) {
      const [o, r] = issue.repoFullName.split("/");
      owner = o.trim();
      repo = r.trim();
    }

    // Fetch fresh live issue state from GitHub
    const ghIssue = await github.getIssue(issue.number, owner, repo);

    const assigneeLogin = ghIssue.assigneeLogin;
    const state = ghIssue.state;

    // Update issues record
    await db
      .update(issues)
      .set({
        assigneeLogin,
        state,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issue.id));

    // Reconcile recommendation if one exists
    let assignedDeveloperId: number | null = null;
    if (assigneeLogin) {
      const [matchedDev] = await db
        .select()
        .from(developers)
        .where(eq(developers.login, assigneeLogin))
        .limit(1);

      if (matchedDev) {
        assignedDeveloperId = matchedDev.id;
      }

      await db
        .update(issueRecommendations)
        .set({
          confirmed: true,
          confirmedAt: new Date(),
          assignedDeveloperId,
        })
        .where(eq(issueRecommendations.issueId, issue.id));
    } else {
      await db
        .update(issueRecommendations)
        .set({
          confirmed: false,
          confirmedAt: null,
          assignedDeveloperId: null,
        })
        .where(eq(issueRecommendations.issueId, issue.id));
    }

    return Response.json({
      success: true,
      assigneeLogin,
      state,
      assignedDeveloperId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/issues/sync] Failed to sync issue with GitHub:", message);
    return Response.json(
      { error: `GitHub sync failed: ${message}` },
      { status: 500 }
    );
  }
}
