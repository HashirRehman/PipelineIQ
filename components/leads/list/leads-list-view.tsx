"use client"

import { useMemo, useState } from "react"

import type { AppUser } from "@/components/leads/types"
import type { Lead } from "@/components/leads/types"
import { stageColor } from "@/lib/constants"
import type { StageOption } from "@/components/leads/lead-status-select"
import { LeadRow } from "./lead-row"
import { LeadStatusSection } from "./lead-status-section"

export function LeadsListView({
  leads,
  users,
  stages,
  doneStage,
  onToggleDone,
  onStatusChange,
  onOpen,
}: {
  leads: Lead[]
  users: AppUser[]
  /** Ordered pipeline stages from the API — the sections come from these. */
  stages: StageOption[]
  /** The terminal stage (the last one in the ordered list), if any. */
  doneStage: string | null
  onToggleDone: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onOpen: (lead: Lead) => void
}) {
  const [collapsed, setCollapsed] = useState<string[]>([])

  // Only stages that actually hold a lead get a section — with many stages,
  // rendering the empty ones buries the real rows under headers.
  const sections = useMemo(
    () =>
      stages
        .map((stage, i) => ({
          stage: stage.name,
          color: stageColor(i),
          leads: leads.filter(lead => lead.status === stage.name),
        }))
        .filter(section => section.leads.length > 0),
    [leads, stages],
  )

  const toggleSection = (status: string) =>
    setCollapsed(current =>
      current.includes(status)
        ? current.filter(s => s !== status)
        : [...current, status],
    )

  if (sections.length === 0) {
    return (
      <div className="flex-1 py-10 text-center text-sm text-muted-foreground">
        No leads match your filters
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      {sections.map(section => (
        <LeadStatusSection
          key={section.stage}
          status={section.stage}
          color={section.color}
          count={section.leads.length}
          collapsed={collapsed.includes(section.stage)}
          onToggle={() => toggleSection(section.stage)}
        >
          {section.leads.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              bdName={users.find(u => u.id === lead.assignedTo)?.name}
              stages={stages}
              doneStage={doneStage}
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
