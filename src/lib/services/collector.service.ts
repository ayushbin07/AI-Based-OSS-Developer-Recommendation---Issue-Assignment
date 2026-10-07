/**
 * GitHub Data Collection Service
 *
 * Ingests contributors, issues, PRs, and commits from GitHub into the
 * local database. Designed to be run on-demand (manual sync) or triggered
 * by an admin API route.
 *
 * All writes are upserts — safe to re-run without creating duplicates.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  issues,
  pullRequests,
  commits,
  changedFiles,
  developerEmbeddings,
  issueRecommendations,
  repoContributors,
} from "@/lib/db/schema";
import { getGitHubClient } from "@/lib/github/client";

export interface CollectionResult {
  developers: number;
  issues: number;
  pullRequests: number;
  commits: number;
  errors: string[];
}

export async function collectRepositoryData(
  repoOwner?: string,
  repoName?: string
): Promise<CollectionResult> {
  const github = getGitHubClient();
  // Allow overriding the repo at call-time (useful for testing)
  const owner = repoOwner || github.owner;
  const repo = repoName || github.repo;
  const repoFullName = `${owner}/${repo}`;

  const result: CollectionResult = {
    developers: 0,
    issues: 0,
    pullRequests: 0,
    commits: 0,
    errors: [],
  };

  console.log(`[collector] Starting collection for ${repoFullName}`);

  // -------------------------------------------------------------------------
  // 1. Contributors
  // -------------------------------------------------------------------------
  try {
    const contributors = await github.getContributors(owner, repo);
    for (const c of contributors) {
      const [devRecord] = await db
        .insert(developers)
        .values({
          githubId: c.githubId,
          login: c.login,
          avatarUrl: c.avatarUrl,
          profileUrl: c.profileUrl,
          totalCommits: c.totalCommits,
        })
        .onConflictDoUpdate({
          target: developers.githubId,
          set: {
            login: c.login,
            avatarUrl: c.avatarUrl,
            profileUrl: c.profileUrl,
            totalCommits: c.totalCommits,
            updatedAt: new Date(),
          },
        })
        .returning({ id: developers.id });

      if (devRecord?.id) {
        await db
          .insert(repoContributors)
          .values({
            repoFullName,
            developerId: devRecord.id,
            contributionsCount: c.totalCommits,
          })
          .onConflictDoUpdate({
            target: [repoContributors.repoFullName, repoContributors.developerId],
            set: {
              contributionsCount: c.totalCommits,
            },
          });
      }

      result.developers++;
    }
    console.log(`[collector] Upserted ${result.developers} developers`);
  } catch (err) {
    result.errors.push(`contributors: ${String(err)}`);
  }

  // -------------------------------------------------------------------------
  // 2. Issues
  // -------------------------------------------------------------------------
  try {
    const ghIssues = await github.getIssues("all", owner, repo);
    for (const issue of ghIssues) {
      try {
        await db
          .insert(issues)
          .values({
            githubId: issue.githubId,
            repoFullName,
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            labels: issue.labels,
            assigneeLogin: issue.assigneeLogin,
            closedAt: issue.closedAt,
            githubCreatedAt: issue.createdAt,
          })
          .onConflictDoUpdate({
            target: [issues.repoFullName, issues.number],
            set: {
              githubId: issue.githubId,
              title: issue.title,
              body: issue.body,
              state: issue.state,
              labels: issue.labels,
              assigneeLogin: issue.assigneeLogin,
              closedAt: issue.closedAt,
              updatedAt: new Date(),
            },
          });
        result.issues++;
      } catch (issueErr) {
        console.error(`[collector] Failed to upsert issue #${issue.number}:`, issueErr);
        result.errors.push(`issue #${issue.number}: ${String(issueErr)}`);
      }
    }
    console.log(`[collector] Upserted ${result.issues} issues`);
  } catch (err) {
    result.errors.push(`issues: ${String(err)}`);
  }

  // -------------------------------------------------------------------------
  // 3. Pull Requests + Commits + Changed Files
  // -------------------------------------------------------------------------
  try {
    const ghPRs = await github.getPullRequests("all", owner, repo);

    for (const pr of ghPRs) {
      try {
        // Resolve author FK
        const [author] = await db
          .select({ id: developers.id })
          .from(developers)
          .where(eq(developers.login, pr.authorLogin))
          .limit(1);

        // Resolve closes-issue FK
        let closesIssueId: number | null = null;
        if (pr.closesIssueNumber) {
          const [linkedIssue] = await db
            .select({ id: issues.id })
            .from(issues)
            .where(
              and(
                eq(issues.repoFullName, repoFullName),
                eq(issues.number, pr.closesIssueNumber)
              )
            )
            .limit(1);
          closesIssueId = linkedIssue?.id ?? null;
        }

        const [upsertedPR] = await db
          .insert(pullRequests)
          .values({
            githubId: pr.githubId,
            repoFullName,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            merged: pr.merged,
            mergedAt: pr.mergedAt,
            authorId: author?.id ?? null,
            closesIssueId,
            labels: pr.labels,
            githubCreatedAt: pr.createdAt,
          })
          .onConflictDoUpdate({
            target: [pullRequests.repoFullName, pullRequests.number],
            set: {
              githubId: pr.githubId,
              title: pr.title,
              body: pr.body,
              state: pr.state,
              merged: pr.merged,
              mergedAt: pr.mergedAt,
              authorId: author?.id ?? null,
              closesIssueId,
              labels: pr.labels,
              updatedAt: new Date(),
            },
          })
          .returning({ id: pullRequests.id });

        result.pullRequests++;

        // Collect commits for merged PRs only (reduces API calls)
        if (pr.merged && upsertedPR?.id) {
          try {
            const ghCommits = await github.getCommitsForPR(pr.number, owner, repo);
            for (const commit of ghCommits) {
              const commitAuthor = commit.authorLogin
                ? await db
                    .select({ id: developers.id })
                    .from(developers)
                    .where(eq(developers.login, commit.authorLogin))
                    .limit(1)
                    .then((rows) => rows[0])
                : null;

              const [upsertedCommit] = await db
                .insert(commits)
                .values({
                  sha: commit.sha,
                  repoFullName,
                  message: commit.message,
                  authorId: commitAuthor?.id ?? null,
                  prId: upsertedPR.id,
                  committedAt: commit.committedAt,
                })
                .onConflictDoUpdate({
                  target: commits.sha,
                  set: {
                    message: commit.message,
                    authorId: commitAuthor?.id ?? null,
                  },
                })
                .returning({ id: commits.id });

              result.commits++;

              // Insert changed files (skip duplicates by checking commitId)
              if (upsertedCommit?.id) {
                for (const file of commit.changedFiles) {
                  await db
                    .insert(changedFiles)
                    .values({
                      repoFullName,
                      filePath: file.filePath,
                      commitId: upsertedCommit.id,
                      prId: upsertedPR.id,
                      additions: file.additions,
                      deletions: file.deletions,
                    })
                    .onConflictDoNothing();
                }
              }
            }
          } catch (commitErr) {
            result.errors.push(`commits for PR#${pr.number}: ${String(commitErr)}`);
          }
        }
      } catch (prErr) {
        console.error(`[collector] Failed to upsert PR #${pr.number}:`, prErr);
        result.errors.push(`PR #${pr.number}: ${String(prErr)}`);
      }
    }
    console.log(
      `[collector] Upserted ${result.pullRequests} PRs, ${result.commits} commits`
    );
  } catch (err) {
    result.errors.push(`pull_requests: ${String(err)}`);
  }

  console.log("[collector] Done.", result);
  return result;
}

/**
 * Remove all cached database data for a specific repository.
 * Cleans up issues, recommendations, pull requests, commits, and changed files,
 * plus any orphan developers who have no other remaining activity.
 */
