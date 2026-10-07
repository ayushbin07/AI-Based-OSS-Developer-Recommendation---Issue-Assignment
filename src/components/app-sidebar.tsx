"use client"

import * as React from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Users,
  Bug,
  RefreshCw,
  FolderGit2,
  LifeBuoy,
  Sparkles,
  ExternalLink,
  ChevronRight
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import { useRepo } from "@/context/RepoContext"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { selectedRepo } = useRepo()

  const data = {
    user: {
      name: "ayushbin07",
      email: selectedRepo ? selectedRepo : "workspace@github.com",
      avatar: "https://github.com/github.png",
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/",
        icon: <LayoutDashboard className="size-4" />,
      },
      {
        title: "Developers",
        url: "/developers",
        icon: <Users className="size-4" />,
      },
      {
        title: "Issues",
        url: "/issues",
        icon: <Bug className="size-4" />,
      },
      {
        title: "Sync Data",
        url: "/sync",
        icon: <RefreshCw className="size-4" />,
      },
    ],
    navSecondary: [
      {
        title: "GitHub Repository",
        url: selectedRepo ? `https://github.com/${selectedRepo}` : "https://github.com",
        icon: <ExternalLink className="size-4" />,
      },
      {
        title: "Documentation",
        url: "https://ui.shadcn.com",
        icon: <LifeBuoy className="size-4" />,
      },
    ],
  }

  return (
    <Sidebar variant="inset" className="border-r border-[var(--hairline)] bg-[var(--surface-soft)] text-[var(--ink)]" {...props}>
      <SidebarHeader className="border-b border-[var(--hairline)] pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8.5 items-center justify-center rounded-xl bg-[var(--ink)] text-white shadow-xs font-bold text-base">
                ✦
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold tracking-tight text-[var(--ink)]">AI Recommender</span>
                <span className="truncate text-[11px] text-[var(--muted)]">GitHub Issue Routing</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <NavMain items={data.navMain} />

        {/* Clay Platform Status Group */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Active Scope
          </SidebarGroupLabel>
          <div className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--hairline)] flex flex-col gap-1.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <FolderGit2 className="size-3.5 text-[var(--ink)] shrink-0" />
              <span className="truncate">{selectedRepo || "No repo selected"}</span>
            </div>
          </div>
        </SidebarGroup>

        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--hairline)] pt-2">
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
