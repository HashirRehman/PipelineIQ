"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Calendar, Flag, MessageSquare, Plus } from "lucide-react"
import { Avatar } from "@/components/avatar"
import type { AppUser, Lead } from "@/components/leads/types"
import { LEAD_STATUS_COLOR, type LeadStatus } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

// ── Column definitions ────────────────────────────────────────────────────────
const BOARD_COLUMNS: { id: string; label: string; statuses: LeadStatus[] }[] = [
  {
    id: "new",
    label: "New / Applied",
    statuses: ["Applied", "Assessment Received", "Assessment Submitted"],
  },
  {
    id: "interviewing",
    label: "Interviewing",
    statuses: ["HR Interview", "Tech Interview 1", "Tech Interview 2", "Client Interview"],
  },
  {
    id: "offer",
    label: "Offer Stage",
    statuses: ["Offer Received", "Offer Accepted/Rejected"],
  },
  {
    id: "closed",
    label: "Closed",
    statuses: ["Closed"],
  },
]

const COLUMN_DOT_COLOR = BOARD_COLUMNS.map(col => LEAD_STATUS_COLOR[col.statuses[0]])

// ── Root component ────────────────────────────────────────────────────────────
export function LeadsBoardView({
  leads,
  users,
  onStatusChange,
  onOpen,
}: {
  leads: Lead[]
  users: AppUser[]
  onStatusChange: (id: string, status: LeadStatus) => void
  onOpen: (lead: Lead) => void
}) {
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const draggingId = useRef<string | null>(null)

  const columns = useMemo(
    () =>
      BOARD_COLUMNS.map(col => ({
        ...col,
        leads: leads.filter(l => (col.statuses as readonly string[]).includes(l.status)),
      })),
    [leads],
  )

  const handleDragStart = useCallback((leadId: string) => {
    draggingId.current = leadId
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragOverColId(null)
    draggingId.current = null
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverColId(colId)
  }, [])

  const handleColumnDragLeave = useCallback(
    (e: React.DragEvent, colEl: HTMLDivElement | null) => {
      if (colEl && !colEl.contains(e.relatedTarget as Node)) {
        setDragOverColId(null)
      }
    },
    [],
  )

  const handleColumnDrop = useCallback(
    (e: React.DragEvent, col: (typeof BOARD_COLUMNS)[number]) => {
      e.preventDefault()
      setDragOverColId(null)
      const id = draggingId.current
      if (!id) return
      // Preserve the card's exact stage when it's dropped back into its own
      // group; only fall back to the group's first status when it enters a
      // new pipeline stage.
      const currentStatus = leads.find(l => l.id === id)?.status
      const target =
        currentStatus && col.statuses.includes(currentStatus)
          ? currentStatus
          : col.statuses[0]
      onStatusChange(id, target)
      draggingId.current = null
    },
    [onStatusChange, leads],
  )

  return (
    <div className="flex flex-1 min-h-0 overflow-x-auto">
      {columns.map((col, ci) => (
        <BoardColumn
          key={col.id}
          col={col}
          ci={ci}
          totalCols={columns.length}
          dotColor={COLUMN_DOT_COLOR[ci]}
          isOver={dragOverColId === col.id}
          users={users}
          onCardDragStart={handleDragStart}
          onCardDragEnd={handleDragEnd}
          onColDragOver={handleColumnDragOver}
          onColDragLeave={handleColumnDragLeave}
          onColDrop={handleColumnDrop}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

// ── Board column ──────────────────────────────────────────────────────────────
function BoardColumn({
  col,
  ci,
  totalCols,
  dotColor,
  isOver,
  users,
  onCardDragStart,
  onCardDragEnd,
  onColDragOver,
  onColDragLeave,
  onColDrop,
  onOpen,
}: {
  col: (typeof BOARD_COLUMNS)[number] & { leads: Lead[] }
  ci: number
  totalCols: number
  dotColor: string
  isOver: boolean
  users: AppUser[]
  onCardDragStart: (id: string) => void
  onCardDragEnd: () => void
  onColDragOver: (e: React.DragEvent, colId: string) => void
  onColDragLeave: (e: React.DragEvent, el: HTMLDivElement | null) => void
  onColDrop: (e: React.DragEvent, col: (typeof BOARD_COLUMNS)[number]) => void
  onOpen: (lead: Lead) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      onDragOver={e => onColDragOver(e, col.id)}
      onDragLeave={e => onColDragLeave(e, ref.current)}
      onDrop={e => onColDrop(e, col)}
      className={cn(
        "flex flex-col min-w-0 flex-1 transition-colors duration-100",
        ci < totalCols - 1 && "border-r border-border",
        isOver && "bg-accent/50",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span className="size-[7px] rounded-full shrink-0" style={{ background: dotColor }} />
        <span className="text-item font-semibold text-foreground">{col.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{col.leads.length}</span>
        <button
          type="button"
          aria-label={`Add to ${col.label}`}
          className="ml-auto flex size-5 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {/* Cards area */}
      <div className="flex flex-col gap-1.5 p-2.5 overflow-y-auto flex-1">
        {col.leads.map(lead => (
          <BoardCard
            key={lead.id}
            lead={lead}
            bdName={users.find(u => u.id === lead.assignedTo)?.name}
            onDragStart={() => onCardDragStart(lead.id)}
            onDragEnd={onCardDragEnd}
            onOpen={onOpen}
          />
        ))}
        {/* Empty drop zone */}
        {col.leads.length === 0 && (
          <div
            className={cn(
              "flex-1 rounded-md border-2 border-dashed border-border/40 transition-colors min-h-[80px]",
              isOver && "border-primary/50 bg-primary/5",
            )}
          />
        )}
      </div>
    </div>
  )
}

// ── Board card ────────────────────────────────────────────────────────────────
function BoardCard({
  lead,
  bdName,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  lead: Lead
  bdName?: string
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: (lead: Lead) => void
}) {
  const statusColor = LEAD_STATUS_COLOR[lead.status]
  const isDone = lead.status === "Closed"
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", lead.id)
        setIsDragging(true)
        onDragStart()
      }}
      onDragEnd={() => {
        setIsDragging(false)
        onDragEnd()
      }}
      onClick={() => onOpen(lead)}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && onOpen(lead)}
      aria-label={`${lead.jobTitle} at ${lead.company}`}
      className={cn(
        "w-full rounded-md border border-border bg-card p-2.5 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40 scale-95 shadow-md",
        isDone && "opacity-50",
      )}
    >
      <p className={cn(
        "text-item font-medium leading-snug",
        isDone ? "line-through text-muted-foreground" : "text-foreground",
      )}>
        {lead.jobTitle}
      </p>

      <p className="mt-0.5 text-meta text-muted-foreground truncate">{lead.company}</p>

      <div className="mt-2">
        <span
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-meta font-medium"
          style={{ background: `color-mix(in srgb, ${statusColor} 10%, transparent)`, color: statusColor }}
        >
          <span className="size-[5px] rounded-full shrink-0" style={{ background: statusColor }} />
          {lead.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-meta text-muted-foreground/60">
        <Flag className="size-3 shrink-0" />
        {lead.appliedAt && (
          <span className="flex items-center gap-0.5">
            <Calendar className="size-3 shrink-0" />
            {formatDate(lead.appliedAt)}
          </span>
        )}
        {lead.notes && (
          <span className="flex items-center gap-0.5">
            <MessageSquare className="size-3 shrink-0" />
            1
          </span>
        )}
        {bdName && <span className="ml-auto"><Avatar name={bdName} size={20} /></span>}
      </div>
    </div>
  )
}
