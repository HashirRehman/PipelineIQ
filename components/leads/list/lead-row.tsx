"use client"

import { Calendar, Check, MapPin, MessageSquare } from "lucide-react"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
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
  delay = 0,
  onToggleDone,
  onStatusChange,
  onOpen,
}: {
  lead: Lead
  bdName?: string
  stages: StageOption[]
  doneStage: string | null
  /** Entrance delay (ms) — lets a section's rows stagger in. */
  delay?: number
  onToggleDone: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onOpen: (lead: Lead) => void
}) {
  const isDone = doneStage !== null && lead.status === doneStage

  return (
    // content-visibility: with up to a hundred rows, off-screen rows skip
    // layout/paint until scrolled into view (rendering-content-visibility).
    <div
      style={{ animation: "chart-rise 0.25s ease-out backwards", animationDelay: `${delay}ms` }}
      className={cn(
        "group flex items-center gap-3 border-b border-border bg-background px-5 py-1.5 transition-colors duration-150 hover:bg-accent/40 [content-visibility:auto] [contain-intrinsic-size:auto_52px]",
        isDone && "opacity-55",
      )}
    >
      {/* Done / completion circle */}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => onToggleDone(lead.id)}
        aria-pressed={isDone}
        aria-label={isDone ? `Reopen: ${lead.jobTitle}` : `Close: ${lead.jobTitle}`}
        className={cn(
          "size-[17px] shrink-0 rounded-full border-2 p-0",
          isDone
            ? "border-transparent bg-status-green text-white"
            // The default border token is dark-on-dark in dark mode — use the
            // stronger line token there so the empty circle stays visible.
            : "border-border/70 hover:border-primary dark:border-border-strong text-transparent",
        )}
      >
        <Check className="size-2.5" strokeWidth={3} />
      </Button>

      {/* Main clickable area */}
      <div
        onClick={() => onOpen(lead)}
        className="cursor-pointer h-auto flex-1 min-w-0 items-center gap-3 rounded-none p-0 text-left hover:bg-transparent"
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
      </div>

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
