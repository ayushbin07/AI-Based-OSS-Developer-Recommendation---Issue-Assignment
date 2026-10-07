"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RepoSelector } from "@/components/RepoSelector";
import { useRepo } from "@/context/RepoContext";
import {
  RefreshCw,
  Database,
  Cpu,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  GitPullRequest,
  Bug,
  Users,
  Radio,
  ArrowRight
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SyncStats {
  devCount: number;
  issueCount: number;
  prCount: number;
  commitCount: number;
  embCount: number;
}

interface SyncSummary {
  developers: number;
  issues: number;
  pullRequests: number;
  commits: number;
  embeddingsUpdated: number;
  errors: string[];
}

export function SyncView({
  repoOwner,
  repoName,
  provider,
  initialStats,
}: {
  repoOwner: string;
  repoName: string;
  provider: string;
  initialStats: SyncStats;
}) {
  const router = useRouter();
  const { selectedRepo } = useRepo();
  const activeRepo = selectedRepo || `${repoOwner}/${repoName}`;

  const [stats, setStats] = useState<SyncStats>(initialStats);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch fresh stats whenever activeRepo changes
  useEffect(() => {
    if (!activeRepo) return;
    let isMounted = true;
    fetch(`/api/sync?repo=${encodeURIComponent(activeRepo)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data) => {
        if (isMounted) setStats(data);
      })
      .catch((err) => {
        console.warn("[SyncView] Failed to refresh stats for", activeRepo, err);
      });
    return () => {
      isMounted = false;
    };
  }, [activeRepo]);

  const handleRunSync = async () => {
    setIsSyncing(true);
    setErrorMsg(null);
    setClearMsg(null);
    setSyncSummary(null);
    setCurrentStep(`Collecting contributors, issues, PRs, and commits for ${activeRepo}...`);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: activeRepo }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Sync failed");
      }

      const collection = data.collection ?? {};
      const embeddings = data.embeddings ?? {};

      const summary: SyncSummary = {
        developers: collection.developers ?? 0,
        issues: collection.issues ?? 0,
        pullRequests: collection.pullRequests ?? 0,
        commits: collection.commits ?? 0,
        embeddingsUpdated: embeddings.updated ?? 0,
        errors: [...(collection.errors ?? []), ...(embeddings.errors ?? [])],
      };

      setSyncSummary(summary);
      setCurrentStep("Synchronization complete!");

      // Update displayed counts directly from true DB stats
      if (data.stats) {
        setStats(data.stats);
      } else {
        try {
          const statsRes = await fetch(`/api/sync?repo=${encodeURIComponent(activeRepo)}`);
          if (statsRes.ok) {
            const freshStats = await statsRes.json();
            setStats(freshStats);
          }
        } catch {
          // Keep stats as is
        }
      }

      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Sync failed: ${message}`);
      setCurrentStep(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearRepoData = async () => {
    if (
      !window.confirm(
        `Are you sure you want to remove all cached database data for ${activeRepo}? This will delete all its issues, recommendations, pull requests, and commits from the local PostgreSQL database.`
      )
    ) {
      return;
    }

    setIsClearing(true);
    setErrorMsg(null);
    setClearMsg(null);
    setSyncSummary(null);

    try {
      const res = await fetch(`/api/repos?repo=${encodeURIComponent(activeRepo)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to clear repository data");
      }

      setClearMsg(`Successfully cleared all cached data for ${activeRepo}.`);
      setStats({
        devCount: 0,
        issueCount: 0,
        prCount: 0,
        commitCount: 0,
        embCount: 0,
      });

      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Failed to clear data: ${message}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
            Sync GitHub Data
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Ingest repository issues, commit activities, and generate vector embeddings for intelligent recommendation.
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--hairline)] mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)] tracking-tight">
              Repository & AI Engine Configuration
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Active repository scope and embedding model settings
            </p>
          </div>
          <Badge variant="outline" className="text-xs px-3 py-1 rounded-full bg-[var(--surface-card)] text-[var(--ink)] font-semibold uppercase">
            Provider: {provider}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Target Repository
              </span>
              <div className="mt-2">
                <RepoSelector />
              </div>
            </div>
            <a
              href={`https://github.com/${activeRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[var(--ink)] hover:underline inline-flex items-center gap-1 mt-3"
            >
              <span>Open on GitHub</span>
              <ExternalLink className="size-3" />
            </a>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Active AI Engine
              </span>
              <div className="text-base font-bold text-[var(--ink)] capitalize mt-1 flex items-center gap-2">
                <Cpu className="size-4 text-[var(--ink)]" />
                {provider}
              </div>
            </div>
            <span className="text-xs text-[var(--muted)] mt-2">
              {provider === "google" ? "Google Gemini text-embedding" : "Local Ollama embeddings"}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Vector Database
              </span>
              <div className="text-base font-bold text-emerald-800 mt-1 flex items-center gap-2">
                <Database className="size-4 text-emerald-600" />
                pgvector (PostgreSQL)
              </div>
            </div>
            <span className="text-xs text-[var(--muted)] mt-2">
              Cosine distance index (<code className="text-[11px]">&lt;=&gt;</code>)
            </span>
          </div>
        </div>
      </Card>

      {/* Database Stats Overview */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-3">
          Current Database Records for {activeRepo}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="stat-card stat-card-white">
            <span className="stat-label flex items-center gap-1">
              <Users className="size-3" /> Contributors
            </span>
            <span className="stat-value">{stats.devCount}</span>
            <span className="stat-sub">in developers table</span>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label flex items-center gap-1">
              <Bug className="size-3" /> Issues
            </span>
            <span className="stat-value">{stats.issueCount}</span>
            <span className="stat-sub">open & closed</span>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label flex items-center gap-1">
              <GitPullRequest className="size-3" /> Pull Requests
            </span>
            <span className="stat-value">{stats.prCount}</span>
            <span className="stat-sub">authored in repo</span>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label flex items-center gap-1">
              <GitCommit className="size-3" /> Commits
            </span>
            <span className="stat-value">{stats.commitCount}</span>
            <span className="stat-sub">with diff records</span>
          </div>
          <div className="stat-card stat-card-white">
            <span className="stat-label flex items-center gap-1">
              <Cpu className="size-3" /> Embeddings
            </span>
            <span className="stat-value text-emerald-600">{stats.embCount}</span>
            <span className="stat-sub">vectorized profiles</span>
          </div>
        </div>
      </div>

      {/* Sync Execution Card (Clay primary interaction) */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--ink)] tracking-tight">
              Execute Synchronization
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-lg">
              Fetches all latest repository data from GitHub via Octokit and regenerates developer profile embeddings for matching.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={handleClearRepoData}
              disabled={isSyncing || isClearing}
              className="rounded-xl border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
              title="Delete all cached data for this repo from the database"
            >
              <Trash2 className="size-3.5 mr-1.5" />
              {isClearing ? "Clearing..." : "Clear Repo Data"}
            </Button>

            <Button
              onClick={handleRunSync}
              disabled={isSyncing || isClearing}
              className="rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222] min-w-[150px]"
            >
              {isSyncing ? (
                <>
                  <span className="spinner mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5 mr-1.5 !text-white text-white" />
                  Run Full Sync
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Clear success alert */}
        {clearMsg && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <span>{clearMsg}</span>
          </div>
        )}

        {/* Sync Progress / Status */}
        {isSyncing && (
          <div className="mt-4 p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--hairline)] flex items-center gap-3.5">
            <span className="spinner shrink-0" style={{ width: 22, height: 22 }} />
            <div>
              <div className="font-semibold text-sm text-[var(--ink)]">
                {currentStep}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                Fetching commits, PRs, issues and computing pgvector embeddings.
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success summary */}
        {syncSummary && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">Synchronization completed successfully!</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Contributors</span>
                <div className="text-lg font-bold text-[var(--ink)] mt-0.5">{syncSummary.developers}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Issues</span>
                <div className="text-lg font-bold text-[var(--ink)] mt-0.5">{syncSummary.issues}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">PRs</span>
                <div className="text-lg font-bold text-[var(--ink)] mt-0.5">{syncSummary.pullRequests}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Commits</span>
                <div className="text-lg font-bold text-[var(--ink)] mt-0.5">{syncSummary.commits}</div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Vectors</span>
                <div className="text-lg font-bold text-emerald-700 mt-0.5">{syncSummary.embeddingsUpdated}</div>
              </div>
            </div>

            {syncSummary.errors.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <div className="font-semibold mb-1">Sync warnings:</div>
                <ul className="list-disc pl-4 space-y-1">
                  {syncSummary.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/issues"
                className={cn(buttonVariants(), "rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]")}
              >
                View Issues & Recommendations <ArrowRight className="size-4 ml-1.5 !text-white text-white" />
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* Webhook Setup Guide */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-[var(--surface-card)] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="size-4 text-[var(--ink)]" />
          <h2 className="text-base font-semibold text-[var(--ink)]">
            Automated Webhook Ingestion
          </h2>
        </div>
        <p className="text-xs text-[var(--body)] mb-4 leading-relaxed">
          To automatically generate recommendations as soon as a new issue is filed on GitHub:
        </p>

        <ol className="flex flex-col gap-2 pl-5 text-xs text-[var(--body)] list-decimal leading-relaxed">
          <li>Go to GitHub: <code className="bg-white px-1.5 py-0.5 rounded border border-[var(--hairline)]">https://github.com/{activeRepo}/settings/hooks</code></li>
          <li>Click <strong>Add webhook</strong></li>
          <li>Set <strong>Payload URL</strong> to <code className="bg-white px-1.5 py-0.5 rounded border border-[var(--hairline)]">https://your-domain.com/api/webhooks/github</code></li>
          <li>Set <strong>Content type</strong> to <code className="bg-white px-1.5 py-0.5 rounded border border-[var(--hairline)]">application/json</code></li>
          <li>Configure secret key to match <code className="bg-white px-1.5 py-0.5 rounded border border-[var(--hairline)]">GITHUB_WEBHOOK_SECRET</code></li>
          <li>Check the <strong>Issues</strong> event trigger and click <strong>Add webhook</strong></li>
        </ol>
      </Card>
    </div>
  );
}
