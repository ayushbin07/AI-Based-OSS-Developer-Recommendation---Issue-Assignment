"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RepoSelector } from "@/components/RepoSelector";
import { useRepo } from "@/context/RepoContext";
import {
  Users,
  ExternalLink,
  RefreshCw,
  GitCommit,
  GitPullRequest,
  Tag,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  Edit2,
  Check,
  X
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RepoDeveloper {
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

export function DevelopersView({
  initialRepo,
}: {
  initialRepo?: string;
}) {
  const searchParams = useSearchParams();
  const { selectedRepo } = useRepo();

  const activeRepo = selectedRepo || searchParams.get("repo") || initialRepo || "";

  const [developers, setDevelopers] = useState<RepoDeveloper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Keyword editing state
  const [editingDevLogin, setEditingDevLogin] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState<string>("");
  const [savingKeywords, setSavingKeywords] = useState<boolean>(false);
  const [keywordSuccessMsg, setKeywordSuccessMsg] = useState<string | null>(null);

  const startEditingKeywords = (dev: RepoDeveloper) => {
    setEditingDevLogin(dev.login);
    setKeywordInput(dev.specialKeywords || "");
  };

  const cancelEditingKeywords = () => {
    setEditingDevLogin(null);
    setKeywordInput("");
  };

  const handleSaveKeywords = async (dev: RepoDeveloper) => {
    setSavingKeywords(true);
    setError(null);
    try {
      const res = await fetch("/api/developers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerId: dev.dbId,
          login: dev.login,
          specialKeywords: keywordInput,
          repo: activeRepo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update keywords");
      }

      setDevelopers((prev) =>
        prev.map((d) =>
          d.login === dev.login
            ? {
                ...d,
                specialKeywords: keywordInput.trim() || null,
                dbId: data.developer?.id ?? d.dbId,
                syncedInDb: true,
              }
            : d
        )
      );

      setEditingDevLogin(null);
      setKeywordSuccessMsg(`Updated special keywords for @${dev.login}`);
      setTimeout(() => setKeywordSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingKeywords(false);
    }
  };

  useEffect(() => {
    if (!activeRepo) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSyncSuccess(null);

    async function fetchDevelopers() {
      try {
        const res = await fetch(`/api/developers?repo=${encodeURIComponent(activeRepo)}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || errData.error || "Failed to load developers");
        }
        const data = await res.json();
        if (isMounted) {
          setDevelopers(data.developers ?? []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDevelopers();

    return () => {
      isMounted = false;
    };
  }, [activeRepo]);

  const handleSyncCurrentRepo = async () => {
    if (!activeRepo) return;
    setSyncing(true);
    setSyncSuccess(null);
    setError(null);

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

      setSyncSuccess(`Successfully synced ${activeRepo}! Generated ${data.embeddings?.updated ?? 0} embeddings.`);

      // Re-fetch developers to refresh badges
      const devRes = await fetch(`/api/developers?repo=${encodeURIComponent(activeRepo)}`);
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevelopers(devData.developers ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
            Developers & Contributors
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Browse real contributors who have pushed code or authored PRs for any repository in your GitHub account.
          </p>
        </div>
      </div>

      {/* Repository Selection & Action Bar (Clay Style) */}
      <Card className="rounded-2xl border-[var(--hairline)] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Repository Scope
            </span>
            <div className="w-full sm:w-auto">
              <RepoSelector />
            </div>
          </div>

          {activeRepo && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <a
                href={`https://github.com/${activeRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "rounded-xl border-[var(--hairline)] bg-white text-[var(--ink)] hover:bg-[var(--surface-card)]")}
              >
                <ExternalLink className="size-3.5 mr-1.5" />
                GitHub Repository
              </a>

              <Button
                onClick={handleSyncCurrentRepo}
                disabled={syncing}
                className="rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]"
              >
                {syncing ? (
                  <>
                    <span className="spinner mr-2" style={{ width: 14, height: 14 }} />
                    Syncing Repo...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-3.5 mr-1.5" />
                    Sync This Repo
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Sync Success / Error Alert */}
      {syncSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{syncSuccess}</span>
        </div>
      )}

      {keywordSuccessMsg && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-sm flex items-center gap-2">
          <Tag className="size-4 text-purple-600 shrink-0" />
          <span>{keywordSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {!activeRepo ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[var(--hairline)] shadow-sm">
          <FolderGit2 className="size-12 text-[var(--muted)] mx-auto mb-3 opacity-30" />
          <h3 className="font-semibold text-lg text-[var(--ink)]">No repository selected</h3>
          <p className="text-sm text-[var(--muted)] max-w-sm mx-auto mt-1">
            Choose a repository from the selector above to view all developers who have contributed code.
          </p>
        </div>
      ) : loading ? (
        <div className="text-center py-20 px-6 rounded-2xl bg-white border border-[var(--hairline)] shadow-sm">
          <span className="spinner mb-3" style={{ width: 32, height: 32 }} />
          <div className="font-medium text-sm text-[var(--ink)]">
            Fetching contributors from GitHub for <strong>{activeRepo}</strong>...
          </div>
        </div>
      ) : developers.length === 0 ? (
        <div className="text-center py-16 px-6 rounded-2xl bg-white border border-[var(--hairline)] shadow-sm">
          <Users className="size-12 text-[var(--muted)] mx-auto mb-3 opacity-30" />
          <h3 className="font-semibold text-lg text-[var(--ink)]">No contributors found</h3>
          <p className="text-sm text-[var(--muted)] max-w-sm mx-auto mt-1 mb-6">
            No contributor activity found on GitHub for <strong>{activeRepo}</strong> yet.
          </p>
          <Button onClick={handleSyncCurrentRepo} disabled={syncing} className="rounded-xl bg-[var(--ink)] !text-white text-white hover:bg-[#222]">
            <RefreshCw className="size-3.5 mr-1.5 !text-white text-white" />
            Run First Sync
          </Button>
        </div>
      ) : (
        <>
          {/* Header count summary */}
          <div className="flex items-center justify-between pb-1">
            <div className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
              <span>Contributors for {activeRepo}</span>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--surface-card)] text-[var(--ink)] font-bold">
                {developers.length}
              </Badge>
            </div>

            <div className="text-xs text-[var(--muted)] font-medium">
              {developers.filter((d) => d.hasEmbedding).length} of {developers.length} vector embeddings active
            </div>
          </div>

          {/* Developers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {developers.map((dev) => (
              <Card
                key={dev.login}
                className="rounded-2xl border-[var(--hairline)] bg-white hover:border-[var(--ink)] hover:shadow-md transition-all flex flex-col justify-between p-6 gap-5"
              >
                {/* Dev Profile Info */}
                <div className="flex items-center gap-3.5">
                  {dev.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={dev.avatarUrl}
                      alt={dev.login}
                      width={52}
                      height={52}
                      style={{ width: 52, height: 52, minWidth: 52, minHeight: 52, objectFit: "cover", borderRadius: "9999px" }}
                      className="size-13 rounded-full border border-[var(--hairline)] shrink-0 object-cover"
                    />
                  ) : (
                    <div
                      style={{ width: 52, height: 52 }}
                      className="size-13 rounded-full bg-[var(--surface-card)] border border-[var(--hairline)] flex items-center justify-center font-bold text-sm text-[var(--ink)] shrink-0"
                    >
                      {dev.login.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="overflow-hidden flex-1">
                    <div className="font-bold text-base text-[var(--ink)] tracking-tight truncate">
                      @{dev.login}
                    </div>
                    {dev.name && (
                      <div className="text-xs text-[var(--muted)] truncate">
                        {dev.name}
                      </div>
                    )}
                    <a
                      href={dev.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--ink)] font-medium hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <span>GitHub</span>
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>

                {/* Contribution Stats Pill Box */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--surface-soft)] border border-[var(--hairline)] text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                      <GitCommit className="size-3" /> Commits
                    </span>
                    <span className="text-lg font-bold text-[var(--ink)] mt-0.5">
                      {dev.commitsOnRepo}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                      <GitPullRequest className="size-3" /> Pull Requests
                    </span>
                    <span className="text-lg font-bold text-[var(--ink)] mt-0.5">
                      {dev.prsOnRepo}
                    </span>
                  </div>
                </div>

                {/* Special Keywords / Expertise Section */}
                <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--hairline)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                      <Tag className="size-3 text-[var(--ink)]" />
                      Special Expertise
                    </span>

                    {editingDevLogin !== dev.login && (
                      <button
                        type="button"
                        onClick={() => startEditingKeywords(dev)}
                        className="text-[11px] font-semibold text-[var(--ink)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="size-3" />
                        {dev.specialKeywords ? "Edit" : "Add Tag"}
                      </button>
                    )}
                  </div>

                  {editingDevLogin === dev.login ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveKeywords(dev);
                          if (e.key === "Escape") cancelEditingKeywords();
                        }}
                        placeholder="e.g. backend expert, api, rust"
                        autoFocus
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[var(--ink)] text-xs text-[var(--ink)] focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditingKeywords}
                          disabled={savingKeywords}
                          className="h-7 px-2 text-xs rounded-lg"
                        >
                          <X className="size-3 mr-1" /> Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveKeywords(dev)}
                          disabled={savingKeywords}
                          className="h-7 px-3 text-xs rounded-lg bg-[var(--ink)] !text-white text-white hover:bg-[#222]"
                        >
                          {savingKeywords ? "Saving..." : <><Check className="size-3 mr-1 !text-white text-white" /> Save</>}
                        </Button>
                      </div>
                    </div>
                  ) : dev.specialKeywords ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dev.specialKeywords
                        .split(/[,;|]+/)
                        .map((kw) => kw.trim())
                        .filter(Boolean)
                        .map((kw, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 rounded-full bg-white text-[var(--ink)] border-[var(--hairline)] font-medium shadow-2xs"
                          >
                            {kw}
                          </Badge>
                        ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)] italic">
                      No tags configured (e.g. backend expert, devops)
                    </span>
                  )}
                </div>

                {/* AI Vector Embedding Status & Link */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)] text-xs">
                  {dev.hasEmbedding ? (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 font-medium flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Vector Ready
                    </Badge>
                  ) : dev.syncedInDb ? (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border-amber-200 font-medium">
                      Needs Embedding
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border-stone-200">
                      Unsynced
                    </Badge>
                  )}

                  <a
                    href={`https://github.com/${activeRepo}/commits?author=${dev.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline flex items-center gap-1"
                  >
                    <span>Commits</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
