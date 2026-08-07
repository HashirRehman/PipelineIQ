"use client"

import type { AppUser } from "@/components/leads/types"
import { useLeadDnd } from "@/components/leads/use-lead-dnd"
import type { Lead } from "@/components/leads/types"
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants"
import { BoardColumn } from "./board-column"
import { LeadCard } from "./lead-card"

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
  const { draggingId, dragOverStatus, startDrag, dragOver, dragLeave, drop, endDrag } =
    useLeadDnd(onStatusChange)

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex h-full min-w-max gap-3.5">
        {LEAD_STATUSES.map(status => {
          const columnLeads = leads.filter(lead => lead.status === status)
          return (
            <BoardColumn
              key={status}
              status={status}
              count={columnLeads.length}
              isDropTarget={dragOverStatus === status}
              onDragOver={dragOver}
              onDragLeave={dragLeave}
              onDrop={drop}
            >
              {columnLeads.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  bdName={users.find(u => u.id === lead.assignedTo)?.name}
                  isDragging={draggingId === lead.id}
                  onDragStart={startDrag}
                  onDragEnd={endDrag}
                  onOpen={onOpen}
                />
              ))}
            </BoardColumn>
          )
        })}
      </div>
    </div>
  )
}
