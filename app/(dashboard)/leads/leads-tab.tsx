"use client"

import { useState } from "react"
import { List, LayoutDashboard, Plus, ChevronDown, Search } from "lucide-react"

import { LeadsBoardView } from "@/components/leads/board/leads-board-view"
import { LeadFilterBar } from "@/components/leads/lead-filter-bar"
import { LeadsListView } from "@/components/leads/list/leads-list-view"
import { MOCK_LEADS } from "@/components/leads/mock-leads"
import type { AppUser, Lead, Profile } from "@/components/leads/types"
import { useLeadFilters } from "@/components/leads/use-lead-filters"
import { cn } from "@/lib/utils"
import { LEAD_STATUS_DONE, LEAD_STATUSES, type LeadStatus } from "@/lib/constants"
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

  const { search, setSearch, statusFilter, setStatusFilter } = filterProps

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
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">

      {/* Toolbar — compact row */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
        <span className="text-sm font-semibold text-foreground mr-1">
          Leads
        </span>
        <span className="flex size-5 items-center justify-center rounded bg-accent text-meta font-semibold text-muted-foreground tabular-nums">
          {filtered.length}
        </span>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Search */}
        <div className="relative w-48">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="h-7 w-full rounded border border-border bg-transparent pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition"
          />
        </div>

        {/* Status dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as LeadStatus | "all")}
            className="h-7 appearance-none rounded border border-border bg-transparent pl-2.5 pr-6 text-xs text-muted-foreground outline-none hover:border-border/80 focus:border-primary/50 cursor-pointer transition"
          >
            <option value="all">Status: any</option>
            {LEAD_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50" />
        </div>

        {/* Overdue chip */}
        <button
          type="button"
          className="h-7 px-2.5 rounded border border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
        >
          Overdue
        </button>

        {/* Right: List / Board toggle + New button */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center rounded border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-7 text-xs transition cursor-pointer",
                view === "list"
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <List className="size-3.5" />
              List
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-7 text-xs transition cursor-pointer",
                view === "board"
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <LayoutDashboard className="size-3.5" />
              Board
            </button>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 h-7 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
          >
            <Plus className="size-3.5" />
            New lead
          </button>
        </div>
      </div>

      {/* Profile / BD filters (kept from the current app) */}
      <LeadFilterBar
        profiles={profiles}
        bdUsers={bdUsers}
        profileFilter={filterProps.profileFilter}
        setProfileFilter={filterProps.setProfileFilter}
        bdFilter={filterProps.bdFilter}
        setBdFilter={filterProps.setBdFilter}
      />

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
      </div>

      <JobDrawer
        open={selectedLead !== null}
        job={selectedLead ? jobForLead(selectedLead) : null}
        onClose={() => setSelectedLead(null)}
        activeProfile={profiles[0]}
        showActions={false}
        notes={selectedLead?.bdNotes}
        onNotesSave={value => { if (selectedLead) saveNote(selectedLead.id, value) }}
      />
    </div>
  )
}
