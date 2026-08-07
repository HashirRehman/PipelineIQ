"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  LogOut,
  Moon,
  Search,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import type { TabId } from "@/lib/constants";
import { useTheme } from "next-themes";
import { useMounted } from "@/hooks/use-mounted";
import { Avatar } from "@/components/avatar";
import { PipelineIQLogo } from "@/components/pipelineiq-logo";
import { apiPost } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV: {
  id: TabId;
  label: string;
  icon: LucideIcon;
  href: string;
}[] = [
  { id: "profiles", label: "Profiles", icon: UserRound, href: "/profiles" },
  { id: "discovery", label: "Discovery", icon: Search, href: "/discovery" },
  { id: "leads", label: "Leads", icon: Briefcase, href: "/leads" },
  { id: "users", label: "Users", icon: Users, href: "/users" },
  { id: "statistics", label: "Statistics", icon: BarChart3, href: "/statistics" },
];

/** Derive the active section from the current pathname. */
function getActiveTab(pathname: string): TabId {
  if (pathname === "/") return "profiles";
  const segment = pathname.split("/")[1];
  return NAV.some((item) => item.id === segment)
    ? (segment as TabId)
    : "profiles";
}

interface SidebarProps {
  counts?: Record<string, number>;
  user?: {
    name: string;
    email: string;
    role: string | null;
  } | null;
}

export default function Sidebar({ counts, user }: SidebarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);

  const handleSignOut = async () => {
    try {
      await apiPost<{ success: boolean }>("/api/auth/logout", {});
    } catch {
      // Session may already be gone — navigate away regardless.
    }
    window.location.href = "/login";
  };

  return (
    <aside className="flex h-full w-[216px] min-h-0 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-fg)] border-r border-[var(--border)] select-none">
      {/* Logo */}
      <div className="mb-4 flex flex-col gap-2 p-2 px-2.5">
        <PipelineIQLogo />
      </div>

      {/* Nav Links */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-2.5">
        <div className="flex w-full min-w-0 flex-col p-2">
          <ul className="flex w-full min-w-0 flex-col gap-0.5">
            {NAV.map((item) => {
              const isActive = activeTab === item.id;
              const count = counts?.[item.id];
              const Icon = item.icon;
              return (
                <li key={item.id} className="relative">
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-start gap-2 overflow-hidden rounded-md p-2 px-2.5 text-left text-xs font-medium transition-all shadow-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/50 outline-none",
                      isActive
                        ? "bg-cyan-500/15 text-[var(--primary)] font-semibold hover:bg-cyan-500/15"
                        : "text-[var(--sidebar-fg)] hover:bg-black/5 dark:hover:bg-white/5",
                      count !== undefined && count > 0 && "pr-8"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive
                          ? "text-[var(--primary)]"
                          : "text-[var(--muted-fg)]"
                      )}
                    />
                    <span className="flex-1 text-left ml-2">
                      {item.label}
                    </span>
                  </Link>
                  {count !== undefined && count > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute right-1 flex min-w-0 h-4 items-center justify-center rounded-full px-1.5 font-mono text-[10px] tabular-nums select-none",
                        isActive
                          ? "bg-[var(--primary)] text-white font-bold"
                          : "bg-[var(--secondary)] text-[var(--muted-fg)]"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Bottom */}
      <div className="flex flex-col gap-2 border-t border-[var(--border)] p-2.5">
        <Button
          variant="ghost"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="w-full h-auto justify-start gap-2 p-2 px-2.5 rounded-md text-xs text-[var(--sidebar-fg)] hover:bg-black/5 dark:hover:bg-white/5 shadow-none cursor-pointer"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="size-[13px]" />
          ) : (
            <Moon className="size-[13px]" />
          )}
          <span className="text-xs">
            {mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </Button>

        <div className="flex items-center gap-2 p-0.5">
          {user && (
            <>
              <Avatar name={user.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-[var(--sidebar-fg)] truncate">
                  {user.name}
                </div>
                {user.role && (
                  <div className="font-mono text-[10px] text-[var(--primary)]">
                    {user.role}
                  </div>
                )}
              </div>
            </>
          )}
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="icon-sm"
            aria-label="Log out"
            title="Log out"
            className="text-[var(--muted-fg)] hover:bg-black/5 hover:text-[var(--fg)] dark:hover:bg-white/5 shadow-none cursor-pointer"
          >
            <LogOut className="size-[13px]" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
