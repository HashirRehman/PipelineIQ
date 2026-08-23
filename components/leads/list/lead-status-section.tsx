"use client"

import type { ReactNode } from "react"
import { ChevronDown, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function LeadStatusSection({
  status,
  color,
  count,
  collapsed,
  paused = false,
  onToggle,
  children,
}: {
  status: string
  /** Stage color — derived from the stage's position in the ordered list. */
  color: string
  count: number
  collapsed: boolean
  /** Stage is in the admin-controlled "paused" state — shown with a small
   * badge next to the name instead of pulling the section out of stage
   * order (pulling it out would desync the list from the Board's column
   * order and the admin's configured stage order). */
  paused?: boolean
  onToggle: () => void
  children: ReactNode
}) {

  return (
    <section>
      {/* Section header row — matches the reference Tasks list group row */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-muted/60 transition-colors duration-150 hover:bg-transparent cursor-pointer">
        <div
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${status}`}
          className="h-auto flex-1 flex items-center justify-start gap-2 rounded p-0 text-left"
        >
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-150",
              collapsed && "-rotate-90",
            )}
          />
          {/* Status dot */}
          <span
            className="size-[7px] rounded-full shrink-0"
            style={{ background: color }}
          />
          {/* Status label — always foreground; the dot + count carry the
              stage color (the first stage's navy is unreadable on dark). */}
          <span className="text-item font-semibold text-foreground">
            {status}
          </span>
          {/* Count pill */}
          <span
            className="min-w-[18px] rounded-sm px-1 text-center text-meta font-semibold tabular-nums"
            style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
          >
            {count}
          </span>
          {paused && (
            <span className="rounded-sm bg-status-amber/10 px-1.5 py-0.5 text-meta font-semibold uppercase tracking-wide text-status-amber">
              Paused
            </span>
          )}
        </div>
      </div>

      {!collapsed && <div>{children}</div>}
    </section>
  )
}
