"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { RepoItem } from "@/components/RepoSelector";

interface RepoContextType {
  selectedRepo: string;
  setSelectedRepo: (repo: string) => void;
  repos: RepoItem[];
  loadingRepos: boolean;
  refreshRepos: () => Promise<void>;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [selectedRepo, setSelectedRepoState] = useState<string>("");

  const urlRepo = searchParams.get("repo");

  const refreshRepos = useCallback(async () => {
    try {
      const res = await fetch("/api/repos");
      if (!res.ok) throw new Error("Failed to load repos");
      const data = await res.json();
      const list: RepoItem[] = data.repos ?? [];
      setRepos(list);

      // Determine initial selection
      const saved = typeof window !== "undefined" ? localStorage.getItem("selected_repo") : null;
      const initial =
        urlRepo && list.some((r) => r.fullName === urlRepo)
          ? urlRepo
          : saved && list.some((r) => r.fullName === saved)
          ? saved
          : data.defaultRepo || list[0]?.fullName || "";

      if (initial) {
        setSelectedRepoState(initial);
        if (typeof window !== "undefined") {
          localStorage.setItem("selected_repo", initial);
          document.cookie = `selected_repo=${encodeURIComponent(initial)}; path=/; max-age=31536000`;
        }
      }
    } catch (err) {
      console.error("[RepoProvider] Error loading repositories:", err);
    } finally {
      setLoadingRepos(false);
    }
  }, [urlRepo]);

  useEffect(() => {
    refreshRepos();
  }, [refreshRepos]);

  // Synchronize state if URL changes externally
  useEffect(() => {
    if (urlRepo && urlRepo !== selectedRepo) {
      setSelectedRepoState(urlRepo);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_repo", urlRepo);
        document.cookie = `selected_repo=${encodeURIComponent(urlRepo)}; path=/; max-age=31536000`;
      }
    }
  }, [urlRepo, selectedRepo]);

  const setSelectedRepo = useCallback(
    (repo: string) => {
      setSelectedRepoState(repo);
      if (typeof window !== "undefined") {
        localStorage.setItem("selected_repo", repo);
        document.cookie = `selected_repo=${encodeURIComponent(repo)}; path=/; max-age=31536000`;
      }

      // Sync URL param
      const params = new URLSearchParams(searchParams.toString());
      params.set("repo", repo);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  return (
    <RepoContext.Provider
      value={{
        selectedRepo,
        setSelectedRepo,
        repos,
        loadingRepos,
        refreshRepos,
      }}
    >
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error("useRepo must be used within a RepoProvider");
  }
  return context;
}
