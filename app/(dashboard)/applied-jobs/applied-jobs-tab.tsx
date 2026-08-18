"use client"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Briefcase, SlidersHorizontal, Plus, Upload } from "lucide-react"
import type { DiscoveryProfile } from "@/app/api/discovery/route"
import { Button } from "@/components/ui/button"
import { GooeyInput } from "@/components/ui/gooey-input"
import { Skeleton } from "@/components/ui/skeleton"
import { CountryCombobox } from "@/components/ui/country-combobox"
import { FilterOption } from "@/components/jobs/filter-option"
import { EngagementSection } from "@/components/jobs/filter-sections"
import { FilterSidebar } from "@/components/jobs/filter-sidebar"
import { JobCard } from "@/components/jobs/job-card"
import { JobListView } from "@/components/jobs/job-list-view"
import { Pagination } from "@/components/jobs/pagination"
import { ViewToggle } from "@/components/jobs/view-toggle"
import { useJobView } from "@/hooks/use-job-view"
import JobDrawer, { type Job } from "@/components/job-drawer"
import { ProfileUserFilters } from "@/components/leads/profile-user-filters"
import { ResultsCount } from "@/components/results-count"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DATE_RANGES,
  SORT_OPTIONS,
  WORK_TYPES,
  WORK_TYPE_COLOR,
  type DateRange,
  type EngagementType,
  type SortOption,
} from "@/lib/constants"
import {
  dateRangeLabel,
  getDateWindow,
  getMonthWindow,
  getYearWindow,
  monthWindowLabel,
  yearWindowLabel,
} from "@/lib/date-window"
import { cn } from "@/lib/utils"
import { apiGet, apiPatch, apiPost } from "@/lib/api/client"
import { queryKeys } from "@/lib/api/query-keys"
import { NewJobDialog, type NewJobStage } from "@/components/jobs/new-job-dialog"
import dynamic from "next/dynamic"

// Loaded on demand — the Excel parser (SheetJS) is a ~330 KB chunk that
// should never ship on a page load when the user isn't importing.
const ImportJobsDialog = dynamic(
  () =>
    import("@/components/jobs/import-jobs-dialog").then(
      m => m.ImportJobsDialog,
    ),
  { ssr: false },
)

const PAGE_SIZE = 20

// Lead visibility on the applied feed. Default: jobs already in the leads
// pipeline are hidden; "in_leads" shows only those; "all" shows both.
type LeadFilter = "exclude" | "in_leads" | "all"

const LEAD_FILTERS: readonly { value: LeadFilter; label: string }[] = [
  { value: "exclude", label: "Not in Leads" },
  { value: "in_leads", label: "In Leads" },
  { value: "all", label: "All" },
]

interface AppliedJobsResponse {
  jobs: Job[]
  profiles: DiscoveryProfile[]
  /** Team roster for the filter sidebar — populated for Admin/BD Manager only.
   * profileIds links each user to their currently assigned profiles, so the
   * profile/user filters can constrain each other. */
  users: { id: string; name: string; role: "admin" | "lead" | "bd"; profileIds: string[] }[]
  /** True when the caller may see (and filter by) every user's data. */
  canViewAllData: boolean
  canEditJobs: boolean
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  parsers?: string[]
  /** Lead stages (the DB list) for the New Job dialog. */
  pipelineStages?: { id: string; name: string; orderIndex: number }[]
}

const buildQueryKey = (opts: {
  page: number
  workType: string
  parser: string
  search: string
  country: string
  dateRange: DateRange
  /** Selected month of THIS year (0–11), or null — exclusive with the others. */
  month: number | null
  /** Selected calendar year, or null — exclusive with the others. */
  year: number | null
  sort: SortOption
  leadFilter: LeadFilter
  profileId: string
  userId: string
  engagement: EngagementType | ""
}) => {
  const params = new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    status: "applied",
    workType: opts.workType === "All Types" ? "" : opts.workType,
    parser: opts.parser === "All Sources" ? "" : opts.parser,
    search: opts.search,
    country: opts.country,
    dateRange: opts.dateRange,
    month: opts.month === null ? "" : String(opts.month),
    year: opts.year === null ? "" : String(opts.year),
    sort: opts.sort,
    leadFilter: opts.leadFilter === "exclude" ? "" : opts.leadFilter,
    profileId: opts.profileId === "all" ? "" : opts.profileId,
    userId: opts.userId === "all" ? "" : opts.userId,
    engagement: opts.engagement,
  })
  // Exactly one date control is active; its window (computed client-side in
  // local time) drives the applied-date filter. The applied feed is filtered
  // by when the jobs were APPLIED, not posted.
  const window =
    opts.month !== null
      ? getMonthWindow(opts.month, new Date().getFullYear())
      : opts.year !== null
        ? getYearWindow(opts.year)
        : getDateWindow(opts.dateRange)
  if (window) {
    params.set("from", window.from)
    params.set("to", window.to)
  }
  return params.toString()
}

