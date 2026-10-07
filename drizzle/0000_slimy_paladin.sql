CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "changed_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"repo_full_name" text NOT NULL,
	"file_path" text NOT NULL,
	"commit_id" integer,
	"pr_id" integer,
	"additions" integer DEFAULT 0 NOT NULL,
	"deletions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"id" serial PRIMARY KEY NOT NULL,
	"sha" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"message" text NOT NULL,
	"author_id" integer,
	"pr_id" integer,
	"committed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commits_sha_unique" UNIQUE("sha")
);
--> statement-breakpoint
CREATE TABLE "developer_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"developer_id" integer NOT NULL,
	"source_text" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dev_embeddings_developer_unique" UNIQUE("developer_id")
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"profile_url" text,
	"bio" text,
	"location" text,
	"company" text,
	"total_commits" integer DEFAULT 0 NOT NULL,
	"total_prs" integer DEFAULT 0 NOT NULL,
	"total_issues_closed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "developers_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "issue_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"recommendations" text NOT NULL,
	"provider" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp,
	"assigned_developer_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"repo_full_name" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text DEFAULT 'open' NOT NULL,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"assignee_login" text,
	"closed_at" timestamp,
	"github_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "issues_repo_number_unique" UNIQUE("repo_full_name","number")
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" integer NOT NULL,
	"repo_full_name" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text DEFAULT 'open' NOT NULL,
	"merged" boolean DEFAULT false NOT NULL,
	"merged_at" timestamp,
	"author_id" integer,
	"closes_issue_id" integer,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"github_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prs_repo_number_unique" UNIQUE("repo_full_name","number")
);
--> statement-breakpoint
ALTER TABLE "changed_files" ADD CONSTRAINT "changed_files_commit_id_commits_id_fk" FOREIGN KEY ("commit_id") REFERENCES "public"."commits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changed_files" ADD CONSTRAINT "changed_files_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_author_id_developers_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_pr_id_pull_requests_id_fk" FOREIGN KEY ("pr_id") REFERENCES "public"."pull_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_embeddings" ADD CONSTRAINT "developer_embeddings_developer_id_developers_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_recommendations" ADD CONSTRAINT "issue_recommendations_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_recommendations" ADD CONSTRAINT "issue_recommendations_assigned_developer_id_developers_id_fk" FOREIGN KEY ("assigned_developer_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_author_id_developers_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."developers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_closes_issue_id_issues_id_fk" FOREIGN KEY ("closes_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "changed_files_path_idx" ON "changed_files" USING btree ("file_path");--> statement-breakpoint
CREATE INDEX "commits_author_idx" ON "commits" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "dev_embeddings_developer_idx" ON "developer_embeddings" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "developers_login_idx" ON "developers" USING btree ("login");--> statement-breakpoint
CREATE INDEX "recommendations_issue_idx" ON "issue_recommendations" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issues_repo_state_idx" ON "issues" USING btree ("repo_full_name","state");--> statement-breakpoint
CREATE INDEX "prs_author_idx" ON "pull_requests" USING btree ("author_id");