"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  LogOut,
  ChevronsRight,
  ChevronsLeft,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PipelineIQLogo, RecursoMark } from "@/components/pipelineiq-logo";
import { apiPost } from "@/lib/api/client";
import { getRolePermissionsByKey } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import type { TabId } from "@/lib/constants";

const NAV: { id: TabId; label: string; icon: LucideIcon; href: string }[] = [
  { id: "profiles", label: "Profiles", icon: UserRound, href: "/profiles" },
  { id: "discovery", label: "Discovery", icon: Search, href: "/discovery" },
  {
    id: "applied-jobs",
    label: "Pipeline",
    icon: CheckCircle2,
    href: "/applied-jobs",
  },
  { id: "leads", label: "Leads", icon: Briefcase, href: "/leads" },
  { id: "users", label: "Users", icon: Users, href: "/users" },
  {
    id: "statistics",
    label: "Statistics",
    icon: BarChart3,
    href: "/statistics",
  },
];

// Persisted alongside the other pipelineiq.* localStorage prefs. Same-tab
// writes dispatch COLLAPSED_CHANGED_EVENT so the useSyncExternalStore
// snapshot refreshes (the storage event only fires cross-tab).
const COLLAPSED_KEY = "pipelineiq.sidebar.collapsed";
const COLLAPSED_CHANGED_EVENT = "pipelineiq:sidebar-collapsed-changed";

function onCollapsedChange(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(COLLAPSED_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(COLLAPSED_CHANGED_EVENT, callback);
  };
}

const readCollapsed = () =>
  window.localStorage.getItem(COLLAPSED_KEY) === "1";

function getActiveTab(pathname: string): TabId | null {
  if (pathname === "/") return "profiles";
  const segment = pathname.split("/")[1];
  return NAV.some((item) => item.id === segment)
    ? (segment as TabId)
    : null;
}

interface SidebarProps {
  counts?: Record<string, number>;
  user?: { name: string; email: string; role: string | null } | null;
}

export default function Sidebar({ counts, user }: SidebarProps) {
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);

  // Nav visibility comes from the ROLE_PERMISSIONS matrix (lib/auth/roles.ts)
  // — the single source of truth for what each role may do. The layout passes
  // the role lowercased, so lookup is case-insensitive.
  const perms = getRolePermissionsByKey(user?.role);
  const canViewUsers = perms.canViewUsers;
  const canAccessProfiles = perms.canAccessProfiles;
  const canAccessJobs = perms.canAccessJobs;
  const visibleNav = NAV.filter((item) => {
    if (item.id === "users") return canViewUsers;
    if (item.id === "profiles") return canAccessProfiles;
    return canAccessJobs;
  });
  // React mirror of the localStorage flag. The server snapshot is always
  // false (expanded) so SSR and the first client render agree — the real
  // value is picked up synchronously on the client with no hydration
  // mismatch and no setState-in-effect.
  const collapsed = useSyncExternalStore(
    onCollapsedChange,
    readCollapsed,
    () => false,
  );

  const setCollapsed = (next: boolean) => {
    window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(COLLAPSED_CHANGED_EVENT));
  };

  const handleSignOut = async () => {
    try {
      await apiPost<{ success: boolean }>("/api/auth/logout", {});
    } catch {
      // Session may already be gone — navigate away regardless.
    }
    window.location.href = "/login";
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar border-r border-sidebar-border select-none transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[64px]" : "w-[220px]",
      )}
    >
      {/* Logo row + collapse toggle */}
      <div
        className={cn(
          "relative flex h-[57px] shrink-0 items-center border-b border-sidebar-border transition-all duration-200",
          collapsed
            ? "flex-col justify-center gap-1 px-0"
            : "px-5",
        )}
      >
        {collapsed ? <RecursoMark size={16} /> : <PipelineIQLogo />}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute right-0 z-50 flex size-6 translate-x-[50%] items-center justify-center rounded-full bg-white text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground cursor-pointer dark:bg-background"
        >
          {collapsed ? (
            <ChevronsLeft className="size-4" />
          ) : (
            <ChevronsRight className="size-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Main navigation"
      >
        <ul role="list" className="flex flex-col gap-y-0.5">
          {visibleNav.map((item) => {
            const isActive = activeTab === item.id;
            const count = counts?.[item.id];
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group/item relative flex w-full items-center rounded-lg text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    collapsed
                      ? "justify-center px-0 py-2"
                      : "gap-3 px-2.5 py-2",
                    isActive
                      ? "bg-primary/10 font-semibold text-primary shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground font-normal",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-transform duration-150",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover/item:scale-110",
                    )}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {!collapsed && (
                    <span className="leading-none">{item.label}</span>
                  )}
                  {count !== undefined &&
                    count > 0 &&
                    (collapsed ? (
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute top-1 right-1 size-1.5 rounded-full",
                          isActive ? "bg-primary" : "bg-muted-foreground/60",
                        )}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute right-2 flex min-w-0 h-4 items-center justify-center rounded-full px-1.5 font-mono text-caption tabular-nums select-none",
                          isActive
                            ? "bg-primary text-primary-foreground font-bold"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {count}
                      </span>
                    ))}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
        {/* User row — hover reveals a mini sign-out when expanded */}
        {user && (
          <div
            className={cn(
              "flex items-center rounded-md group",
              collapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-2 py-1.5",
            )}
          >
            <Avatar name={user.name} size={26} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-item font-medium text-sidebar-foreground truncate leading-none">
                  {user.name}
                </p>
                {user.role && (
                  <p className="text-caption text-primary/80 mt-0.5 font-medium capitalize">
                    {perms.label}
                  </p>
                )}
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Log out"
                className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
              >
                <LogOut className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Log out — icon-only action for the collapsed rail (expanded uses
            the hover action on the user row above) */}
        {collapsed && (
          <button
            type="button"
            onClick={handleSignOut}
            title="Log out"
            className="flex w-full items-center justify-center rounded-lg py-2 text-muted-foreground transition-colors cursor-pointer hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </aside>
  );
}
