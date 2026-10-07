import { Suspense } from "react";
import { DevelopersView } from "./DevelopersView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Developers | AI Dev Recommender",
  description: "Browse GitHub contributors for any repository and check their AI skill profile and embedding status.",
};

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  const resolvedParams = await searchParams;
  const initialRepo =
    resolvedParams.repo ||
    (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
      ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
      : undefined);

  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading developers...</div>}>
      <DevelopersView initialRepo={initialRepo} />
    </Suspense>
  );
}
