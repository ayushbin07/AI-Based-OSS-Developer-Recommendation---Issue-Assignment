"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRepo } from "@/context/RepoContext";
import {
  Users,
  Bug,
  Cpu,
  Sparkles,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  FolderGit2
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardStats {
  devCount: number;
  issueCount: number;
  embCount: number;
  recCount: number;
  recentIssues: Array<{
    id: number;
    number: number;
    title: string;
    state: string;
    labels: string[] | null;
    repoFullName: string;
    createdAt: string | Date | null;
  }>;
  dbConnected: boolean;
}

export function DashboardView({
  initialStats,
  initialRepo,
}: {
  initialStats: DashboardStats;
  initialRepo?: string;
}) {
  const { selectedRepo } = useRepo();
  const activeRepo = selectedRepo || initialRepo || "";

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeRepo) return;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/dashboard?repo=${encodeURIComponent(activeRepo)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dashboard data");
        return res.json();
      })
      .then((data: DashboardStats) => {
        if (isMounted) {
          setStats(data);
        }
      })
      .catch((err) => {
        console.warn("[DashboardView] Failed to fetch stats for", activeRepo, err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeRepo]);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
              Dashboard
            </h1>
            {loading && (
              <span className="spinner" title="Refreshing statistics..." />
            )}
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">
            {activeRepo
              ? `Overview for ${activeRepo} repository activity and developer recommendations.`
              : "Overview of your repository data and AI recommendation activity."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={activeRepo ? `/developers?repo=${encodeURIComponent(activeRepo)}` : "/developers"}
            className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-[var(--hairline)] bg-white text-[var(--ink)] hover:bg-[var(--surface-card)]")}
          >
            <Users className="size-4 mr-1.5 text-[var(--ink)]" />
            Contributors
          </Link>
          <Link
            href={activeRepo ? `/sync?repo=${encodeURIComponent(activeRepo)}` : "/sync"}
            className={cn(buttonVariants(), "rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222222]")}
          >
            <RefreshCw className="size-4 mr-1.5 !text-white text-white" />
            Sync GitHub Data
          </Link>
        </div>
      </div>

      {/* Database Warning Banner */}
      {!stats.dbConnected && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-sm">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">PostgreSQL database is currently offline or unreachable.</strong>
            <p className="text-xs text-amber-700 mt-1">
              To start PostgreSQL with pgvector, run:{" "}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
                docker run -d -e POSTGRES_PASSWORD=password -p 5432:5432 pgvector/pgvector:pg16
              </code>{" "}
              and then <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">npm run db:push</code>.
            </p>
          </div>
        </div>
      )}

      {/* Target Repo Banner (Clay style card) */}
      {activeRepo && (
        <div className="flex items-center justify-between p-4.5 px-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--surface-strong)] shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-white border border-[var(--hairline)] flex items-center justify-center text-[var(--ink)] shadow-xs">
              <FolderGit2 className="size-5" />
            </div>
            <div>
              <div className="font-semibold text-base text-[var(--ink)] tracking-tight">
                {activeRepo}
              </div>
              <div className="text-xs text-[var(--muted)]">
                Scoped analytics and intelligence for active repository
              </div>
            </div>
          </div>

          <a
            href={`https://github.com/${activeRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)] hover:underline px-3 py-1.5 rounded-lg bg-white border border-[var(--hairline)] transition-all shadow-xs"
          >
            <span>Open on GitHub</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      )}

      {/* Saturated Feature Stat Cards (The signature Clay design aesthetic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Developers (Peach) */}
        <div className="feature-card-peach flex flex-col justify-between min-h-[140px] transition-transform hover:-translate-y-1 duration-150">
          <div className="flex items-center justify-between text-[var(--ink)]">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">
              Developers
            </span>
            <Users className="size-5 opacity-70" />
          </div>
          <div>
            <div className="text-4xl font-extrabold tracking-tight text-[var(--ink)]">
              {stats.devCount}
            </div>
            <div className="text-xs text-[var(--ink)] font-medium opacity-75 mt-1">
              active contributors in repository
            </div>
          </div>
        </div>

        {/* Card 2: Issues (Pink) */}
        <div className="feature-card-pink flex flex-col justify-between min-h-[140px] transition-transform hover:-translate-y-1 duration-150">
          <div className="flex items-center justify-between text-white">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90">
              Issues
            </span>
            <Bug className="size-5 opacity-80" />
          </div>
          <div>
            <div className="text-4xl font-extrabold tracking-tight text-white">
              {stats.issueCount}
            </div>
            <div className="text-xs text-white font-medium opacity-85 mt-1">
              ingested from GitHub issues
            </div>
          </div>
        </div>

        {/* Card 3: Embeddings (Lavender) */}
        <div className="feature-card-lavender flex flex-col justify-between min-h-[140px] transition-transform hover:-translate-y-1 duration-150">
          <div className="flex items-center justify-between text-[var(--ink)]">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">
              Embeddings
            </span>
            <Cpu className="size-5 opacity-70" />
          </div>
          <div>
            <div className="text-4xl font-extrabold tracking-tight text-[var(--ink)]">
              {stats.embCount}
            </div>
            <div className="text-xs text-[var(--ink)] font-medium opacity-75 mt-1">
              contributors vectorized for matching
            </div>
          </div>
        </div>

        {/* Card 4: Recommendations (Ochre) */}
        <div className="feature-card-ochre flex flex-col justify-between min-h-[140px] transition-transform hover:-translate-y-1 duration-150">
          <div className="flex items-center justify-between text-[var(--ink)]">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">
              Recommendations
            </span>
            <Sparkles className="size-5 opacity-70" />
          </div>
          <div>
            <div className="text-4xl font-extrabold tracking-tight text-[var(--ink)]">
              {stats.recCount}
            </div>
            <div className="text-xs text-[var(--ink)] font-medium opacity-75 mt-1">
              AI ranking assignments recorded
            </div>
          </div>
        </div>
      </div>

      {/* Recent Issues Card */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-white shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--hairline)] pb-4 px-6 pt-5">
          <div>
            <CardTitle className="text-lg font-semibold text-[var(--ink)] tracking-tight">
              Recent Issues
            </CardTitle>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Latest tasks collected for AI assignment and triaging
            </p>
          </div>
          <Link
            href={activeRepo ? `/issues?repo=${encodeURIComponent(activeRepo)}` : "/issues"}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-xl text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-card)]")}
          >
            View All <ArrowRight className="size-3.5 ml-1" />
          </Link>
        </CardHeader>

        <CardContent className="p-6">
          {stats.recentIssues.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl bg-[var(--surface-soft)] border border-dashed border-[var(--hairline)]">
              <Bug className="size-10 text-[var(--muted)] mx-auto mb-3 opacity-40" />
              <div className="font-semibold text-base text-[var(--ink)] mb-1">
                {activeRepo ? `No issues synced yet for ${activeRepo}` : "No issues yet"}
              </div>
              <p className="text-xs text-[var(--muted)] max-w-sm mx-auto mb-5 leading-relaxed">
                {activeRepo
                  ? "Run a sync to import GitHub issues and begin generating AI developer recommendations."
                  : "Select a repository and run a sync to import your issues."}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link
                  href={activeRepo ? `/developers?repo=${encodeURIComponent(activeRepo)}` : "/developers"}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl bg-white border-[var(--hairline)]")}
                >
                  <Users className="size-3.5 mr-1.5" />
                  Contributors
                </Link>
                <Link
                  href={activeRepo ? `/sync?repo=${encodeURIComponent(activeRepo)}` : "/sync"}
                  className={cn(buttonVariants({ size: "sm" }), "rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]")}
                >
                  <RefreshCw className="size-3.5 mr-1.5 !text-white text-white" />
                  Go to Sync
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {stats.recentIssues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="flex items-center justify-between p-3.5 px-4 rounded-xl border border-[var(--hairline)] bg-white hover:border-[var(--ink)] hover:bg-[var(--surface-soft)] transition-all group shadow-2xs"
                >
                  <div className="flex items-center gap-3.5 overflow-hidden">
                    <span className="font-mono text-xs font-semibold text-[var(--muted)] group-hover:text-[var(--ink)] min-w-[44px]">
                      #{issue.number}
                    </span>
                    <div className="overflow-hidden">
                      <div className="text-sm font-semibold text-[var(--ink)] truncate group-hover:underline">
                        {issue.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-card)] text-[var(--ink)] border-[var(--hairline)]">
                          {issue.repoFullName}
                        </Badge>
                        {issue.labels?.slice(0, 3).map((label) => (
                          <Badge key={label} variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-stone-50 text-stone-600 border-stone-200">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        issue.state === "open"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-stone-100 text-stone-600 border border-stone-200"
                      }`}
                    >
                      {issue.state}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Getting Started Guide (when 0 issues/devs) */}
      {stats.issueCount === 0 && stats.devCount === 0 && (
        <Card className="rounded-2xl border-[var(--hairline)] bg-[var(--surface-card)] p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="size-8 rounded-lg bg-[var(--ink)] text-white flex items-center justify-center text-sm font-bold">
              ✦
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--ink)]">Quick Start Workflow</h2>
              <p className="text-xs text-[var(--muted)]">Follow these steps to power up automated developer matching</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
            {[
              { num: "01", title: "Select Repo", desc: "Choose the target GitHub repository from the topbar dropdown." },
              { num: "02", title: "Sync Data", desc: "Run Sync to fetch contributors, issues, PRs, and commit history." },
              { num: "03", title: "Vectors", desc: "Embeddings generate automatically to profile developer domain skills." },
              { num: "04", title: "Keywords", desc: "Optionally tag contributors with special expertise keywords." },
              { num: "05", title: "Recommend", desc: "Open any issue and let the AI find the optimal assignees!" },
            ].map((step) => (
              <div key={step.num} className="p-4 rounded-xl bg-white border border-[var(--hairline)] flex flex-col gap-2">
                <span className="font-mono text-xs font-bold text-[var(--muted)] bg-[var(--surface-card)] w-fit px-2 py-0.5 rounded-full">
                  Step {step.num}
                </span>
                <span className="font-semibold text-xs text-[var(--ink)]">{step.title}</span>
                <span className="text-[11px] text-[var(--muted)] leading-relaxed">{step.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
