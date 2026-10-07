"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRepo } from "@/context/RepoContext";
import {
  Search,
  Bug,
  Users,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface IssueItem {
  id: number;
  number: number;
  repoFullName: string;
  title: string;
  body: string | null;
  state: string;
  labels: string[] | null;
  assigneeLogin: string | null;
  githubCreatedAt: string | Date | null;
  hasRecommendation: boolean;
  recommendationConfirmed: boolean;
}

export function IssuesList({
  initialIssues = [],
  initialRepo = "",
}: {
  initialIssues?: IssueItem[];
  initialRepo?: string;
}) {
  const { selectedRepo } = useRepo();
  const activeRepo = selectedRepo || initialRepo || "";

  const [issues, setIssues] = useState<IssueItem[]>(initialIssues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "open" | "closed">("all");
  const [recFilter, setRecFilter] = useState<"all" | "assigned" | "recommended" | "none">("all");

  // Re-fetch issues whenever activeRepo changes
  useEffect(() => {
    if (!activeRepo) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/issues?repo=${encodeURIComponent(activeRepo)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || errData.error || "Failed to load issues");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setIssues(data.issues ?? []);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          console.error("[IssuesList] Fetch error:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeRepo]);

  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      // Search text
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesNumber = String(issue.number).includes(query);
        const matchesLabels = issue.labels?.some((l) => l.toLowerCase().includes(query)) ?? false;
        if (!matchesTitle && !matchesNumber && !matchesLabels) return false;
      }

      // State filter
      if (stateFilter !== "all" && issue.state !== stateFilter) {
        return false;
      }

      // Recommendation filter
      if (recFilter === "assigned") {
        if (!issue.assigneeLogin) return false;
      } else if (recFilter === "recommended") {
        if (!issue.hasRecommendation || issue.assigneeLogin) return false;
      } else if (recFilter === "none") {
        if (issue.hasRecommendation || issue.assigneeLogin) return false;
      }

      return true;
    });
  }, [issues, search, stateFilter, recFilter]);

  const counts = useMemo(() => {
    return {
      total: issues.length,
      open: issues.filter((i) => i.state === "open").length,
      assigned: issues.filter((i) => Boolean(i.assigneeLogin)).length,
      recommended: issues.filter((i) => i.hasRecommendation && !i.assigneeLogin).length,
    };
  }, [issues]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
              GitHub Issues
            </h1>
            {loading && (
              <span className="spinner" title="Fetching issues..." />
            )}
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">
            {activeRepo
              ? `Review issues for ${activeRepo}, generate AI developer recommendations, and confirm assignments.`
              : "Review repository issues, generate AI developer recommendations, and confirm assignments."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={activeRepo ? `/developers?repo=${encodeURIComponent(activeRepo)}` : "/developers"}
            className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-[var(--hairline)] bg-white text-[var(--ink)] hover:bg-[var(--surface-card)]")}
          >
            <Users className="size-4 mr-1.5" />
            Contributors
          </Link>
          <Link
            href={activeRepo ? `/sync?repo=${encodeURIComponent(activeRepo)}` : "/sync"}
            className={cn(buttonVariants(), "rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]")}
          >
            <RefreshCw className="size-4 mr-1.5 !text-white text-white" />
            Sync Data
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Clay Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card stat-card-white">
          <span className="stat-label">Total Issues</span>
          <span className="stat-value">{counts.total}</span>
          <span className="stat-sub">in local database</span>
        </div>
        <div className="stat-card stat-card-white">
          <span className="stat-label">Open Issues</span>
          <span className="stat-value text-emerald-600">{counts.open}</span>
          <span className="stat-sub">ready for triage</span>
        </div>
        <div className="stat-card stat-card-white">
          <span className="stat-label">AI Recommended</span>
          <span className="stat-value text-indigo-600">{counts.recommended}</span>
          <span className="stat-sub">pending human sign-off</span>
        </div>
        <div className="stat-card stat-card-white">
          <span className="stat-label">Assigned</span>
          <span className="stat-value text-amber-600">{counts.assigned}</span>
          <span className="stat-sub">confirmed to developer</span>
        </div>
      </div>

      {/* Filter and Search Controls (Clay Style) */}
      <div className="clay-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-3.5 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search by title, #number, or label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)] text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)] focus:bg-white transition-all h-[42px]"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* State Filter Tabs */}
          <div className="flex items-center p-1 rounded-full bg-[var(--surface-soft)] border border-[var(--hairline)]">
            {(["all", "open", "closed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStateFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                  stateFilter === s
                    ? "bg-[var(--ink)] !text-white text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Recommendation Filter Tabs */}
          <div className="flex items-center p-1 rounded-full bg-[var(--surface-soft)] border border-[var(--hairline)]">
            {(
              [
                { id: "all", label: "All" },
                { id: "recommended", label: "AI Ready" },
                { id: "assigned", label: "Assigned" },
                { id: "none", label: "Unprocessed" },
              ] as const
            ).map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRecFilter(rf.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  recFilter === rf.id
                    ? "bg-[var(--ink)] !text-white text-white shadow-xs"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Issues List or Empty State */}
      {issues.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[var(--hairline)] shadow-sm">
          <Bug className="size-12 text-[var(--muted)] mx-auto mb-3 opacity-30" />
          <h3 className="font-semibold text-lg text-[var(--ink)]">
            No issues found for {activeRepo || "this repository"}
          </h3>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto mt-1 mb-6 leading-relaxed">
            Your local database currently has 0 issues recorded for <strong>{activeRepo || "this repository"}</strong>.
            Run a GitHub sync to import its issues and contributor activity.
          </p>
          <Link
            href={activeRepo ? `/sync?repo=${encodeURIComponent(activeRepo)}` : "/sync"}
            className={cn(buttonVariants(), "rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]")}
          >
            <RefreshCw className="size-4 mr-2 !text-white text-white" />
            Sync {activeRepo || "Repository"} Data
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[var(--hairline)] shadow-sm">
          <Filter className="size-12 text-[var(--muted)] mx-auto mb-3 opacity-30" />
          <h3 className="font-semibold text-lg text-[var(--ink)]">No matching issues found</h3>
          <p className="text-sm text-[var(--muted)] mt-1">
            Try adjusting your search query or status filter pills above.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((issue) => {
            const isAssigned = Boolean(issue.assigneeLogin);
            const hasRec = issue.hasRecommendation;

            return (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="flex items-center justify-between p-4 px-5 rounded-2xl border border-[var(--hairline)] bg-white hover:border-[var(--ink)] hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <span className="font-mono text-xs font-semibold text-[var(--muted)] group-hover:text-[var(--ink)] min-w-[48px]">
                    #{issue.number}
                  </span>
                  <div className="overflow-hidden">
                    <div className="text-sm font-semibold text-[var(--ink)] truncate group-hover:underline">
                      {issue.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--surface-card)] text-[var(--ink)] border-[var(--hairline)]">
                        {issue.repoFullName}
                      </Badge>

                      {issue.labels?.slice(0, 4).map((label) => (
                        <Badge key={label} variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-stone-50 text-stone-600 border-stone-200">
                          {label}
                        </Badge>
                      ))}

                      {issue.githubCreatedAt && (
                        <span className="text-[11px] text-[var(--muted)] flex items-center gap-1 ml-1">
                          <Clock className="size-3 opacity-60" />
                          {new Date(issue.githubCreatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {/* Status Indicator */}
                  {isAssigned ? (
                    <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 font-medium flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      <span>Assigned {issue.assigneeLogin ? `@${issue.assigneeLogin}` : ""}</span>
                    </Badge>
                  ) : hasRec ? (
                    <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 font-medium flex items-center gap-1">
                      <Sparkles className="size-3" />
                      <span>AI Ready</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-500 border-stone-200 font-medium">
                      Unprocessed
                    </Badge>
                  )}

                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                      issue.state === "open"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {issue.state}
                  </span>

                  <ArrowRight className="size-4 text-[var(--muted)] group-hover:text-[var(--ink)] group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