export async function clearRepositoryData(repoFullName: string): Promise<{
  deletedIssues: number;
  deletedPRs: number;
  deletedCommits: number;
}> {
  console.log(`[collector] Clearing all cached data for repository: ${repoFullName}`);

  // 1. Delete recommendations for issues belonging to this repo
  const repoIssues = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.repoFullName, repoFullName));

  if (repoIssues.length > 0) {
    for (const issue of repoIssues) {
      await db
        .delete(issueRecommendations)
        .where(eq(issueRecommendations.issueId, issue.id));
    }
  }

  // 2. Unlink FK closesIssueId on PRs before deleting issues
  await db
    .update(pullRequests)
    .set({ closesIssueId: null })
    .where(eq(pullRequests.repoFullName, repoFullName));

  // 3. Delete changed files
  await db
    .delete(changedFiles)
    .where(eq(changedFiles.repoFullName, repoFullName));

  // 4. Delete commits
  const deletedCommits = await db
    .delete(commits)
    .where(eq(commits.repoFullName, repoFullName))
    .returning({ id: commits.id });

  // 5. Delete pull requests
  const deletedPRs = await db
    .delete(pullRequests)
    .where(eq(pullRequests.repoFullName, repoFullName))
    .returning({ id: pullRequests.id });

  // 6. Delete issues
  const deletedIssues = await db
    .delete(issues)
    .where(eq(issues.repoFullName, repoFullName))
    .returning({ id: issues.id });

  // 6b. Delete repo contributors mapping
  await db
    .delete(repoContributors)
    .where(eq(repoContributors.repoFullName, repoFullName));

  // 7. Clean up orphan developers who have no remaining commits or PRs
  try {
    const allDevs = await db.select({ id: developers.id }).from(developers);
    for (const dev of allDevs) {
      const [hasCommits] = await db
        .select({ id: commits.id })
        .from(commits)
        .where(eq(commits.authorId, dev.id))
        .limit(1);
      const [hasPrs] = await db
        .select({ id: pullRequests.id })
        .from(pullRequests)
        .where(eq(pullRequests.authorId, dev.id))
        .limit(1);

      if (!hasCommits && !hasPrs) {
        await db
          .delete(developerEmbeddings)
          .where(eq(developerEmbeddings.developerId, dev.id));
        await db.delete(developers).where(eq(developers.id, dev.id));
      }
    }
  } catch (cleanErr) {
    console.warn("[collector] Orphan developer cleanup error:", cleanErr);
  }

  return {
    deletedIssues: deletedIssues.length,
    deletedPRs: deletedPRs.length,
    deletedCommits: deletedCommits.length,
  };
}

