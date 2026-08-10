"use client"

import { useEffect, useState } from "react"
import { List, LayoutDashboard, Plus, Loader2 } from "lucide-react"

import type { ApiLead, ApiLeadUser } from "@/app/api/leads/route"
import { LeadsBoardView } from "@/components/leads/board/leads-board-view"
import { LeadFilterBar } from "@/components/leads/lead-filter-bar"
import { LeadsListView } from "@/components/leads/list/leads-list-view"
import type { AppUser, Lead, Profile } from "@/components/leads/types"
import { DateRangeFilter } from "@/components/jobs/date-range-filter"
import { SortFilter } from "@/components/jobs/sort-filter"
import { GooeyInput } from "@/components/ui/gooey-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  LEAD_STATUS_DONE,
  LEAD_STATUSES,
  type DateRange,
  type LeadStatus,
  type SortOption,
} from "@/lib/constants"
import { apiPatch, withOrgId } from "@/lib/api/client"
import { getDateWindow } from "@/lib/date-window"
import JobDrawer, { type Job } from "@/components/job-drawer"

const PAGE_SIZE = 100

interface LeadsResponse {
  leads: ApiLead[]
  users: ApiLeadUser[]
  profiles: { id: string; name: string; userId: string | null }[]
  pipelineStages: { id: string; name: string; orderIndex: number }[]
  currentUser: { id: string; name: string }
  canManageLeadNotes: boolean
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

const buildQueryKey = (opts: {
  search: string
  status: string
  profileId: string
  userId: string
  dateRange: DateRange
  sort: SortOption
}) => {
  const params = new URLSearchParams({
    search: opts.search,
    status: opts.status === "all" ? "" : opts.status,
    profileId: opts.profileId === "all" ? "" : opts.profileId,
    userId: opts.userId === "all" ? "" : opts.userId,
    dateRange: opts.dateRange,
    sort: opts.sort,
    pageSize: String(PAGE_SIZE),
  })
  // Exact week/month/year window (leads are dated by applied_at).
  const window = getDateWindow(opts.dateRange)
  if (window) {
    params.set("from", window.from)
    params.set("to", window.to)
  }
  return params.toString()
}

function toLead(a: ApiLead): Lead {
  return {
    id: a.id,
    jobId: a.jobId,
    profileId: a.profileId,
    profileName: a.profileName,
    jobTitle: a.jobTitle,
    company: a.company,
    jobLocation: a.jobLocation,
    workType: a.workType,
    appliedAt: a.appliedAt,
    status: a.status as LeadStatus,
    assignedTo: a.assignedTo,
    notes: a.notes,
    salary: null,
    parser: a.parser,
    applyUrl: a.applyUrl,
  }
}

export default function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [stages, setStages] = useState<LeadsResponse["pipelineStages"]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null)
  const [canManageLeadNotes, setCanManageLeadNotes] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [profileFilter, setProfileFilter] = useState("all")
  const [bdFilter, setBdFilter] = useState("all")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [sort, setSort] = useState<SortOption>("newest")

  const [view, setView] = useState<"list" | "board">("list")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Stage each lead sat in before its checkbox was ticked, so unticking
  // returns it there rather than dumping everything back into "Applied".
  const [stageBeforeDone, setStageBeforeDone] = useState<Record<string, LeadStatus>>({})

  const queryKey = buildQueryKey({ search, status: statusFilter, profileId: profileFilter, userId: bdFilter, dateRange, sort })
  const loading = appliedKey !== queryKey

  const loadLeads = (key: string) => {
    fetch(withOrgId(`/api/leads?${key}`))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load leads")
        return res.json() as Promise<LeadsResponse>
      })
      .then((json) => {
        setLeads(json.leads.map(toLead))
        setUsers(json.users)
        setProfiles(json.profiles)
        setStages(json.pipelineStages)
        setCurrentUser(json.currentUser)
        setCanManageLeadNotes(json.canManageLeadNotes ?? false)
        setError(null)
      })
      .catch((err) => {
        console.error("Failed to load leads:", err)
        setError("Failed to load leads")
      })
      .finally(() => setAppliedKey(key))
  }

  useEffect(() => {
    loadLeads(queryKey)
  }, [queryKey])

  const changeSearch = (v: string) => setSearch(v)
  const changeStatus = (v: string | null) => setStatusFilter(v ?? "all")
  const changeProfile = (v: string) => setProfileFilter(v ?? "all")
  const changeBd = (v: string) => setBdFilter(v ?? "all")
  const changeDateRange = (v: DateRange) => setDateRange(v)
  const changeSort = (v: SortOption) => setSort(v)

  const stageIdFor = (status: LeadStatus) => stages.find((s) => s.name === status)?.id ?? null

  const updateStatus = async (id: string, status: LeadStatus) => {
    const stageId = stageIdFor(status)
    if (!stageId) return
    // Optimistic update — the status select / board drag should feel instant.
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, status } : lead)))
    setSelectedLead((current) => (current?.id === id ? { ...current, status } : current))
    try {
      await apiPatch<{ success: boolean }>(`/api/leads/${id}`, { pipelineStageId: stageId })
    } catch (err) {
      console.error("Failed to update lead status:", err)
      loadLeads(queryKey) // resync
    }
  }

  const toggleDone = (id: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead) return

    if (lead.status === LEAD_STATUS_DONE) {
      updateStatus(id, stageBeforeDone[id] ?? "Applied")
      return
    }

    setStageBeforeDone((current) => ({ ...current, [id]: lead.status }))
    updateStatus(id, LEAD_STATUS_DONE)
  }

  // Applier's Notes: the profile's current assigned user (assignedTo — leads
  // follow the profile) may write or edit them — plus Admins and BD
  // Managers, who manage the whole pipeline (canManageLeadNotes).
  const canEditNotes = Boolean(
    currentUser &&
    selectedLead &&
    (currentUser.id === selectedLead.assignedTo || canManageLeadNotes),
  )

  const saveNote = async (id: string, notes: string) => {
    const lead = leads.find((l) => l.id === id)
    if (!lead || !currentUser || (currentUser.id !== lead.assignedTo && !canManageLeadNotes)) return
    setLeads((current) => current.map((l) => (l.id === id ? { ...l, notes } : l)))
    setSelectedLead((current) => (current?.id === id ? { ...current, notes } : current))
    try {
      await apiPatch<{ success: boolean }>(`/api/leads/${id}`, { notes })
    } catch (err) {
      console.error("Failed to save note:", err)
      loadLeads(queryKey)
    }
  }

  const jobForLead = (lead: Lead): Job => ({
    id: lead.id,
    title: lead.jobTitle,
    company: lead.company,
    location: lead.jobLocation,
    workType: lead.workType === "remote" ? "remote" : "onsite",
    postedAt: lead.appliedAt,
    description: `${lead.company} is looking for a ${lead.jobTitle} to join their team.`,
    parser: lead.parser,
    status: "applied",
    applyUrl: lead.applyUrl,
    isLead: true,
    profiles: [],
  })

  const bdUsers = users.filter((u) => u.role === "bd" || u.role === "lead")

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Toolbar — compact row */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
        <span className="text-sm font-semibold text-foreground mr-1">
          Leads
        </span>
        <span className="flex size-5 items-center justify-center rounded bg-accent text-meta font-semibold text-muted-foreground tabular-nums">
          {leads.length}
        </span>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* Search */}
        <GooeyInput
          value={search}
          onValueChange={changeSearch}
          placeholder="Search leads..."
          expandedWidth={192}
        />

        {/* Status dropdown */}
        <Select value={statusFilter} onValueChange={changeStatus}>
          <SelectTrigger size="sm" className="h-7 w-auto min-w-[130px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Status: any</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range + sort (shared with Discovery) */}
        <DateRangeFilter value={dateRange} onValueChange={changeDateRange} />
        <SortFilter
          value={sort}
          onValueChange={changeSort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
            { value: "company_asc", label: "Company A–Z" },
            { value: "company_desc", label: "Company Z–A" },
          ]}
        />

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
            title="Leads are created from applied jobs in the Pipeline page."
            className="flex items-center gap-1.5 h-7 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
          >
            <Plus className="size-3.5" />
            New lead
          </button>
        </div>
      </div>

      {/* Profile / user filters — a manager/admin tool. Business Developers
          only ever see their own data, so the bar is hidden for them. */}
      {canManageLeadNotes && (
        <LeadFilterBar
          profiles={profiles}
          bdUsers={bdUsers}
          profileFilter={profileFilter}
          setProfileFilter={changeProfile}
          bdFilter={bdFilter}
          setBdFilter={changeBd}
        />
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex-1 py-10 text-center text-sm text-destructive">{error}</div>
        ) : view === "list" ? (
          <LeadsListView
            leads={leads}
            users={users}
            onToggleDone={toggleDone}
            onStatusChange={updateStatus}
            onOpen={setSelectedLead}
          />
        ) : (
          <LeadsBoardView
            leads={leads}
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
        profiles={profiles.filter((p) => p.id === selectedLead?.profileId)}
        showActions={false}
        commentsJobId={selectedLead?.jobId}
        notes={selectedLead?.notes}
        onNotesSave={(value) => { if (selectedLead) saveNote(selectedLead.id, value) }}
        canEditNotes={canEditNotes}
      />
    </div>
  )
}