export default function AppliedJobsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [parserFilter, setParserFilter] = useState("All Sources")
  const [workTypeFilter, setWorkTypeFilter] = useState("All Types")
  const [countryFilter, setCountryFilter] = useState("")
  const [engagementFilter, setEngagementFilter] = useState<EngagementType | "">("")
  const [page, setPage] = useState(1)
  // Default: the current Friday–Thursday week (the business week), and the
  // applied feed is newest-first (by when jobs were applied).
  const [dateRange, setDateRange] = useState<DateRange>("this_week")
  // Months-of-this-year and year dropdowns — picking one clears the others
  // (they'd otherwise conflict). null = that control is inactive.
  const [monthFilter, setMonthFilter] = useState<number | null>(null)
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [sort, setSort] = useState<SortOption>("newest")
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("exclude")
  // Manager/Admin team filters — which profile or user's applied jobs to
  // show. Defaults to "all" (everyone's data); the bar is hidden for roles
  // that only see their own data.
  const [profileFilter, setProfileFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [newJobOpen, setNewJobOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [addToLeadPending, setAddToLeadPending] = useState(false)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissReason, setDismissReason] = useState("")
  const [view, setView] = useJobView()
  // Calendar year/month for the months-of-this-year and year dropdowns.
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const loadingKey = buildQueryKey({ page, workType: workTypeFilter, parser: parserFilter, search, country: countryFilter, dateRange, month: monthFilter, year: yearFilter, sort, leadFilter, profileId: profileFilter, userId: userFilter, engagement: engagementFilter })
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.jobs.applied(loadingKey),
    queryFn: ({ signal }) => apiGet<AppliedJobsResponse>(`/api/discovery?${loadingKey}`, signal),
  })

  const jobs = data?.jobs ?? []
  const profiles = data?.profiles ?? []
  const users = data?.users ?? []
  const canViewAllData = data?.canViewAllData ?? false
  const canEditJobs = data?.canEditJobs ?? false
  const totalCount = data?.totalCount ?? 0
  const totalPages = data?.totalPages ?? 1
  const parsers = data?.parsers?.length ? data.parsers : ["All Sources"]
  const pipelineStages: NewJobStage[] = data?.pipelineStages ?? []

  // Shares /api/discovery with the Discovery feed, so invalidate the whole area.
  const refreshJobs = () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() })

  // Dismissing the last page's jobs can leave `page` past the end.
  if (data && page > data.totalPages) {
    setPage(Math.max(1, data.totalPages))
  }

  const changeSearch = (v: string) => { setSearch(v); setPage(1) }
  const changeWorkType = (v: string) => { setWorkTypeFilter(v); setPage(1) }
  const changeParser = (v: string) => { setParserFilter(v); setPage(1) }
  const changeCountry = (v: string) => { setCountryFilter(v); setPage(1) }
  const changeEngagement = (v: EngagementType | "") => { setEngagementFilter(v); setPage(1) }

  // Returns an error message to keep the inline editor open, or null on
  // success. The edited job is refetched so manual_overrides and the new value
  // come back from the server rather than being guessed here.
  const saveJobFields = async (patch: Record<string, string | boolean | null>) => {
    if (!selectedJob) return "No job selected."
    try {
      await apiPatch<{ success: boolean }>(`/api/jobs/${selectedJob.id}`, patch)
      await refreshJobs()
      return null
    } catch (err) {
      return err instanceof Error ? err.message : "Something went wrong. Please try again."
    }
  }
  const changeDateRange = (v: DateRange) => {
    setDateRange(v)
    setMonthFilter(null)
    setYearFilter(null)
    setPage(1)
  }
  const changeMonth = (v: string) => {
    const month = v === "" ? null : Number(v)
    setMonthFilter(month)
    // Picking a real month yields the quick range; picking "All months"
    // only clears the month filter (leaving the quick range as it was).
    if (month !== null) {
      setDateRange("all")
      setYearFilter(null)
    }
    setPage(1)
  }
  const changeYear = (v: string) => {
    const year = v === "" ? null : Number(v)
    setYearFilter(year)
    // Picking a real year yields the quick range and month filter;
    // picking "All years" only clears the year filter.
    if (year !== null) {
      setDateRange("all")
      setMonthFilter(null)
    }
    setPage(1)
  }
  const changeSort = (v: SortOption) => { setSort(v); setPage(1) }
  const changeLeadFilter = (v: LeadFilter) => { setLeadFilter(v); setPage(1) }
  const changeProfile = (v: string) => { setProfileFilter(v ?? "all"); setPage(1) }
  const changeUser = (v: string) => { setUserFilter(v ?? "all"); setPage(1) }

  const isActiveFilter =
    parserFilter !== "All Sources" ||
    workTypeFilter !== "All Types" ||
    countryFilter !== "" ||
    dateRange !== "this_week" ||
    monthFilter !== null ||
    yearFilter !== null ||
    sort !== "newest" ||
    leadFilter !== "exclude" ||
    profileFilter !== "all" ||
    userFilter !== "all"

  const clearFilters = () => {
    setParserFilter("All Sources")
    setWorkTypeFilter("All Types")
    setCountryFilter("")
    setEngagementFilter("")
    setDateRange("this_week")
    setMonthFilter(null)
    setYearFilter(null)
    setSort("newest")
    setLeadFilter("exclude")
    setProfileFilter("all")
    setUserFilter("all")
    setPage(1)
  }

  const handleAddToLead = async (profileIds: string[]) => {
    if (!selectedJob || !profiles.length || addToLeadPending) return
    setAddToLeadPending(true)
    try {
      await apiPost<{ success: boolean }>("/api/leads", { jobId: selectedJob.id, profileIds })
    } catch (err) {
      console.error("addToLead failed", err)
      return
    } finally {
      setAddToLeadPending(false)
    }
    // The default "Not in Leads" filter hides fully-lead jobs from the feed;
    // the silent refresh reflects that (and the updated badge on mixed jobs).
    setSelectedJob(null)
    await refreshJobs()
  }

  const handleDismiss = async (id: string, reason: string, profileIds: string[]) => {
    if (!profiles.length) return
    try {
      await apiPost<{ success: boolean }>("/api/discovery/dismiss", { jobId: id, profileIds, reason })
    } catch (err) {
      console.error("dismissJob failed", err)
      return
    }
    setSelectedJob(null)
    setDismissReason("")
    setDismissOpen(false)
    await refreshJobs()
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Search bar + filters toggle */}
        <div className="flex justify-between items-center gap-2 px-5 py-3 border-b border-border bg-background shrink-0">
          <GooeyInput
            value={search}
            onValueChange={changeSearch}
            placeholder="Search pipeline by title, company, or location…"
            expandedWidth={300}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="rounded px-3 text-xs text-muted-foreground hover:bg-accent"
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setNewJobOpen(true)}
              className="rounded px-3 text-xs hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              New Job
            </Button>
            <ViewToggle view={view} onChange={setView} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(open => !open)}
              className={cn(
                "h-9 shrink-0 rounded-md px-3 text-xs font-medium hover:bg-accent",
                filtersOpen
                  ? "border-border bg-accent text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
            </Button>
          </div>
        </div>

        {/* Jobs grid + pagination */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Failed to load pipeline
            </div>
          ) : isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border">
              <Briefcase className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">No pipeline jobs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || isActiveFilter
                  ? "Try adjusting your search or filters."
                  : "Jobs marked as applied in Discovery will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center pb-3">
                <ResultsCount count={totalCount} label="applied" />
              </div>
              {view === "list" ? (
                <JobListView jobs={jobs} onClick={setSelectedJob} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {jobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => setSelectedJob(job)}
                    />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onChange={setPage} className="mt-6" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Right filter sidebar — every filter lives here: Profile, User, Date,
          Work Type, Country, Type, Source, Leads visibility, Sort. */}
      <FilterSidebar
        open={filtersOpen}
        clearable={isActiveFilter}
        onClear={clearFilters}
        widthClass="w-[260px]"
      >
          {/* Profile + User (coupled) — manager/admin only */}
          {canViewAllData && (
            <div className="px-4 pb-4">
              <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                Team
              </p>
              <ProfileUserFilters
                stacked
                profiles={profiles}
                bdUsers={users.filter(u => u.role === "bd" || u.role === "lead")}
                profileFilter={profileFilter}
                setProfileFilter={changeProfile}
                bdFilter={userFilter}
                setBdFilter={changeUser}
              />
            </div>
          )}

          {/* Date — three mutually-exclusive controls: quick ranges (this /
              last week/month/year, all time), months of this year, and
              this/last year. Picking one clears the others; each option
              shows its exact date range for transparency. */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Date
            </p>
            <div className="flex flex-col gap-2">
              <Select value={dateRange} onValueChange={v => changeDateRange((v ?? "this_week") as DateRange)}>
                <SelectTrigger size="sm" className="h-7 w-full rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map(range => (
                    <SelectItem key={range.value} value={range.value} className="text-xs">
                      {dateRangeLabel(range.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={monthFilter === null ? "" : String(monthFilter)} onValueChange={v => changeMonth(v ?? "")}>
                <SelectTrigger size="sm" className="h-7 w-full rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">All months</SelectItem>
                  {/* Only months up to the current one — future months in this
                      year have no applied data yet. */}
                  {Array.from({ length: currentMonth + 1 }, (_, i) => (
                    <SelectItem key={i} value={String(i)} className="text-xs">
                      {monthWindowLabel(i, currentYear)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={yearFilter === null ? "" : String(yearFilter)} onValueChange={v => changeYear(v ?? "")}>
                <SelectTrigger size="sm" className="h-7 w-full rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">All years</SelectItem>
                  <SelectItem value={String(currentYear)} className="text-xs">{yearWindowLabel(currentYear)}</SelectItem>
                  <SelectItem value={String(currentYear - 1)} className="text-xs">{yearWindowLabel(currentYear - 1)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Work Type */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Work Type</p>
            <div className="flex flex-col gap-0.5">
              {WORK_TYPES.map(wt => (
                <FilterOption
                  key={wt}
                  active={workTypeFilter === wt}
                  onClick={() => changeWorkType(wt)}
                  dot={wt !== "All Types" ? WORK_TYPE_COLOR[wt] : undefined}
                >
                  {wt === "All Types" ? "All Types" : wt.charAt(0).toUpperCase() + wt.slice(1)}
                </FilterOption>
              ))}
            </div>
          </div>

          {/* Country — searchable dropdown over the ISO country list */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Country</p>
            <CountryCombobox
              value={countryFilter}
              onValueChange={changeCountry}
              placeholder="All Countries"
              clearable
            />
          </div>

          {/* Type — how the job reached us. Manually added/imported jobs
              only; scraped jobs are unclassified and match "Any type". */}
          <EngagementSection value={engagementFilter} onValueChange={changeEngagement} />

          {/* Parser — the scrapers that fetch jobs (from the scrapers table) */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Parser</p>
            <div className="flex flex-col gap-0.5">
              {parsers.map(p => (
                <FilterOption
                  key={p}
                  active={parserFilter === p}
                  onClick={() => changeParser(p)}
                >
                  {p}
                </FilterOption>
              ))}
            </div>
          </div>

          {/* Leads — visibility of jobs already in the pipeline */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Leads</p>
            <div className="flex flex-col gap-0.5">
              {LEAD_FILTERS.map(({ value, label }) => (
                <FilterOption
                  key={value}
                  active={leadFilter === value}
                  onClick={() => changeLeadFilter(value)}
                  dot={value === "in_leads" ? "var(--brand-sky)" : undefined}
                >
                  {label}
                </FilterOption>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Sort</p>
            <div className="flex flex-col gap-0.5">
              {SORT_OPTIONS.map(option => (
                <FilterOption
                  key={option.value}
                  active={sort === option.value}
                  onClick={() => changeSort(option.value)}
                >
                  {option.label}
                </FilterOption>
              ))}
            </div>
          </div>
      </FilterSidebar>

      {/* New Job — manually add a job with a state for a chosen profile. Only
          active profiles are offerable — a job added for an inactive profile
          would be dead weight (nobody can act on it). */}
      <NewJobDialog
        open={newJobOpen}
        onOpenChange={setNewJobOpen}
        onCreated={refreshJobs}
        profiles={profiles.filter(p => p.status === "active").map(p => ({ id: p.id, name: p.name }))}
        pipelineStages={pipelineStages}
      />

      {/* Import — bulk-add jobs from an Excel file: upload, map columns to
          fields (drag-and-drop, live-validated), review and edit the resolved
          rows, then submit. Reuses the same profiles/stages as New Job. */}
      <ImportJobsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshJobs}
        profiles={profiles.filter(p => p.status === "active").map(p => ({ id: p.id, name: p.name, location: p.location }))}
        stages={pipelineStages.map(s => ({ id: s.id, name: s.name }))}
      />

      {/* Job detail drawer */}
      <JobDrawer
        open={selectedJob !== null}
        job={selectedJob}
        profiles={profiles}
        onClose={() => setSelectedJob(null)}
        showActions={false}
        onAddToLead={handleAddToLead}
        addToLeadPending={addToLeadPending}
        onDismiss={handleDismiss}
        dismissOpen={dismissOpen}
        setDismissOpen={setDismissOpen}
        dismissReason={dismissReason}
        setDismissReason={setDismissReason}
        canEditJob={canEditJobs}
        onJobFieldSave={saveJobFields}
      />
    </div>
  )
}
