"use client"

import { Calendar, Check, MapPin, MessageSquare } from "lucide-react"
import { Avatar } from "@/components/avatar"
import { TintedBadge } from "@/components/tinted-badge"
import { LeadStatusSelect, type StageOption } from "@/components/leads/lead-status-select"
import type { Lead } from "@/components/leads/types"
import { WORK_TYPE_COLOR } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function LeadRow({
  lead,
  bdName,
  stages,
  doneStage,
  onToggleDone,
  onStatusChange,
  onOpen,
}: {
  lead: Lead
  bdName?: string
  stages: StageOption[]
  doneStage: string | null
  onToggleDone: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onOpen: (lead: Lead) => void
}) {
  const isDone = doneStage !== null && lead.status === doneStage

  return (
    // content-visibility: with up to a hundred rows, off-screen rows skip
    // layout/paint until scrolled into view (rendering-content-visibility).
    <div
      className={cn(
        "group flex items-center gap-3 border-b border-border bg-background px-5 py-1.5 transition-colors hover:bg-accent/40 [content-visibility:auto] [contain-intrinsic-size:auto_52px]",
        isDone && "opacity-55",
      )}
    >
      {/* Done / completion circle */}
      <button
        type="button"
        onClick={() => onToggleDone(lead.id)}
        aria-pressed={isDone}
        aria-label={isDone ? `Reopen: ${lead.jobTitle}` : `Close: ${lead.jobTitle}`}
        className={cn(
          "flex size-[17px] shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer",
          isDone
            ? "border-transparent bg-status-green text-white"
            : "border-border/70 hover:border-primary text-transparent",
        )}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </button>

      {/* Main clickable area */}
      <button
        type="button"
        onClick={() => onOpen(lead)}
        className="flex flex-1 min-w-0 items-center gap-3 cursor-pointer text-left"
      >
        {/* Job title + company + profile + location */}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-item font-medium",
              isDone ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {lead.jobTitle}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-muted-foreground font-medium truncate">
              {lead.company}
            </span>
            <span className="text-muted-foreground/30 mx-0.5">·</span>
            <span className="text-xs text-muted-foreground/80 truncate">
              {lead.profileName}
            </span>
            <span className="text-muted-foreground/30 mx-0.5 hidden sm:inline">·</span>
            <MapPin className="size-2.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
            <span className="text-meta text-muted-foreground/70 truncate hidden sm:block">
              {lead.jobLocation}
            </span>
          </div>
        </div>
      </button>

      {/* Right-side meta */}
      <div className="hidden lg:flex items-center gap-4 shrink-0">
        {/* Notes indicator */}
        {lead.notes ? (
          <span className="flex items-center gap-1 text-meta text-muted-foreground/60">
            <MessageSquare className="size-3 shrink-0" />
            <span>1</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-meta text-muted-foreground/25">
            <MessageSquare className="size-3 shrink-0" />
          </span>
        )}

        {/* Work type badge */}
        <TintedBadge color={WORK_TYPE_COLOR[lead.workType]}>
          {lead.workType}
        </TintedBadge>

        {/* Salary */}
        {lead.salary && (
          <span className="hidden xl:block text-xs font-medium text-muted-foreground/80 min-w-[100px]">
            {lead.salary}
          </span>
        )}

        {/* Applied date */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground/70 min-w-[70px]">
          <Calendar className="size-3 shrink-0" />
          <span>{formatDate(lead.appliedAt)}</span>
        </div>

        {/* Assigned BD avatar */}
        {bdName ? (
          <Avatar name={bdName} size={22} />
        ) : (
          <div className="size-[22px] rounded-full border-2 border-dashed border-border" />
        )}
      </div>

      {/* Status select — always visible */}
      <div className="shrink-0" onClick={e => e.stopPropagation()}>
        <LeadStatusSelect
          value={lead.status}
          stages={stages}
          onChange={status => onStatusChange(lead.id, status)}
        />
      </div>
    </div>
  )
}
