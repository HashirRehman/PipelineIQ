"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { LEAD_STATUS_COLOR, type LeadStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

export function LeadStatusSection({
  status,
  count,
  collapsed,
  onToggle,
  children,
}: {
  status: LeadStatus
  count: number
  collapsed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full cursor-pointer items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-2 py-2 text-left"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-[var(--muted-fg)] transition-transform",
            collapsed && "-rotate-90",
          )}
        />
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: LEAD_STATUS_COLOR[status] }}
        />
        <span
          className="text-xs font-semibold"
          style={{ color: LEAD_STATUS_COLOR[status] }}
        >
          {status}
        </span>
        <span className="font-mono text-[11px] text-[var(--muted-fg)]">{count}</span>
      </button>

      {!collapsed && <div>{children}</div>}
    </section>
  )
}
