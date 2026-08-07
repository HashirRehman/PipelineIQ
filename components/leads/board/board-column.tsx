"use client"

import type { DragEvent, ReactNode } from "react"

import { LEAD_STATUS_COLOR, type LeadStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

export function BoardColumn({
  status,
  count,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  status: LeadStatus
  count: number
  isDropTarget: boolean
  onDragOver: (event: DragEvent, status: LeadStatus) => void
  onDragLeave: (event: DragEvent) => void
  onDrop: (event: DragEvent, status: LeadStatus) => void
  children: ReactNode
}) {
  return (
    <div className="flex w-[240px] shrink-0 flex-col">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.75">
          <span
            className="size-2 rounded-full"
            style={{ background: LEAD_STATUS_COLOR[status] }}
          />
          <span className="text-xs font-semibold text-[var(--fg)]">{status}</span>
        </div>
        <span className="rounded-full bg-[var(--secondary)] px-1.75 py-0.25 font-mono text-[11px] text-[var(--muted-fg)]">
          {count}
        </span>
      </div>

      {/* The only drop target in the column — the old markup had one here
          and another on the wrapper, so a single drop fired twice. */}
      <div
        onDragOver={event => onDragOver(event, status)}
        onDragLeave={onDragLeave}
        onDrop={event => onDrop(event, status)}
        style={isDropTarget ? { borderColor: LEAD_STATUS_COLOR[status] } : undefined}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-2 transition-colors duration-150",
          isDropTarget && "bg-[var(--secondary)]",
        )}
      >
        {children}
        {count === 0 && (
          <div className="py-5 text-center text-xs text-[var(--muted-fg)]">Drop here</div>
        )}
      </div>
    </div>
  )
}
