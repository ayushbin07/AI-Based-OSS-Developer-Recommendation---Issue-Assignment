/**
 * GitHub API Client
 *
 * Thin wrapper around Octokit (official GitHub REST client).
 * Provides typed helpers for collecting developer contribution data.
 *
 * Required env vars:
 *   GITHUB_TOKEN       – Personal access token or GitHub App token
 *   GITHUB_REPO_OWNER  – Repository owner (org or user)
 *   GITHUB_REPO_NAME   – Repository name
 */

import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface GitHubContributor {
  githubId: number;
  login: string;
  avatarUrl: string;
  profileUrl: string;
  totalCommits: number;
}

export interface GitHubIssue {
  githubId: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[];
  assigneeLogin: string | null;
  closedAt: Date | null;
  createdAt: Date | null;
}

export interface GitHubPR {
  githubId: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  merged: boolean;
  mergedAt: Date | null;
  authorLogin: string;
  labels: string[];
  closesIssueNumber: number | null;
  createdAt: Date | null;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  authorLogin: string | null;
  committedAt: Date | null;
  prNumber: number | null;
  changedFiles: {
    filePath: string;
    additions: number;
    deletions: number;
  }[];
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  stars: number;
  htmlUrl: string;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Client class
// ---------------------------------------------------------------------------
export class GitHubClient {
  private readonly octokit: Octokit;
  readonly owner: string;
  readonly repo: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is not set.");
    }
    this.owner = process.env.GITHUB_REPO_OWNER ?? "";
    this.repo = process.env.GITHUB_REPO_NAME ?? "";

