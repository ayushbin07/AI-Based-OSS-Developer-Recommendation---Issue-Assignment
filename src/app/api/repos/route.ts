import { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { issues, pullRequests, commits } from "@/lib/db/schema";
import { getGitHubClient } from "@/lib/github/client";
import { clearRepositoryData } from "@/lib/services/collector.service";

export const dynamic = "force-dynamic";

export interface RepoWithStats {
  id?: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  stars: number;
  htmlUrl: string;
  updatedAt: string | null;
  isSynced: boolean;
  isRemovedFromGitHub?: boolean;
  stats: {
    issues: number;
    pullRequests: number;
    commits: number;
  };
}

export async function GET() {
  try {
    const github = getGitHubClient();

    // 1. Fetch repositories from GitHub
    let ghRepos: Array<{
      id: number;
      name: string;
      fullName: string;
      owner: string;
      description: string | null;
      isPrivate: boolean;
      stars: number;
      htmlUrl: string;
      updatedAt: string | null;
    }> = [];

    try {
      ghRepos = await github.listRepositories();
    } catch (ghErr) {
      console.warn("[api/repos] Error listing GitHub repos:", ghErr);
    }

    // 2. Fetch distinct repos with counts from DB
    const dbIssues = await db
      .select({ repoFullName: issues.repoFullName, count: count() })
      .from(issues)
      .groupBy(issues.repoFullName);

    const dbPrs = await db
      .select({ repoFullName: pullRequests.repoFullName, count: count() })
      .from(pullRequests)
      .groupBy(pullRequests.repoFullName);

    const dbCommits = await db
      .select({ repoFullName: commits.repoFullName, count: count() })
      .from(commits)
      .groupBy(commits.repoFullName);

    const dbStatsMap = new Map<
      string,
      { issues: number; pullRequests: number; commits: number }
    >();

    for (const row of dbIssues) {
      const cur = dbStatsMap.get(row.repoFullName) ?? { issues: 0, pullRequests: 0, commits: 0 };
      cur.issues = row.count;
      dbStatsMap.set(row.repoFullName, cur);
    }
    for (const row of dbPrs) {
      const cur = dbStatsMap.get(row.repoFullName) ?? { issues: 0, pullRequests: 0, commits: 0 };
      cur.pullRequests = row.count;
      dbStatsMap.set(row.repoFullName, cur);
    }
    for (const row of dbCommits) {
      const cur = dbStatsMap.get(row.repoFullName) ?? { issues: 0, pullRequests: 0, commits: 0 };
      cur.commits = row.count;
      dbStatsMap.set(row.repoFullName, cur);
    }

    // 3. Build merged list
    const repos: RepoWithStats[] = [];
    const seenFullName = new Set<string>();

    for (const r of ghRepos) {
      seenFullName.add(r.fullName);
      const st = dbStatsMap.get(r.fullName) ?? { issues: 0, pullRequests: 0, commits: 0 };
      const isSynced = st.issues > 0 || st.pullRequests > 0 || st.commits > 0;
      repos.push({
        ...r,
        isSynced,
        stats: st,
      });
    }

    // Add any repo stored in DB that is no longer on GitHub
    for (const [repoFullName, st] of dbStatsMap.entries()) {
      if (!seenFullName.has(repoFullName)) {
        const [owner, name] = repoFullName.split("/");
        repos.push({
          name: name || repoFullName,
          fullName: repoFullName,
          owner: owner || "",
          description: "Removed or deleted from GitHub",
          isPrivate: false,
          stars: 0,
          htmlUrl: `https://github.com/${repoFullName}`,
          updatedAt: null,
          isSynced: true,
          isRemovedFromGitHub: true,
          stats: st,
        });
      }
    }

    return Response.json({
      ok: true,
      repos,
      defaultRepo: process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
        ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
        : repos[0]?.fullName ?? "",
    });
  } catch (err) {
    console.error("[api/repos] Error:", err);
    return Response.json(
      { error: "Failed to fetch repositories", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const repoFullName = searchParams.get("repo");

    if (!repoFullName) {
      return Response.json(
        { error: "Query parameter 'repo' (owner/name) is required" },
        { status: 400 }
      );
    }

    const result = await clearRepositoryData(repoFullName);

    return Response.json({
      ok: true,
      message: `Cleared all cached data for ${repoFullName}`,
      result,
    });
  } catch (err) {
    console.error("[api/repos DELETE] Error:", err);
    return Response.json(
      { error: "Failed to clear repository data", detail: String(err) },
      { status: 500 }
    );
  }
}
