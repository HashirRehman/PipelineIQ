"use client"

import { usePathname } from "next/navigation"
import { Bell, ChevronRight } from "lucide-react"
import { Avatar } from "@/components/avatar"

interface TopBarProps {
  user: { name: string; email: string; role: string | null }
}

const PAGE_NAMES: Record<string, string> = {
  "/leads":        "Leads",
  "/profiles":     "Profiles",
  "/discovery":    "Discovery",
  "/applied-jobs": "Applied Jobs",
  "/users":        "Team",
  "/statistics":   "Statistics",
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname()
  const segment = "/" + (pathname.split("/")[1] ?? "")
  const pageName = PAGE_NAMES[segment] ?? "PipelineIQ"

  return (
    <header className="flex h-[57px] shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-title-sm font-semibold text-foreground">{pageName}</h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <Bell className="size-4" strokeWidth={1.8} />
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary"
          />
        </button>

        <div className="flex items-center gap-2">
        
          <Avatar name={user.name} size={26} />
          <span className="text-item font-medium text-foreground hidden sm:block max-w-[90px] truncate">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  )
}
