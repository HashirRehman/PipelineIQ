"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Calendar, Flag, MessageSquare, Plus } from "lucide-react"
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import type { AppUser, Lead } from "@/components/leads/types"
import { LeadStatusSelect, type StageOption } from "@/components/leads/lead-status-select"
import { stageColor } from "@/lib/constants"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

// ── Root component ────────────────────────────────────────────────────────────
// One column per database stage (pipeline_stages, ordered by order_index) —
// there is no hardcoded stage list anywhere in the board.
export function LeadsBoardView({
  leads,
  users,
  stages,
  onStatusChange,
  onOpen,
}: {
  leads: Lead[]
  users: AppUser[]
  /** Ordered pipeline stages from the API — the board's columns. */
  stages: StageOption[]
  onStatusChange: (id: string, status: string) => void
  onOpen: (lead: Lead) => void
}) {
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const draggingId = useRef<string | null>(null)

  const columns = useMemo(
    () =>
      stages.map((stage, i) => ({
        id: stage.id,
        name: stage.name,
        color: stageColor(i),
        leads: leads.filter(l => l.status === stage.name),
      })),
    [leads, stages],
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
    (e: React.DragEvent, col: (typeof columns)[number]) => {
      e.preventDefault()
      setDragOverColId(null)
      const id = draggingId.current
      if (!id) return
      // Dropping a card onto a stage column moves it to that stage.
      onStatusChange(id, col.name)
      draggingId.current = null
    },
    [onStatusChange],
  )

  return (
    <div className="flex flex-1 min-h-0 overflow-x-auto">
      {columns.map((col, ci) => (
        <BoardColumn
          key={col.id}
          col={col}
          ci={ci}
          totalCols={columns.length}
          isOver={dragOverColId === col.id}
          users={users}
          stages={stages}
          onStatusChange={onStatusChange}
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
  isOver,
  users,
  stages,
  onStatusChange,
  onCardDragStart,
  onCardDragEnd,
  onColDragOver,
  onColDragLeave,
  onColDrop,
  onOpen,
}: {
  col: { id: string; name: string; color: string; leads: Lead[] }
  ci: number
  totalCols: number
  isOver: boolean
  users: AppUser[]
  stages: StageOption[]
  onStatusChange: (id: string, status: string) => void
  onCardDragStart: (id: string) => void
  onCardDragEnd: () => void
  onColDragOver: (e: React.DragEvent, colId: string) => void
  onColDragLeave: (e: React.DragEvent, el: HTMLDivElement | null) => void
  onColDrop: (e: React.DragEvent, col: { id: string; name: string; color: string; leads: Lead[] }) => void
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
        // Columns never shrink below a readable width — when the viewport is
        // narrower than the stage count, the board scrolls horizontally
        // (the wrapper is overflow-x-auto) instead of crushing the columns.
        "flex flex-col min-w-[280px] flex-1 transition-colors duration-100",
        ci < totalCols - 1 && "border-r border-border",
        isOver && "bg-accent/50",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span className="size-[7px] rounded-full shrink-0" style={{ background: col.color }} />
        <span className="text-item font-semibold text-foreground">{col.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{col.leads.length}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Add to ${col.name}`}
          className="ml-auto size-5 rounded text-muted-foreground/40 transition-colors duration-150 hover:bg-accent hover:text-muted-foreground"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Cards area */}
      <div className="flex flex-col gap-1.5 p-2.5 overflow-y-auto flex-1">
        {col.leads.map((lead, i) => (
          <BoardCard
            key={lead.id}
            lead={lead}
            bdName={users.find(u => u.id === lead.assignedTo)?.name}
            isDone={stages.find(s => s.name === lead.status)?.state === "closed"}
            stages={stages}
            delay={Math.min(i, 12) * 25}
            onStatusChange={onStatusChange}
            onDragStart={() => onCardDragStart(lead.id)}
            onDragEnd={onCardDragEnd}
            onOpen={onOpen}
          />
        ))}
        {/* Empty drop zone */}
        {col.leads.length === 0 && (
          <div
            className={cn(
              "flex-1 rounded-md border-2 border-dashed border-border/40 transition-colors duration-150 min-h-[80px]",
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
  isDone,
  stages,
  delay = 0,
  onStatusChange,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  lead: Lead
  bdName?: string
  isDone: boolean
  stages: StageOption[]
  /** Entrance delay (ms) — lets a column of cards stagger in. */
  delay?: number
  onStatusChange: (id: string, status: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: (lead: Lead) => void
}) {
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
      // Entrance stagger only — not applied while dragging (isDragging's
      // scale/opacity is a plain className toggle, not a transition, so the
      // two never fight for the same frame).
      style={!isDragging ? { animation: "chart-rise 0.25s ease-out backwards", animationDelay: `${delay}ms` } : undefined}
      // content-visibility: tall columns render only the cards in view
      // (rendering-content-visibility); the size hint keeps the column
      // scrollbar stable.
      className={cn(
        "w-full rounded-md border border-border bg-card p-2.5 hover:shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing select-none [content-visibility:auto] [contain-intrinsic-size:auto_120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
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

      <p className="mt-0.5 text-meta text-muted-foreground truncate">
        {lead.company}
        {lead.profileName && (
          <span className="text-muted-foreground/70"> · {lead.profileName}</span>
        )}
      </p>

      {/* Stage selector — changing it moves the lead to that stage (same
          action as dragging to another column). Click-stopped so it doesn't
          open the drawer. */}
      <div className="mt-2" onClick={e => e.stopPropagation()}>
        <LeadStatusSelect
          value={lead.status}
          stages={stages}
          onChange={status => onStatusChange(lead.id, status)}
        />
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
