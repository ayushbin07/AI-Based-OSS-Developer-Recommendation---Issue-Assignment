/**
 * GitHub module index
 *
 * Re-exports the GitHub client and types.
 */

export { GitHubClient, getGitHubClient } from "./client";
export type {
  GitHubContributor,
  GitHubIssue,
  GitHubPR,
  GitHubCommit,
} from "./client";
