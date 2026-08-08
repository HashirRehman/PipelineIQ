"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  LogOut,
  Moon,
  Search,
  Sun,
  UserRound,
  Users,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useMounted } from "@/hooks/use-mounted"
import { Avatar } from "@/components/avatar"
import { PipelineIQLogo } from "@/components/pipelineiq-logo"
import { apiPost } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { TabId } from "@/lib/constants"

const NAV: { id: TabId; label: string; icon: LucideIcon; href: string }[] = [
  { id: "profiles",     label: "Profiles",     icon: UserRound,    href: "/profiles"     },
  { id: "discovery",    label: "Discovery",    icon: Search,       href: "/discovery"    },
  { id: "applied-jobs", label: "Applied Jobs", icon: CheckCircle2, href: "/applied-jobs" },
  { id: "leads",        label: "Leads",        icon: Briefcase,    href: "/leads"        },
  { id: "users",        label: "Users",        icon: Users,        href: "/users"        },
  { id: "statistics",   label: "Statistics",   icon: BarChart3,    href: "/statistics"   },
]

function getActiveTab(pathname: string): TabId {
  if (pathname === "/") return "profiles"
  const segment = pathname.split("/")[1]
  return NAV.some(item => item.id === segment) ? (segment as TabId) : "profiles"
}

interface SidebarProps {
  counts?: Record<string, number>
  user?: { name: string; email: string; role: string | null } | null
}

export default function Sidebar({ counts, user }: SidebarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()
  const pathname = usePathname()
  const activeTab = getActiveTab(pathname)

  const handleSignOut = async () => {
    try {
      await apiPost<{ success: boolean }>("/api/auth/logout", {})
    } catch {
      // Session may already be gone — navigate away regardless.
    }
    window.location.href = "/login"
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border select-none">

      {/* Logo row */}
      <div className="flex h-[57px] items-center px-5 border-b border-sidebar-border">
        <PipelineIQLogo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul role="list" className="flex flex-col gap-px gap-y-1">
          {NAV.map(item => {
            const isActive = activeTab === item.id
            const count = counts?.[item.id]
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-accent text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground font-normal",
                    count !== undefined && count > 0 && "relative"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-[15px] shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground/70",
                    )}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  <span className="leading-none">{item.label}</span>
                  {count !== undefined && count > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute right-2 flex min-w-0 h-4 items-center justify-center rounded-full px-1.5 font-mono text-caption tabular-nums select-none",
                        isActive
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border px-3 py-3 space-y-1">

        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors cursor-pointer"
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="size-[15px] shrink-0" strokeWidth={1.8} />
          ) : (
            <Moon className="size-[15px] shrink-0" strokeWidth={1.8} />
          )}
          <span className="leading-none">
            {mounted && resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>

        {/* User row */}
        {user && (
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 group">
            <Avatar name={user.name} size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-item font-medium text-sidebar-foreground truncate leading-none">
                {user.name}
              </p>
              {user.role && (
                <p className="text-caption text-primary/80 mt-0.5 font-medium capitalize">
                  {user.role}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Log out"
              className="flex size-6 items-center justify-center rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
