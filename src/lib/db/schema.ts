/**
 * Drizzle ORM Schema
 *
 * Defines the PostgreSQL database tables for the OSS Developer
 * Recommendation system. Uses pgvector for embedding columns.
 *
 * Tables:
 *   developers          – GitHub contributor profiles
 *   issues              – GitHub issues (open / closed)
 *   pull_requests       – GitHub pull requests
 *   commits             – Individual commits tied to a PR
 *   changed_files       – Files modified in a commit or PR
 *   developer_embeddings – One embedding row per developer (upserted)
 *   issue_recommendations – Cached AI recommendations for an issue
 */

import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  timestamp,
  real,
  index,
  unique,
  boolean,
  customType,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// pgvector custom type
// We store embeddings as vector(768) — compatible with both:
//   nomic-embed-text (Ollama)  → 768 dims
//   gemini-embedding-001 (Google) → 768 dims
// ---------------------------------------------------------------------------
const EMBEDDING_DIMENSIONS = 768;

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

// ---------------------------------------------------------------------------
// developers
// ---------------------------------------------------------------------------
export const developers = pgTable(
  "developers",
  {
    id: serial("id").primaryKey(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    login: text("login").notNull(),
    name: text("name"),
    email: text("email"),
    avatarUrl: text("avatar_url"),
    profileUrl: text("profile_url"),
    bio: text("bio"),
    location: text("location"),
    company: text("company"),
    /** Total commits collected from this repository */
    totalCommits: integer("total_commits").notNull().default(0),
    /** Total PRs merged in this repository */
    totalPrs: integer("total_prs").notNull().default(0),
    /** Total issues closed in this repository */
    totalIssuesClosed: integer("total_issues_closed").notNull().default(0),
    /** Special expertise keywords (e.g. 'backend expert', 'frontend UI', 'devops') */
    specialKeywords: text("special_keywords"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("developers_github_id_unique").on(t.githubId),
    index("developers_login_idx").on(t.login),
  ]
);

// ---------------------------------------------------------------------------
// repo_contributors (maps developers strictly to repositories they contributed to)
// ---------------------------------------------------------------------------
export const repoContributors = pgTable(
  "repo_contributors",
  {
    id: serial("id").primaryKey(),
    repoFullName: text("repo_full_name").notNull(),
    developerId: integer("developer_id")
      .notNull()
      .references(() => developers.id),
    contributionsCount: integer("contributions_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("repo_contributors_repo_dev_unique").on(t.repoFullName, t.developerId),
    index("repo_contributors_repo_idx").on(t.repoFullName),
  ]
);


// ---------------------------------------------------------------------------
// issues
// ---------------------------------------------------------------------------
export const issues = pgTable(
  "issues",
  {
    id: serial("id").primaryKey(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    /** Repository in owner/repo format */
    repoFullName: text("repo_full_name").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull().default("open"), // "open" | "closed"
    labels: text("labels").array().notNull().default([]),
    /** GitHub login of the assigned developer (after human confirmation) */
    assigneeLogin: text("assignee_login"),
    closedAt: timestamp("closed_at"),
    githubCreatedAt: timestamp("github_created_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("issues_repo_number_unique").on(t.repoFullName, t.number),
    index("issues_repo_state_idx").on(t.repoFullName, t.state),
  ]
);

// ---------------------------------------------------------------------------
// pull_requests
// ---------------------------------------------------------------------------
export const pullRequests = pgTable(
  "pull_requests",
  {
    id: serial("id").primaryKey(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    repoFullName: text("repo_full_name").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    state: text("state").notNull().default("open"),
    merged: boolean("merged").notNull().default(false),
    mergedAt: timestamp("merged_at"),
    /** Developer who authored this PR */
    authorId: integer("author_id").references(() => developers.id),
    /** Issue this PR closes (if any) */
    closesIssueId: integer("closes_issue_id").references(() => issues.id),
    labels: text("labels").array().notNull().default([]),
    githubCreatedAt: timestamp("github_created_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("prs_repo_number_unique").on(t.repoFullName, t.number),
    index("prs_author_idx").on(t.authorId),
  ]
);

// ---------------------------------------------------------------------------
// commits
// ---------------------------------------------------------------------------
export const commits = pgTable(
  "commits",
  {
    id: serial("id").primaryKey(),
    sha: text("sha").notNull(),
    repoFullName: text("repo_full_name").notNull(),
    message: text("message").notNull(),
    authorId: integer("author_id").references(() => developers.id),
    prId: integer("pr_id").references(() => pullRequests.id),
    committedAt: timestamp("committed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("commits_sha_unique").on(t.sha),
    index("commits_author_idx").on(t.authorId),
  ]
);

// ---------------------------------------------------------------------------
// changed_files
// ---------------------------------------------------------------------------
export const changedFiles = pgTable(
  "changed_files",
  {
    id: serial("id").primaryKey(),
    repoFullName: text("repo_full_name").notNull(),
    filePath: text("file_path").notNull(),
    /** The commit that touched this file */
    commitId: integer("commit_id").references(() => commits.id),
    /** The PR that touched this file (denormalised for faster lookups) */
    prId: integer("pr_id").references(() => pullRequests.id),
    additions: integer("additions").notNull().default(0),
    deletions: integer("deletions").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("changed_files_path_idx").on(t.filePath)]
);

// ---------------------------------------------------------------------------
// developer_embeddings
// ---------------------------------------------------------------------------
export const developerEmbeddings = pgTable(
  "developer_embeddings",
  {
    id: serial("id").primaryKey(),
    developerId: integer("developer_id")
      .notNull()
      .references(() => developers.id),
    /** The text that was used to generate the embedding */
    sourceText: text("source_text").notNull(),
    /** The embedding vector */
    embedding: vector("embedding").notNull(),
    /** Which AI provider/model generated this embedding */
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("dev_embeddings_developer_unique").on(t.developerId),
    index("dev_embeddings_developer_idx").on(t.developerId),
  ]
);

// ---------------------------------------------------------------------------
// issue_recommendations
// ---------------------------------------------------------------------------
export const issueRecommendations = pgTable(
  "issue_recommendations",
  {
    id: serial("id").primaryKey(),
    issueId: integer("issue_id")
      .notNull()
      .references(() => issues.id),
    /** JSON array of { developerId, login, score, reason } */
    recommendations: text("recommendations").notNull(),
    /** The AI provider used to generate this recommendation */
    provider: text("provider").notNull(),
    /** Human confirmed the recommendation and triggered assignment */
    confirmed: boolean("confirmed").notNull().default(false),
    confirmedAt: timestamp("confirmed_at"),
    assignedDeveloperId: integer("assigned_developer_id").references(
      () => developers.id
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("recommendations_issue_idx").on(t.issueId)]
);

// ---------------------------------------------------------------------------
// Type exports (inferred from schema)
// ---------------------------------------------------------------------------
export type Developer = typeof developers.$inferSelect;
export type NewDeveloper = typeof developers.$inferInsert;

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

export type PullRequest = typeof pullRequests.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;

export type Commit = typeof commits.$inferSelect;
export type NewCommit = typeof commits.$inferInsert;

export type ChangedFile = typeof changedFiles.$inferSelect;
export type NewChangedFile = typeof changedFiles.$inferInsert;

export type DeveloperEmbedding = typeof developerEmbeddings.$inferSelect;
export type NewDeveloperEmbedding = typeof developerEmbeddings.$inferInsert;

export type IssueRecommendation = typeof issueRecommendations.$inferSelect;
export type NewIssueRecommendation = typeof issueRecommendations.$inferInsert;

export type RepoContributor = typeof repoContributors.$inferSelect;
export type NewRepoContributor = typeof repoContributors.$inferInsert;

// Convenience re-export
export { EMBEDDING_DIMENSIONS };

