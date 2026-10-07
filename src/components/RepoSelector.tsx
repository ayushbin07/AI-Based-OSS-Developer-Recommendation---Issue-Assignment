"use client";

import { useState, useRef, useEffect } from "react";
import { useRepo } from "@/context/RepoContext";
import { ChevronDown, FolderGit2, Search, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface RepoItem {
  id?: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  stars: number;
  htmlUrl: string;
  isSynced: boolean;
  isRemovedFromGitHub?: boolean;
  stats: {
    issues: number;
    pullRequests: number;
    commits: number;
  };
}

export function RepoSelector({
  onSelect,
  className = "",
  compact = false,
}: {
  onSelect?: (repo: RepoItem) => void;
  className?: string;
  compact?: boolean;
}) {
  const { selectedRepo, setSelectedRepo, repos, loadingRepos } = useRepo();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (repo: RepoItem) => {
    setSelectedRepo(repo.fullName);
    setIsOpen(false);
    setSearch("");
    if (onSelect) {
      onSelect(repo);
    }
  };

  const current =
    repos.find((r) => r.fullName === selectedRepo) ||
    (selectedRepo
      ? {
          name: selectedRepo.split("/")[1] || selectedRepo,
          fullName: selectedRepo,
          owner: selectedRepo.split("/")[0] || "",
          description: null,
          isPrivate: false,
          stars: 0,
          htmlUrl: `https://github.com/${selectedRepo}`,
          isSynced: false,
          stats: { issues: 0, pullRequests: 0, commits: 0 },
        }
      : null);

  const filtered = repos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div
      ref={dropdownRef}
      className={`relative ${className}`}
      style={{ minWidth: compact ? 220 : 280 }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loadingRepos}
        className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-white border border-[var(--hairline)] hover:border-[var(--ink)] text-[var(--ink)] text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--ink)]"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <FolderGit2 className="size-4 text-[var(--ink)] shrink-0" />
          <div className="truncate text-left font-medium">
            {loadingRepos ? (
              <span className="text-[var(--muted)]">Loading repos...</span>
            ) : current ? (
              <span className="text-[var(--ink)] font-semibold">{current.fullName}</span>
            ) : (
              <span className="text-[var(--muted)]">Select repository</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {current?.isSynced && (
            <span
              className="size-2 rounded-full bg-emerald-500 inline-block ring-2 ring-emerald-100"
              title="Repository data is synced in DB"
            />
          )}
          <ChevronDown className={`size-4 text-[var(--muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white border border-[var(--hairline)] rounded-2xl shadow-xl max-h-[380px] overflow-hidden flex flex-col p-2 animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Search bar */}
          <div className="relative px-2 pt-1 pb-2">
            <Search className="size-4 absolute left-4.5 top-3.5 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Filter repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--hairline)] text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--ink)]"
            />
          </div>

          <div className="overflow-y-auto flex flex-col gap-1 pr-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--muted)]">
                No repositories found
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = r.fullName === selectedRepo;
                return (
                  <button
                    key={r.fullName}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className={`flex items-center justify-between gap-3 w-full p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? "bg-[var(--surface-card)] text-[var(--ink)] font-semibold border border-[var(--hairline)]"
                        : "hover:bg-[var(--surface-soft)] text-[var(--body)] border border-transparent"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[var(--ink)]">{r.name}</span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {r.owner}
                        </span>
                        {r.isPrivate && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[var(--muted)] font-mono">
                            private
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <div className="text-[11px] text-[var(--muted)] truncate mt-0.5 max-w-[200px]">
                          {r.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {r.isSynced ? (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border-stone-200">
                          Unsynced
                        </Badge>
                      )}
                      {isSelected && (
                        <CheckCircle2 className="size-3.5 text-[var(--ink)] shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
