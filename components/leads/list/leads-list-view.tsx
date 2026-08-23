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
  onToggleDone,
  onStatusChange,
  onOpen,
}: {
  leads: Lead[]
  users: AppUser[]
  /** Ordered pipeline stages from the API — the sections come from these. */
  stages: StageOption[]
  onToggleDone: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onOpen: (lead: Lead) => void
}) {
  const [collapsed, setCollapsed] = useState<string[]>([])

  // Only stages that actually hold a lead get a section — with many stages,
  // rendering the empty ones buries the real rows under headers. Sections
  // stay in the stages array's own order (orderIndex — the same order the
  // Board's columns and the admin's Lead Stages page use); a paused stage
  // is marked with a badge (LeadStatusSection's `paused` prop) rather than
  // being pulled out of order, so the list never disagrees with the Board
  // about where a stage sits in the pipeline.
  const sections = useMemo(
    () =>
      stages
        .map((stage, i) => ({
          stage: stage.name,
          state: stage.state,
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
          paused={section.state === "paused"}
          onToggle={() => toggleSection(section.stage)}
        >
          {section.leads.map((lead, i) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              bdName={users.find(u => u.id === lead.assignedTo)?.name}
              stages={stages}
              delay={Math.min(i, 12) * 20}
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
