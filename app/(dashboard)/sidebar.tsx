"use client";

import { useState, useSyncExternalStore } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  LayoutDashboard,
  Loader2,
  LogOut,
  ChevronsRight,
  ChevronsLeft,
  Search,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PipelineIQLogo, RecursoMark } from "@/components/pipelineiq-logo";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api/client";
import { getRolePermissionsByKey } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import type { TabId } from "@/lib/constants";

const NAV: { id: TabId; label: string; icon: LucideIcon; href: string }[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
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

// useLinkStatus() only reports a pending state from within a descendant of
// the <Link> it's tracking, hence this as its own component rather than
// inline in the Link's children — swaps the tab's icon for a spinner for
// the moment its own navigation is actually in flight (on top of the
// optimistic highlight, which flips instantly regardless).
function NavIcon({
  icon: Icon,
  isActive,
}: {
  icon: LucideIcon;
  isActive: boolean;
}) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  }
  return (
    <Icon
      className={cn(
        "size-4 shrink-0 transition-transform duration-150",
        isActive
          ? "text-primary"
          : "text-muted-foreground/70 group-hover/item:scale-110",
      )}
      strokeWidth={isActive ? 2.2 : 1.8}
    />
  );
}

function getActiveTab(pathname: string): TabId | null {
  if (pathname === "/") return "dashboard";
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

  // usePathname() only updates once the target route actually commits, not
  // the instant a nav item is clicked — leaving the highlight visibly lagging
  // behind the click. Track the clicked tab optimistically, and drop the
  // override the moment pathname has moved (adjusting state during render,
  // not in an effect — see "You Might Not Need an Effect" in the React docs).
  const [optimisticTab, setOptimisticTab] = useState<TabId | null>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOptimisticTab(null);
  }

  const activeTab = optimisticTab ?? getActiveTab(pathname);

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
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute right-0 z-50 translate-x-[50%] rounded-full bg-white text-muted-foreground/80 hover:bg-accent hover:text-foreground dark:bg-background"
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <ChevronsLeft className="size-4" />
          )}
        </Button>
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
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setOptimisticTab(item.id)}
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
                  <NavIcon icon={item.icon} isActive={isActive} />
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
        {/* Settings button — always available at the bottom */}
        <Link
          href="/settings"
          title="Settings"
          className={cn(
            "group/item relative flex w-full items-center rounded-lg text-sm transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed
              ? "justify-center px-0 py-2"
              : "gap-3 px-2.5 py-2",
            "text-muted-foreground hover:bg-accent hover:text-foreground font-normal",
          )}
        >
          <Settings
            className={cn(
              "size-4 shrink-0 transition-transform duration-150",
              "text-muted-foreground/70 group-hover/item:scale-110",
            )}
            strokeWidth={1.8}
          />
          {!collapsed && <span className="leading-none">Settings</span>}
        </Link>

        {/* User row — hover reveals a mini sign-out when expanded */}
        {user && (
          <div
            className={cn(
              "flex items-center rounded-md group",
              collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-2 py-1.5",
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
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleSignOut}
                aria-label="Log out"
                className="size-6 rounded text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100"
              >
                <LogOut className="size-3.5" />
              </Button>
            )}
          </div>
        )}

        {/* Log out — icon-only action for the collapsed rail (expanded uses
            the hover action on the user row above) */}
        {collapsed && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            title="Log out"
            className="h-auto w-full rounded-lg py-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4 shrink-0" strokeWidth={1.8} />
          </Button>
        )}
      </div>
    </aside>
  );
}
