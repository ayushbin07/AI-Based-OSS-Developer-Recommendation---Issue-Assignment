/**
 * 
 * 
 * Assignment Service
 *
 * Handles the human-confirmed assignment flow:
 *   1. Marks the recommendation as confirmed in the DB
 *   2. Assigns the issue on GitHub via Octokit
 *   3. Sends an email notification to the developer via Resend
 */

import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import {
  issueRecommendations,
  issues,
  developers,
} from "@/lib/db/schema";
import { getGitHubClient } from "@/lib/github/client";

export interface AssignmentResult {
  success: boolean;
  message: string;
  emailSent: boolean;
  githubAssigned: boolean;
  githubError?: string | null;
}

export async function confirmAssignment(
  recommendationId: number,
  developerId: number
): Promise<AssignmentResult> {
  // 1. Load the recommendation + issue + developer from DB
  const [rec] = await db
    .select()
    .from(issueRecommendations)
    .where(eq(issueRecommendations.id, recommendationId))
    .limit(1);

  if (!rec) {
    return {
      success: false,
      message: "Recommendation not found.",
      emailSent: false,
      githubAssigned: false,
    };
  }

  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, rec.issueId))
    .limit(1);

  const [developer] = await db
    .select()
    .from(developers)
    .where(eq(developers.id, developerId))
    .limit(1);

  if (!issue || !developer) {
    return {
      success: false,
      message: "Issue or developer not found.",
      emailSent: false,
      githubAssigned: false,
    };
  }

  // 2. Assign on GitHub first
  let githubAssigned = false;
  let githubError: string | null = null;
  try {
    const github = getGitHubClient();
    let targetOwner: string | undefined;
    let targetRepo: string | undefined;

    if (issue.repoFullName && issue.repoFullName.includes("/")) {
      const [ownerPart, repoPart] = issue.repoFullName.split("/");
      targetOwner = ownerPart?.trim();
      targetRepo = repoPart?.trim();
    }

    await github.assignIssue(
      issue.number,
      developer.login,
      targetOwner,
      targetRepo
    );
    githubAssigned = true;
  } catch (err: unknown) {
    githubError = err instanceof Error ? err.message : String(err);
    console.error("[assignment] GitHub assign failed:", githubError);
  }

  // 3. ONLY update DB and send email if GitHub assignment succeeded!
  if (githubAssigned) {
    await db
      .update(issueRecommendations)
      .set({
        confirmed: true,
        confirmedAt: new Date(),
        assignedDeveloperId: developerId,
      })
      .where(eq(issueRecommendations.id, recommendationId));

    await db
      .update(issues)
      .set({ assigneeLogin: developer.login, updatedAt: new Date() })
      .where(eq(issues.id, issue.id));

    let emailSent = false;
    try {
      emailSent = await sendAssignmentEmail(issue, developer);
    } catch (err) {
      console.error("[assignment] Email failed:", err);
    }

    return {
      success: true,
      message: `Issue #${issue.number} assigned to @${developer.login} on GitHub.`,
      emailSent,
      githubAssigned: true,
      githubError: null,
    };
  }

  // If GitHub assignment failed, do not mark as assigned in DB
  return {
    success: false,
    message: `GitHub assign failed: ${githubError}`,
    emailSent: false,
    githubAssigned: false,
    githubError,
  };
}

// -------------------------------------------------------------------------
// Email
// -------------------------------------------------------------------------
async function sendAssignmentEmail(
  issue: { number: number; title: string; repoFullName: string },
  developer: { login: string; email: string | null; name: string | null }
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

  if (!apiKey || !developer.email) {
    console.warn("[assignment] Resend skipped: no API key or no developer email.");
    return false;
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const issueUrl = `https://github.com/${issue.repoFullName}/issues/${issue.number}`;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: developer.email,
    subject: `You've been assigned: ${issue.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2>Hi ${developer.name ?? developer.login},</h2>
        <p>You have been assigned to the following GitHub issue:</p>
        <blockquote style="border-left: 3px solid #6366f1; padding-left: 16px; margin: 16px 0;">
          <strong><a href="${issueUrl}">${issue.title}</a></strong><br/>
          <small>${issue.repoFullName} · Issue #${issue.number}</small>
        </blockquote>
        <p>This assignment was recommended by the AI Developer Recommender system.</p>
        <p>
          <a href="${issueUrl}" style="background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
            View Issue on GitHub
          </a>
        </p>
        <hr/>
        <small style="color:#888;">Sent via <a href="${appUrl}">AI Dev Recommender</a></small>
      </div>
    `,
  });

  if (error) {
    console.error("[assignment] Resend error:", error);
    return false;
  }

  return true;
}
