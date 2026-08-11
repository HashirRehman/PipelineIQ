"use client"

import type { ReactNode } from "react"
import { ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export function LeadStatusSection({
  status,
  color,
  count,
  collapsed,
  onToggle,
  children,
}: {
  status: string
  /** Stage color — derived from the stage's position in the ordered list. */
  color: string
  count: number
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}) {

  return (
    <section>
      {/* Section header row — matches the reference Tasks list group row */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-muted/60">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${status}`}
          className={cn(
            "flex flex-1 items-center gap-2 cursor-pointer text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
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
          {/* Status label */}
          <span
            className="text-item font-semibold"
            style={{ color }}
          >
            {status}
          </span>
          {/* Count pill */}
          <span
            className="min-w-[18px] rounded-sm px-1 text-center text-meta font-semibold tabular-nums"
            style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
          >
            {count}
          </span>
        </button>

        {/* Add button */}
        <button
          type="button"
          aria-label={`Add lead to ${status}`}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {!collapsed && <div>{children}</div>}
    </section>
  )
}
