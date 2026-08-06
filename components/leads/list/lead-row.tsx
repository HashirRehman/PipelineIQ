"use client"

import { Calendar, Check, MessageSquare } from "lucide-react"

import { Avatar } from "@/components/avatar"
import { LeadStatusSelect } from "@/components/leads/lead-status-select"
import type { Lead } from "@/components/leads/types"
import { LEAD_STATUS_DONE, type LeadStatus } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function LeadRow({
  lead,
  bdName,
  onToggleDone,
  onStatusChange,
  onOpen,
}: {
  lead: Lead
  bdName?: string
  onToggleDone: (id: string) => void
  onStatusChange: (id: string, status: LeadStatus) => void
  onOpen: (lead: Lead) => void
}) {
  const isDone = lead.status === LEAD_STATUS_DONE

  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-2 py-2.5 transition-colors hover:bg-[var(--muted)]">
      <button
        type="button"
        onClick={() => onToggleDone(lead.id)}
        aria-pressed={isDone}
        aria-label={isDone ? `Reopen ${lead.jobTitle}` : `Mark ${lead.jobTitle} as done`}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors cursor-pointer",
          isDone
            ? "border-transparent bg-emerald-600 text-white"
            : "border-[var(--border-strong)] text-transparent hover:border-[var(--primary)]",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>

      <button
        type="button"
        onClick={() => onOpen(lead)}
        className="min-w-0 flex-1 cursor-pointer text-left"
      >
        <div
          className={cn(
            "truncate text-xs font-medium",
            isDone ? "text-[var(--muted-fg)] line-through" : "text-[var(--fg)]",
          )}
        >
          {lead.jobTitle}
        </div>
        <div className="truncate text-[11px] text-[var(--muted-fg)]">
          {lead.company} · {lead.profileName}
        </div>
      </button>

      {lead.bdNotes && (
        <span
          className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-[var(--muted-fg)]"
          title="Has a BD note"
        >
          <MessageSquare className="size-3.5" />1
        </span>
      )}

      <div className="shrink-0">
        <LeadStatusSelect
          value={lead.status}
          onChange={status => onStatusChange(lead.id, status)}
        />
      </div>

      <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-[var(--muted-fg)] sm:flex">
        <Calendar className="size-3.5" />
        {formatDate(lead.appliedAt)}
      </span>

      <span className="shrink-0" title={bdName ? `Assigned to ${bdName}` : "Unassigned"}>
        <Avatar name={bdName ?? "—"} size={24} />
      </span>
    </div>
  )
}
