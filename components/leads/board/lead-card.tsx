"use client"

import type { DragEvent, KeyboardEvent } from "react"

import { Avatar } from "@/components/avatar"
import type { Lead } from "@/components/leads/types"
import { TintedBadge } from "@/components/tinted-badge"
import { WORK_TYPE_COLOR } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Declared at module scope, not inside the board's render body. As a nested
 * component it was a new component type on every render, so React remounted
 * every card — destroying the DOM node mid-drag and cancelling the drag.
 */
export function LeadCard({
  lead,
  bdName,
  isDragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  lead: Lead
  bdName?: string
  isDragging: boolean
  onDragStart: (event: DragEvent, leadId: string) => void
  onDragEnd: () => void
  onOpen: (lead: Lead) => void
}) {
  const open = () => onOpen(lead)
  const openOnEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      open()
    }
  }

  return (
    <div
      draggable
      onDragStart={event => onDragStart(event, lead.id)}
      onDragEnd={onDragEnd}
      onClick={open}
      onKeyDown={openOnEnter}
      role="button"
      tabIndex={0}
      className={cn(
        "cursor-grab rounded-[9px] border border-[var(--border)] bg-[var(--card)] p-3 transition-all duration-150 hover:border-[var(--border-strong)] active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="mb-0.5 text-xs font-semibold text-[var(--fg)]">{lead.jobTitle}</div>
      <div className="mb-2 text-xs text-[var(--muted-fg)]">
        {lead.company} · {lead.jobLocation}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <TintedBadge color={WORK_TYPE_COLOR[lead.workType]}>{lead.workType}</TintedBadge>
        <span className="font-mono text-[10px] text-[var(--muted-fg)]">
          {timeAgo(lead.appliedAt)}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
        <div className="flex items-center gap-1.25">
          <Avatar name={lead.profileName} size={18} />
          <span className="text-[11px] text-[var(--muted-fg)]">
            {lead.profileName.split(" ")[0]}
          </span>
        </div>
        {bdName && (
          <span className="text-[10px] text-[var(--muted-fg)]">→ {bdName.split(" ")[0]}</span>
        )}
      </div>
    </div>
  )
}
