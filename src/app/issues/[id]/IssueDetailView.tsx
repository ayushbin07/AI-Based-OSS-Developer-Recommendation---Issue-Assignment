"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Award,
  Tag,
  Clock,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { RecommendedDeveloper } from "@/lib/services/recommendation.service";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface IssueData {
  id: number;
  githubId: number | null;
  repoFullName: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: string[] | null;
  assigneeLogin: string | null;
  githubCreatedAt: string | Date | null;
}

export interface RecommendationData {
  id: number;
  recommendations: RecommendedDeveloper[];
  provider: string;
  confirmed: boolean;
  confirmedAt: string | Date | null;
  assignedDeveloperId: number | null;
}

export function IssueDetailView({
  issue,
  initialRecommendation,
  activeProvider,
}: {
  issue: IssueData;
  initialRecommendation: RecommendationData | null;
  activeProvider: string;
}) {
  const [currentIssue, setCurrentIssue] = useState<IssueData>(issue);
  const [recommendation, setRecommendation] = useState<RecommendationData | null>(
    initialRecommendation
  );
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [assigningDevId, setAssigningDevId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "warning" | "error" | "info";
    message: string;
  } | null>(null);

  // Sync issue status and assignee live from GitHub
  const handleSyncWithGitHub = async (silent = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/issues/${currentIssue.id}/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentIssue((prev) => ({
          ...prev,
          assigneeLogin: data.assigneeLogin,
          state: data.state ?? prev.state,
        }));
        if (data.assigneeLogin) {
          setRecommendation((prev) =>
            prev
              ? {
                  ...prev,
                  confirmed: true,
                  assignedDeveloperId: data.assignedDeveloperId ?? prev.assignedDeveloperId,
                }
              : null
          );
          if (!silent) {
            setFeedback({
              type: "success",
              message: `Synced with GitHub: Issue #${currentIssue.number} is assigned to @${data.assigneeLogin}.`,
            });
          }
        } else {
          setRecommendation((prev) =>
            prev
              ? {
                  ...prev,
                  confirmed: false,
                  assignedDeveloperId: null,
                }
              : null
          );
          if (!silent) {
            setFeedback({
              type: "info",
              message: `Synced with GitHub: Issue #${currentIssue.number} is unassigned.`,
            });
          }
        }
      }
    } catch (e) {
      if (!silent) {
        console.error("Failed to sync issue with GitHub", e);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Re-check GitHub when the user returns to this window
  useEffect(() => {
    const handleWindowFocus = () => {
      handleSyncWithGitHub(true);
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [currentIssue.id]);

  // Generate or rerun recommendations
  const handleGenerateRecommendations = async () => {
    setIsLoadingRecs(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/issues/${currentIssue.id}/recommend`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Recommendation failed");
      }

      setRecommendation({
        id: data.recommendationId,
        recommendations: data.recommendations,
        provider: activeProvider,
        confirmed: false,
        confirmedAt: null,
        assignedDeveloperId: null,
      });

      setFeedback({
        type: "success",
        message: `Generated ${data.recommendations.length} developer recommendations using ${activeProvider}.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFeedback({
        type: "error",
        message: `Failed to generate recommendations: ${message}`,
      });
    } finally {
      setIsLoadingRecs(false);
    }
  };

  // Confirm assignment of a developer
  const handleConfirmAssignment = async (developerId: number, login: string) => {
    // 1. WORKAROUND: Always open the GitHub issue page immediately in a new tab!
    const ghIssueUrl = `https://github.com/${currentIssue.repoFullName}/issues/${currentIssue.number}`;
    window.open(ghIssueUrl, "_blank");

    if (!recommendation) return;

    setAssigningDevId(developerId);
    setFeedback(null);

    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendationId: recommendation.id,
          developerId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.githubAssigned) {
        // Assigned directly via GitHub API!
        setCurrentIssue((prev) => ({ ...prev, assigneeLogin: login }));
        setRecommendation((prev) =>
          prev
            ? {
                ...prev,
                confirmed: true,
                confirmedAt: new Date().toISOString(),
                assignedDeveloperId: developerId,
              }
            : null
        );
        setFeedback({
          type: "success",
          message: `Assigned @${login} to issue #${currentIssue.number} on GitHub! ${
            data.emailSent ? "Notification email sent via Resend." : ""
          }`,
        });
      } else {
        // GitHub API could not assign automatically (e.g. read-only token).
        // Tab is opened on GitHub. The assigned <dev name> will ONLY appear once assigned on GitHub.
        setFeedback({
          type: "warning",
          message: `Opened issue #${currentIssue.number} on GitHub in a new tab. Please assign @${login} on GitHub, then return here to sync.`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFeedback({
        type: "warning",
        message: `Opened issue #${currentIssue.number} on GitHub. ${message}. Please assign @${login} on GitHub.`,
      });
    } finally {
      setAssigningDevId(null);
    }
  };

  const recList = recommendation?.recommendations ?? [];
  const topCandidate = recList[0];
  const otherCandidates = recList.slice(1);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/issues"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl border-[var(--hairline)] bg-white text-[var(--ink)] hover:bg-[var(--surface-card)]")}
        >
          <ArrowLeft className="size-3.5 mr-1.5" />
          Back to Issues
        </Link>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-2.5 text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : feedback.type === "warning"
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : feedback.type === "warning" ? (
            <AlertCircle className="size-4 shrink-0 text-amber-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-red-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Issue Card */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-white shadow-sm overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-base font-bold text-[var(--muted)]">
              #{currentIssue.number}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                currentIssue.state === "open"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-stone-100 text-stone-600 border border-stone-200"
              }`}
            >
              {currentIssue.state}
            </span>
            <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--surface-card)] text-[var(--ink)] border-[var(--hairline)]">
              {currentIssue.repoFullName}
            </Badge>

            {currentIssue.assigneeLogin ? (
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold flex items-center gap-1">
                <Check className="size-3 text-emerald-600" />
                Assigned @{currentIssue.assigneeLogin}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border-stone-200 font-medium">
                Unassigned
              </Badge>
            )}

            {currentIssue.githubCreatedAt && (
              <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                <Clock className="size-3 opacity-60" />
                Opened on{" "}
                {new Date(currentIssue.githubCreatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSyncWithGitHub(false)}
              disabled={isSyncing}
              className="rounded-xl border-[var(--hairline)] bg-[var(--surface-card)] text-[var(--ink)] hover:bg-[var(--surface-soft)] text-xs font-semibold"
              title="Check GitHub for live assignee status"
            >
              <RefreshCw className={cn("size-3.5 mr-1.5", isSyncing && "animate-spin")} />
              {isSyncing ? "Checking GitHub..." : "Sync Status"}
            </Button>

            <a
              href={`https://github.com/${currentIssue.repoFullName}/issues/${currentIssue.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:underline px-3 py-1.5 rounded-xl bg-[var(--surface-card)] border border-[var(--hairline)]"
            >
              <span>GitHub Issue</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] mt-6 mb-4">
          {currentIssue.title}
        </h1>

        {/* Labels */}
        {currentIssue.labels && currentIssue.labels.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {currentIssue.labels.map((lbl) => (
              <Badge key={lbl} variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-stone-50 text-stone-700 border-stone-200">
                🏷️ {lbl}
              </Badge>
            ))}
          </div>
        )}

        {/* Issue Description Body */}
        <div className="p-5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)] text-sm text-[var(--body)] whitespace-pre-wrap break-words max-h-[380px] overflow-y-auto leading-relaxed">
          {currentIssue.body ? currentIssue.body : <em className="text-[var(--muted)]">No description provided for this issue.</em>}
        </div>
      </Card>

      {/* AI Recommendation Section */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-white shadow-sm overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-semibold text-[var(--ink)] tracking-tight">
                AI Developer Recommendations
              </h2>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--surface-card)] text-[var(--ink)] border-[var(--hairline)] font-semibold uppercase">
                {recommendation?.provider ?? activeProvider}
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              Ranked using semantic similarity (pgvector embeddings) + contributor recency + volume + expertise keywords.
            </p>
          </div>

          <Button
            onClick={handleGenerateRecommendations}
            disabled={isLoadingRecs}
            className="rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222] self-start sm:self-auto shadow-sm"
          >
            {isLoadingRecs ? (
              <>
                <span className="spinner mr-2" />
                Analyzing Issue...
              </>
            ) : recList.length > 0 ? (
              <>
                <Sparkles className="size-4 mr-2 !text-white text-white" />
                Re-calculate
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-2 !text-white text-white" />
                Generate Recommendations
              </>
            )}
          </Button>
        </div>

        {/* Confirmation banner if assigned */}
        {recommendation?.confirmed && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-sm">Assignment Confirmed!</strong>
              <div className="text-xs text-emerald-700 mt-0.5">
                Confirmed at {new Date(recommendation.confirmedAt ?? "").toLocaleString()} · GitHub issue assigned & notification sent.
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no recommendations exist */}
        {recList.length === 0 && !isLoadingRecs && (
          <div className="text-center py-14 px-6 rounded-xl bg-[var(--surface-soft)] border border-dashed border-[var(--hairline)] mt-6">
            <Sparkles className="size-10 text-[var(--muted)] mx-auto mb-3 opacity-40" />
            <h3 className="font-semibold text-base text-[var(--ink)]">No recommendations generated yet</h3>
            <p className="text-xs text-[var(--muted)] max-w-md mx-auto mt-1 mb-5 leading-relaxed">
              Click <strong>Generate Recommendations</strong> above to compare this issue&apos;s requirements against contributor embeddings and expertise tags.
            </p>
            <Button
              onClick={handleGenerateRecommendations}
              className="rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]"
            >
              <Sparkles className="size-4 mr-2 !text-white text-white" />
              Analyze & Recommend
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoadingRecs && (
          <div className="text-center py-16 px-6 mt-6 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)]">
            <span className="spinner mb-3" style={{ width: 32, height: 32 }} />
            <div className="font-semibold text-base text-[var(--ink)]">
              Embedding Issue & Matching Contributor Vectors...
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              Calling {activeProvider} to compute high-dimensional embeddings and synthesis explanation.
            </p>
          </div>
        )}

        {/* Recommendation Cards */}
        {recList.length > 0 && !isLoadingRecs && (
          <div className="flex flex-col gap-4 mt-6">
            {/* Top recommendation card (Clay Gold / Featured Card) */}
            {topCandidate && (
              <div className="p-6 rounded-2xl bg-[var(--surface-card)] border-2 border-[var(--brand-ochre)] shadow-sm flex flex-col gap-4 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-[var(--brand-ochre)] text-[var(--ink)] flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                      1
                    </div>

                    {topCandidate.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={topCandidate.avatarUrl}
                        alt={topCandidate.login}
                        width={48}
                        height={48}
                        style={{ width: 48, height: 48, minWidth: 48, minHeight: 48, objectFit: "cover", borderRadius: "9999px" }}
                        className="size-12 rounded-full border-2 border-white shadow-xs shrink-0 object-cover"
                      />
                    ) : (
                      <div
                        style={{ width: 48, height: 48 }}
                        className="size-12 rounded-full bg-white border border-[var(--hairline)] flex items-center justify-center font-bold text-sm text-[var(--ink)] shrink-0"
                      >
                        {topCandidate.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-[var(--ink)]">
                          @{topCandidate.login}
                        </span>
                        <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border-amber-300 font-semibold flex items-center gap-1">
                          <Award className="size-3" />
                          Top Match
                        </Badge>
                        {topCandidate.specialKeywords && (
                          <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border-purple-200 font-medium flex items-center gap-1">
                            <Tag className="size-3" />
                            {topCandidate.specialKeywords}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-[var(--muted)] mt-1">
                        Semantic: {topCandidate.vectorScore}% · Activity: {topCandidate.recencyScore}% · Volume: {topCandidate.volumeScore}%
                        {topCandidate.keywordScore !== undefined && topCandidate.keywordScore > 0 && (
                          <span className="font-semibold text-[var(--ink)] ml-1">
                            · Keyword Bonus: +{topCandidate.keywordScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Assign Button */}
                  <div className="sm:self-center">
                    {currentIssue.assigneeLogin === topCandidate.login ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Check className="size-3.5" />
                        Assigned @{topCandidate.login}
                      </span>
                    ) : (
                      <Button
                        onClick={() =>
                          handleConfirmAssignment(
                            topCandidate.developerId,
                            topCandidate.login
                          )
                        }
                        disabled={assigningDevId === topCandidate.developerId}
                        className="rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]"
                      >
                        {assigningDevId === topCandidate.developerId ? (
                          <span className="spinner mr-2" />
                        ) : (
                          "Assign Developer"
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Score Progress Bar */}
                <div className="flex flex-col gap-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--ink)]">
                    <span>Overall Match Score</span>
                    <span className="text-base font-bold">{topCandidate.score}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-[var(--hairline)]">
                    <div
                      className="h-full bg-[var(--ink)] rounded-full transition-all duration-500"
                      style={{ width: `${topCandidate.score}%` }}
                    />
                  </div>
                </div>

                {/* Reason Explanation */}
                {topCandidate.reason && (
                  <div className="p-3.5 rounded-xl bg-white/80 border border-[var(--hairline)] text-xs text-[var(--body)] italic leading-relaxed">
                    &ldquo;{topCandidate.reason}&rdquo;
                  </div>
                )}
              </div>
            )}

            {/* Other Candidates */}
            {otherCandidates.map((candidate, idx) => {
              const rank = idx + 2;
              const isAssigned = currentIssue.assigneeLogin === candidate.login;

              return (
                <div
                  key={candidate.developerId}
                  className="p-5 rounded-2xl border border-[var(--hairline)] bg-white hover:border-[var(--ink)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="size-8 rounded-full bg-[var(--surface-card)] text-[var(--muted)] flex items-center justify-center font-bold text-xs shrink-0 border border-[var(--hairline)]">
                      {rank}
                    </div>

                    {candidate.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.avatarUrl}
                        alt={candidate.login}
                        width={40}
                        height={40}
                        style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, objectFit: "cover", borderRadius: "9999px" }}
                        className="size-10 rounded-full border border-[var(--hairline)] shrink-0 object-cover"
                      />
                    ) : (
                      <div
                        style={{ width: 40, height: 40 }}
                        className="size-10 rounded-full bg-[var(--surface-card)] border border-[var(--hairline)] flex items-center justify-center font-bold text-xs text-[var(--ink)] shrink-0"
                      >
                        {candidate.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--ink)]">
                          @{candidate.login}
                        </span>
                        {candidate.specialKeywords && (
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border-purple-200">
                            🏷️ {candidate.specialKeywords}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] mt-0.5">
                        Semantic: {candidate.vectorScore}% · Activity: {candidate.recencyScore}% · Volume: {candidate.volumeScore}%
                        {candidate.keywordScore !== undefined && candidate.keywordScore > 0 && (
                          <span className="font-semibold text-[var(--ink)] ml-1">
                            · Keyword: {candidate.keywordScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 self-end sm:self-center">
                    <div className="flex flex-col items-end gap-1 min-w-[100px]">
                      <span className="text-xs font-bold text-[var(--ink)]">{candidate.score}% Match</span>
                      <div className="h-1.5 w-24 bg-[var(--surface-card)] rounded-full overflow-hidden border border-[var(--hairline)]">
                        <div
                          className="h-full bg-[var(--ink)] rounded-full"
                          style={{ width: `${candidate.score}%` }}
                        />
                      </div>
                    </div>

                    {isAssigned ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <Check className="size-3" /> Assigned @{candidate.login}
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleConfirmAssignment(
                            candidate.developerId,
                            candidate.login
                          )
                        }
                        disabled={assigningDevId === candidate.developerId}
                        className="rounded-xl border-[var(--hairline)] text-xs font-semibold hover:bg-[var(--surface-card)]"
                      >
                        {assigningDevId === candidate.developerId ? (
                          <span className="spinner" />
                        ) : (
                          "Assign"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