    this.octokit = new Octokit({ auth: token });
  }

  // -------------------------------------------------------------------------
  // Repositories
  // -------------------------------------------------------------------------
  async listRepositories(): Promise<GitHubRepoSummary[]> {
    const repos: GitHubRepoSummary[] = [];

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.repos.listForAuthenticatedUser,
      { per_page: 100, sort: "updated" }
    )) {
      for (const r of response.data) {
        repos.push({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          owner: r.owner.login,
          description: r.description ?? null,
          isPrivate: r.private,
          stars: r.stargazers_count ?? 0,
          htmlUrl: r.html_url,
          updatedAt: r.updated_at ?? null,
        });
      }
    }

    return repos;
  }

  // -------------------------------------------------------------------------
  // Contributors
  // -------------------------------------------------------------------------
  async getContributors(
    targetOwner?: string,
    targetRepo?: string
  ): Promise<GitHubContributor[]> {
    const owner = targetOwner || this.owner;
    const repo = targetRepo || this.repo;

    if (!owner || !repo) {
      throw new Error("Repository owner and name must be specified.");
    }

    const contributors: GitHubContributor[] = [];

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.repos.listContributors,
      { owner, repo, per_page: 100 }
    )) {
      for (const c of response.data) {
        if (!c.login || c.type === "Bot") continue;
        contributors.push({
          githubId: c.id!,
          login: c.login,
          avatarUrl: c.avatar_url ?? "",
          profileUrl: c.html_url ?? "",
          totalCommits: c.contributions ?? 0,
        });
      }
    }

    return contributors;
  }

  // -------------------------------------------------------------------------
  // Issues
  // -------------------------------------------------------------------------
  async getIssues(
    state: "open" | "closed" | "all" = "all",
    targetOwner?: string,
    targetRepo?: string
  ): Promise<GitHubIssue[]> {
    const owner = targetOwner || this.owner;
    const repo = targetRepo || this.repo;

    if (!owner || !repo) {
      throw new Error("Repository owner and name must be specified.");
    }

    const issues: GitHubIssue[] = [];

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.issues.listForRepo,
      {
        owner,
        repo,
        state,
        per_page: 100,
      }
    )) {
      for (const issue of response.data) {
        // Octokit returns PRs in the issues endpoint — filter them out
        if (issue.pull_request) continue;

        issues.push({
          githubId: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body ?? null,
          state: issue.state,
          labels: issue.labels.map((l) =>
            typeof l === "string" ? l : l.name ?? ""
          ),
          assigneeLogin: issue.assignee?.login ?? null,
          closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
          createdAt: issue.created_at ? new Date(issue.created_at) : null,
        });
      }
    }

    return issues;
  }

  // -------------------------------------------------------------------------
  // Single Issue
  // -------------------------------------------------------------------------
  async getIssue(
    issueNumber: number,
    targetOwner?: string,
    targetRepo?: string
  ): Promise<GitHubIssue> {
    const owner = targetOwner || this.owner;
    const repo = targetRepo || this.repo;

    if (!owner || !repo) {
      throw new Error("Repository owner and name must be specified.");
    }

    const { data: issue } = await this.octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    return {
      githubId: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state,
      labels: issue.labels.map((l) =>
        typeof l === "string" ? l : l.name ?? ""
      ),
      assigneeLogin: issue.assignee?.login ?? null,
      closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
      createdAt: issue.created_at ? new Date(issue.created_at) : null,
    };
  }

  // -------------------------------------------------------------------------
  // Pull Requests
  // -------------------------------------------------------------------------
  async getPullRequests(
    state: "open" | "closed" | "all" = "all",
    targetOwner?: string,
    targetRepo?: string
  ): Promise<GitHubPR[]> {
    const owner = targetOwner || this.owner;
    const repo = targetRepo || this.repo;

    if (!owner || !repo) {
      throw new Error("Repository owner and name must be specified.");
    }

    const prs: GitHubPR[] = [];

    for await (const response of this.octokit.paginate.iterator(
      this.octokit.pulls.list,
      {
        owner,
        repo,
        state,
        per_page: 100,
      }
    )) {
      for (const pr of response.data) {
        // Try to extract "closes #N" from the body
        const closesIssueNumber = extractClosesIssueNumber(pr.body ?? "");

        prs.push({
          githubId: pr.id,
          number: pr.number,
          title: pr.title,
          body: pr.body ?? null,
          state: pr.state,
          merged: pr.merged_at !== null,
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          authorLogin: pr.user?.login ?? "ghost",
          labels: pr.labels.map((l) => l.name ?? ""),
          closesIssueNumber,
          createdAt: pr.created_at ? new Date(pr.created_at) : null,
        });
      }
    }

    return prs;
  }

  // -------------------------------------------------------------------------
  // Commits for a PR
  // -------------------------------------------------------------------------
  async getCommitsForPR(
    prNumber: number,
    targetOwner?: string,
    targetRepo?: string
  ): Promise<GitHubCommit[]> {
    const owner = targetOwner || this.owner;
    const repo = targetRepo || this.repo;

    if (!owner || !repo) {
      throw new Error("Repository owner and name must be specified.");
    }

    const commits: GitHubCommit[] = [];

    const { data: prCommits } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });

    for (const c of prCommits) {
      // Fetch changed files for each commit
      const { data: commitDetail } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: c.sha,
      });

      const changedFiles = (commitDetail.files ?? []).map((f) => ({
        filePath: f.filename,
        additions: f.additions,
        deletions: f.deletions,
      }));

      commits.push({
        sha: c.sha,
        message: c.commit.message,
        authorLogin: c.author?.login ?? null,
        committedAt: c.commit.author?.date
          ? new Date(c.commit.author.date)
          : null,
        prNumber,
        changedFiles,
      });
    }

    return commits;
  }

  // -------------------------------------------------------------------------
  // Assign an issue to a developer
  // -------------------------------------------------------------------------
  async assignIssue(
    issueNumber: number,
    login: string,
    targetOwner?: string,
    targetRepo?: string
  ): Promise<void> {
    const owner = targetOwner || this.owner;
    const repo = targetRepo || this.repo;

    if (!owner || !repo) {
      throw new Error("Repository owner and name must be specified.");
    }

    await this.octokit.issues.addAssignees({
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [login],
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract issue number from "Closes #N" or "Fixes #N" patterns in PR body */
function extractClosesIssueNumber(body: string): number | null {
  const match = body.match(
    /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i
  );
  return match ? parseInt(match[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
let _githubClient: GitHubClient | null = null;

export function getGitHubClient(): GitHubClient {
  if (!_githubClient) {
    _githubClient = new GitHubClient();
  }
  return _githubClient;
}
