"use client"

import { useMemo, useState } from "react"

import type { AppUser } from "@/components/leads/types"
import type { Lead } from "@/components/leads/types"
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants"
import { LeadRow } from "./lead-row"
import { LeadStatusSection } from "./lead-status-section"

export function LeadsListView({
  leads,
  users,
  onToggleDone,
  onStatusChange,
  onOpen,
}: {
  leads: Lead[]
  users: AppUser[]
  onToggleDone: (id: string) => void
  onStatusChange: (id: string, status: LeadStatus) => void
  onOpen: (lead: Lead) => void
}) {
  const [collapsed, setCollapsed] = useState<string[]>([])

  // Only stages that actually hold a lead get a section — with ten stages,
  // rendering the empty ones buries the real rows under headers.
  const sections = useMemo(
    () =>
      LEAD_STATUSES.map(status => ({
        status,
        leads: leads.filter(lead => lead.status === status),
      })).filter(section => section.leads.length > 0),
    [leads],
  )

  const toggleSection = (status: string) =>
    setCollapsed(current =>
      current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status],
    )

  if (sections.length === 0) {
    return (
      <div className="flex-1 py-10 text-center text-sm text-[var(--muted-fg)]">
        No leads match your filters
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      {sections.map(section => (
        <LeadStatusSection
          key={section.status}
          status={section.status}
          count={section.leads.length}
          collapsed={collapsed.includes(section.status)}
          onToggle={() => toggleSection(section.status)}
        >
          {section.leads.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              bdName={users.find(u => u.id === lead.assignedTo)?.name}
              onToggleDone={onToggleDone}
              onStatusChange={onStatusChange}
              onOpen={onOpen}
            />
          ))}
        </LeadStatusSection>
      ))}
    </div>
  )
}
