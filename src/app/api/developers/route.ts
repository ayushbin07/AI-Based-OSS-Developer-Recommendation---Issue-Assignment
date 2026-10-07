import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  developers,
  developerEmbeddings,
  commits,
  pullRequests,
  repoContributors,
} from "@/lib/db/schema";
import { getGitHubClient } from "@/lib/github/client";

export const dynamic = "force-dynamic";

export interface RepoDeveloperInfo {
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  commitsOnRepo: number;
  prsOnRepo: number;
  hasEmbedding: boolean;
  syncedInDb: boolean;
  dbId: number | null;
  specialKeywords: string | null;
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const repoFullName = searchParams.get("repo");

    if (!repoFullName || !repoFullName.includes("/")) {
      return Response.json(
        { error: "Query parameter 'repo' (owner/name) is required" },
        { status: 400 }
      );
    }

    const [owner, repo] = repoFullName.split("/");
    const github = getGitHubClient();

    // 1. Fetch contributors from GitHub
    let ghContributors: Array<{
      githubId: number;
      login: string;
      avatarUrl: string;
      profileUrl: string;
      totalCommits: number;
    }> = [];

    try {
      ghContributors = await github.getContributors(owner, repo);
    } catch (err) {
      console.warn(`[api/developers] Could not fetch contributors from GitHub for ${repoFullName}:`, err);
    }

    // 2. Fetch developers & embeddings from local DB for this repository
    const dbCommits = await db
      .select({
        authorId: commits.authorId,
        authorLogin: developers.login,
        devId: developers.id,
        githubId: developers.githubId,
        avatarUrl: developers.avatarUrl,
        profileUrl: developers.profileUrl,
        name: developers.name,
      })
      .from(commits)
      .innerJoin(developers, eq(commits.authorId, developers.id))
      .where(eq(commits.repoFullName, repoFullName));

    const dbPRs = await db
      .select({
        authorId: pullRequests.authorId,
        devId: developers.id,
        githubId: developers.githubId,
        login: developers.login,
      })
      .from(pullRequests)
      .innerJoin(developers, eq(pullRequests.authorId, developers.id))
      .where(eq(pullRequests.repoFullName, repoFullName));

    const allEmbeddings = await db.select({ developerId: developerEmbeddings.developerId }).from(developerEmbeddings);
    const embeddedDevIds = new Set(allEmbeddings.map((e) => e.developerId));

    // Map counts by login
    const commitCountMap = new Map<string, number>();
    for (const c of dbCommits) {
      commitCountMap.set(c.authorLogin, (commitCountMap.get(c.authorLogin) ?? 0) + 1);
    }

    const prCountMap = new Map<string, number>();
    for (const p of dbPRs) {
      prCountMap.set(p.login, (prCountMap.get(p.login) ?? 0) + 1);
    }

    // DB developers map by login
    const allDbDevs = await db.select().from(developers);
    const dbDevMap = new Map<string, typeof allDbDevs[0]>();
    for (const d of allDbDevs) {
      dbDevMap.set(d.login.toLowerCase(), d);
    }

    // 3. Merge GitHub contributors with DB data
    const developerList: RepoDeveloperInfo[] = [];
    const seenLogins = new Set<string>();

    for (const c of ghContributors) {
      const lower = c.login.toLowerCase();
      seenLogins.add(lower);
      const dbDev = dbDevMap.get(lower);

      const commitsCount = commitCountMap.get(c.login) ?? c.totalCommits;
      const prsCount = prCountMap.get(c.login) ?? 0;
      const hasEmbedding = dbDev ? embeddedDevIds.has(dbDev.id) : false;

      developerList.push({
        githubId: c.githubId,
        login: c.login,
        name: dbDev?.name ?? null,
        avatarUrl: c.avatarUrl,
        profileUrl: c.profileUrl,
        commitsOnRepo: commitsCount,
        prsOnRepo: prsCount,
        hasEmbedding,
        syncedInDb: !!dbDev,
        dbId: dbDev?.id ?? null,
        specialKeywords: dbDev?.specialKeywords ?? null,
      });
    }

    // Also include any developer recorded in DB for this repo who wasn't in ghContributors
    for (const [login, count] of commitCountMap.entries()) {
      const lower = login.toLowerCase();
      if (!seenLogins.has(lower)) {
        seenLogins.add(lower);
        const dbDev = dbDevMap.get(lower);
        if (dbDev) {
          developerList.push({
            githubId: dbDev.githubId,
            login: dbDev.login,
            name: dbDev.name,
            avatarUrl: dbDev.avatarUrl ?? "",
            profileUrl: dbDev.profileUrl ?? `https://github.com/${dbDev.login}`,
            commitsOnRepo: count,
            prsOnRepo: prCountMap.get(dbDev.login) ?? 0,
            hasEmbedding: embeddedDevIds.has(dbDev.id),
            syncedInDb: true,
            dbId: dbDev.id,
            specialKeywords: dbDev.specialKeywords ?? null,
          });
        }
      }
    }

    // Sort by commits descending
    developerList.sort((a, b) => b.commitsOnRepo - a.commitsOnRepo);

    return Response.json({
      ok: true,
      repoFullName,
      totalDevelopers: developerList.length,
      developers: developerList,
    });
  } catch (err) {
    console.error("[api/developers] Error:", err);
    return Response.json(
      { error: "Failed to fetch developers for repository", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { developerId, login, specialKeywords, repo } = body;

    let targetDevId = developerId;

    if (!targetDevId && login) {
      const [existing] = await db
        .select()
        .from(developers)
        .where(eq(developers.login, login))
        .limit(1);

      if (existing) {
        targetDevId = existing.id;
      } else {
        const [inserted] = await db
          .insert(developers)
          .values({
            githubId: Math.floor(Math.random() * 1000000000),
            login,
            specialKeywords: specialKeywords?.trim() || null,
          })
          .returning({ id: developers.id });
        targetDevId = inserted?.id;
      }
    }

    if (!targetDevId) {
      return Response.json(
        { error: "developerId or login is required" },
        { status: 400 }
      );
    }

    const cleanKeywords =
      specialKeywords !== undefined && specialKeywords !== null
        ? specialKeywords.trim()
        : null;

    const [updated] = await db
      .update(developers)
      .set({
        specialKeywords: cleanKeywords,
        updatedAt: new Date(),
      })
      .where(eq(developers.id, targetDevId))
      .returning();

    if (repo && updated) {
      await db
        .insert(repoContributors)
        .values({
          repoFullName: repo,
          developerId: updated.id,
          contributionsCount: 1,
        })
        .onConflictDoNothing();
    }

    return Response.json({
      ok: true,
      developer: updated,
    });
  } catch (err) {
    console.error("[api/developers PATCH] Error:", err);
    return Response.json(
      { error: "Failed to update developer keywords", detail: String(err) },
      { status: 500 }
    );
  }
}

