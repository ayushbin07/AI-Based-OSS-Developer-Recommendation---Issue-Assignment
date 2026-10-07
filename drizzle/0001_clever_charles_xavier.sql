ALTER TABLE "developers" ALTER COLUMN "github_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "github_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "pull_requests" ALTER COLUMN "github_id" SET DATA TYPE bigint;