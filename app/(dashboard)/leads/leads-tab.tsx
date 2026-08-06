"use client"

import { useState } from "react"
import { LayoutGrid, List } from "lucide-react"

import { LeadsBoardView } from "@/components/leads/board/leads-board-view"
import { LeadFilterBar } from "@/components/leads/lead-filter-bar"
import { LeadsListView } from "@/components/leads/list/leads-list-view"
import { MOCK_LEADS } from "@/components/leads/mock-leads"
import type { AppUser, Lead, Profile } from "@/components/leads/types"
import { useLeadFilters } from "@/components/leads/use-lead-filters"
import { Button } from "@/components/ui/button"
import { LEAD_STATUS_DONE, type LeadStatus } from "@/lib/constants"
import JobDrawer, { type Job } from "@/components/job-drawer"

// Minimal mock shapes used only while this tab renders static data (the
// leads API doesn't exist yet). Kept local so the app shell stays clean.
const MOCK_USERS: AppUser[] = [
  { id: "u1", name: "Alex Rivera", role: "admin" },
  { id: "u2", name: "Jamie Park", role: "bd" },
  { id: "u3", name: "Morgan Lee", role: "bd" },
  { id: "u4", name: "Casey Torres", role: "lead" },
  { id: "u5", name: "Dana Shah", role: "bd" },
]

const MOCK_PROFILES: Profile[] = [
  { id: "p1", name: "Sarah Chen" },
  { id: "p2", name: "Marcus Webb" },
  { id: "p3", name: "Priya Nair" },
  { id: "p4", name: "Jordan Kim" },
  { id: "p5", name: "Nia Okonkwo" },
]

export default function LeadsTab() {
  const users = MOCK_USERS
  const profiles = MOCK_PROFILES
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [view, setView] = useState<"list" | "board">("list")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  // Stage each lead sat in before its checkbox was ticked, so unticking
  // returns it there rather than dumping everything back into "Applied".
  const [stageBeforeDone, setStageBeforeDone] = useState<Record<string, LeadStatus>>({})

  const { filtered, filterProps } = useLeadFilters(leads)
  const bdUsers = users.filter(u => u.role === "bd" || u.role === "lead")

  const updateStatus = (id: string, status: LeadStatus) =>
    setLeads(current =>
      current.map(lead => (lead.id === id ? { ...lead, status } : lead)),
    )

  const toggleDone = (id: string) => {
    const lead = leads.find(l => l.id === id)
    if (!lead) return

    if (lead.status === LEAD_STATUS_DONE) {
      updateStatus(id, stageBeforeDone[id] ?? "Applied")
      return
    }

    setStageBeforeDone(current => ({ ...current, [id]: lead.status }))
    updateStatus(id, LEAD_STATUS_DONE)
  }

  const saveNote = (id: string, bdNotes: string) => {
    setLeads(current =>
      current.map(lead => (lead.id === id ? { ...lead, bdNotes } : lead)),
    )
    setSelectedLead(current => (current?.id === id ? { ...current, bdNotes } : current))
  }

  const jobForLead = (lead: Lead): Job => ({
    id: lead.id,
    title: lead.jobTitle,
    company: lead.company,
    location: lead.jobLocation,
    // Job.workType is the DB's remote/onsite split, which has no "hybrid" —
    // mock hybrid leads show as onsite until this screen reads real data.
    workType: lead.workType === "remote" ? "remote" : "onsite",
    postedAt: lead.appliedAt,
    description: `${lead.company} is looking for a ${lead.jobTitle} to join their team.`,
    parser: lead.parser,
    status: "applied",
    applyUrl: "#",
  })

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-7 px-8">
      <div className="mb-5 flex shrink-0 items-center justify-between">
        <div>
          <h1 className="m-0 text-[22px] font-bold text-[var(--fg)]">Leads</h1>
          <p className="mt-0.5 mb-0 text-xs text-[var(--muted-fg)]">
            {filtered.length} active leads
          </p>
        </div>
        <div className="flex gap-2">
          {(["list", "board"] as const).map(v => (
            <Button
              key={v}
              onClick={() => setView(v)}
              className={`h-auto cursor-pointer rounded-md px-3.5 py-1.75 text-xs shadow-none transition-colors hover:bg-transparent ${
                view === v
                  ? "border border-cyan-500/30 bg-cyan-500/12 font-semibold text-[var(--primary)]"
                  : "border border-[var(--border-strong)] bg-transparent font-normal text-[var(--fg)] hover:border-gray-500"
              }`}
            >
              <span className="flex items-center gap-1.25">
                {v === "list" ? <List size={12} /> : <LayoutGrid size={12} />}
                {v === "list" ? "List" : "Board"}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <LeadFilterBar {...filterProps} profiles={profiles} bdUsers={bdUsers} />

      {view === "list" ? (
        <LeadsListView
          leads={filtered}
          users={users}
          onToggleDone={toggleDone}
          onStatusChange={updateStatus}
          onOpen={setSelectedLead}
        />
      ) : (
        <LeadsBoardView
          leads={filtered}
          users={users}
          onStatusChange={updateStatus}
          onOpen={setSelectedLead}
        />
      )}

      {selectedLead && (
        <JobDrawer
          job={jobForLead(selectedLead)}
          onClose={() => setSelectedLead(null)}
          activeProfile={profiles[0]}
          showActions={false}
          notes={selectedLead.bdNotes}
          onNotesSave={value => saveNote(selectedLead.id, value)}
        />
      )}
    </div>
  )
}
