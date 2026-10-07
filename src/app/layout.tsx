import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RepoSelector } from "@/components/RepoSelector";
import { RepoProvider } from "@/context/RepoContext";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AI Dev Recommender",
  description:
    "AI-powered GitHub issue assignment — finds the best developer for every issue using semantic similarity and contribution history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const provider = process.env.AI_PROVIDER ?? "gemini";

  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-[var(--canvas)] text-[var(--ink)] antialiased">
        <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--muted)]">Loading interface...</div>}>
          <RepoProvider>
            <TooltipProvider>
              <SidebarProvider defaultOpen={true}>
                <AppSidebar />
                <SidebarInset className="bg-[var(--canvas)] flex flex-col min-h-screen">
                  {/* Top Bar inside SidebarInset (Shadcn sidebar-08 structure) */}
                  <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--hairline)] px-6 bg-[var(--canvas)] sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                      <SidebarTrigger className="-ml-1 text-[var(--ink)] hover:bg-[var(--surface-card)] rounded-lg p-1.5 transition-colors cursor-pointer" />
                      <Separator orientation="vertical" className="h-4 bg-[var(--hairline)]" />
                      <RepoSelector compact />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)] hidden sm:inline">Engine:</span>
                      <Badge variant="outline" className="rounded-full px-3 py-1 font-semibold text-xs uppercase tracking-wide bg-[var(--surface-card)] text-[var(--ink)] border-[var(--hairline)]">
                        {provider}
                      </Badge>
                    </div>
                  </header>

                  {/* Main page content */}
                  <main className="flex-1 p-6 md:p-8 overflow-y-auto bg-[var(--canvas)]">
                    {children}
                  </main>
                </SidebarInset>
              </SidebarProvider>
            </TooltipProvider>
          </RepoProvider>
        </Suspense>
      </body>
    </html>
  );
}
