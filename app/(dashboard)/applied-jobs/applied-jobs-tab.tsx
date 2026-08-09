"use client"
import { useEffect, useState } from "react"
import { Loader2, Briefcase, SlidersHorizontal } from "lucide-react"
import type { DiscoveryProfile } from "@/app/api/discovery/route"
import { PageHeader } from "@/components/page-header"
import { GooeyInput } from "@/components/ui/gooey-input"
import { FilterOption } from "@/components/jobs/filter-option"
import { JobCard } from "@/components/jobs/job-card"
import { Pagination } from "@/components/jobs/pagination"
import { DateRangeSection, SortSection } from "@/components/jobs/filter-sections"
import JobDrawer, { type Job } from "@/components/job-drawer"
import { WORK_TYPES, PARSER_COLOR, WORK_TYPE_COLOR, type DateRange, type SortOption } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { apiPost, withOrgId } from "@/lib/api/client"

const PAGE_SIZE = 5

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
  profile: DiscoveryProfile | null
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  parsers?: string[]
}

const buildQueryKey = (opts: { page: number; workType: string; parser: string; search: string; dateRange: DateRange; sort: SortOption; leadFilter: LeadFilter }) =>
  new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    status: "applied",
    workType: opts.workType === "All Types" ? "" : opts.workType,
    parser: opts.parser === "All Sources" ? "" : opts.parser,
    search: opts.search,
    dateRange: opts.dateRange,
    sort: opts.sort,
    leadFilter: opts.leadFilter === "exclude" ? "" : opts.leadFilter,
  }).toString()

export default function AppliedJobsTab() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null)
  const [parsers, setParsers] = useState<string[]>(["All Sources"])
  const [search, setSearch] = useState("")
  const [parserFilter, setParserFilter] = useState("All Sources")
  const [workTypeFilter, setWorkTypeFilter] = useState("All Types")
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [sort, setSort] = useState<SortOption>("relevance")
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("exclude")
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [addToLeadPending, setAddToLeadPending] = useState(false)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissReason, setDismissReason] = useState("")

  const loadingKey = buildQueryKey({ page, workType: workTypeFilter, parser: parserFilter, search, dateRange, sort, leadFilter })
  const loading = appliedKey !== loadingKey

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(withOrgId(`/api/discovery?${loadingKey}`), { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error("Failed to load applied jobs")
        return res.json() as Promise<AppliedJobsResponse>
      })
      .then(json => {
        setJobs(json.jobs)
        setProfile(json.profile)
        setTotalCount(json.totalCount)
        setTotalPages(json.totalPages)
        if (json.parsers?.length) setParsers(json.parsers)
        if (page > json.totalPages) setPage(Math.max(1, json.totalPages))
        setAppliedKey(loadingKey)
        setError(null)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Failed to load applied jobs")
        setAppliedKey(loadingKey)
      })
    return () => ctrl.abort()
  }, [loadingKey, page])

  const changeSearch = (v: string) => { setSearch(v); setPage(1) }
  const changeWorkType = (v: string) => { setWorkTypeFilter(v); setPage(1) }
  const changeParser = (v: string) => { setParserFilter(v); setPage(1) }
  const changeDateRange = (v: DateRange) => { setDateRange(v); setPage(1) }
  const changeSort = (v: SortOption) => { setSort(v); setPage(1) }
  const changeLeadFilter = (v: LeadFilter) => { setLeadFilter(v); setPage(1) }

  const isActiveFilter =
    parserFilter !== "All Sources" ||
    workTypeFilter !== "All Types" ||
    dateRange !== "all" ||
    sort !== "relevance"

  const handleAddToLead = async () => {
    if (!selectedJob || !profile || addToLeadPending) return
    setAddToLeadPending(true)
    try {
      await apiPost<{ success: boolean }>("/api/leads", { jobId: selectedJob.id, profileId: profile.id })
      // The job is now in leads: the default "Not in Leads" filter hides it
      // from the feed (it lives on in Leads), while the "In Leads"/"All"
      // views keep it visible with the badge.
      if (leadFilter === "exclude") {
        setJobs(js => js.filter(j => j.id !== selectedJob.id))
        setTotalCount(c => Math.max(0, c - 1))
        setSelectedJob(null)
      } else {
        setJobs(js => js.map(j => (j.id === selectedJob.id ? { ...j, isLead: true } : j)))
        setSelectedJob(current => (current?.id === selectedJob.id ? { ...current, isLead: true } : current))
      }
    } catch (err) {
      console.error("addToLead failed", err)
    } finally {
      setAddToLeadPending(false)
    }
  }

  const handleDismiss = async (id: string, reason: string) => {
    if (!profile) return
    // Jobs already in leads can't be dismissed (the UI hides the action; this
    // is belt-and-braces — the API rejects it too).
    const target = jobs.find(j => j.id === id)
    if (target?.isLead) return
    try {
      await apiPost<{ success: boolean }>("/api/discovery/dismiss", { jobId: id, profileId: profile.id, reason })
    } catch (err) {
      console.error("dismissJob failed", err)
      return
    }
    setJobs(js => js.filter(j => j.id !== id))
    setTotalCount(c => Math.max(0, c - 1))
    if (selectedJob?.id === id) setSelectedJob(null)
    setDismissReason("")
    setDismissOpen(false)
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <PageHeader
          title="Applied Jobs"
          subtitle={profile ? `Applications for ${profile.name}` : "Your submitted applications"}
          actions={
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalCount} applied
            </span>
          }
        />

        {/* Search bar + filters toggle */}
        <div className="flex justify-between items-center gap-2 px-5 py-3 border-b border-border bg-background shrink-0">
          <GooeyInput
            value={search}
            onValueChange={changeSearch}
            placeholder="Search applied jobs by title, company, or location..."
            expandedWidth={576}
          />
          <button
            type="button"
            onClick={() => setFiltersOpen(open => !open)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors cursor-pointer",
              filtersOpen
                ? "border-border bg-accent text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
          </button>
        </div>

        {/* Jobs grid + pagination */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary mb-3" />
              <span className="text-sm">Loading applied jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border">
              <Briefcase className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">No applied jobs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || isActiveFilter
                  ? "Try adjusting your search or filters."
                  : "Jobs marked as applied in Discovery will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => setSelectedJob(job)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onChange={setPage} className="mt-6" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Right filter sidebar */}
      <aside
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
          filtersOpen ? "w-[240px]" : "w-0",
        )}
      >
        <div
          className={cn(
            "flex h-full w-[240px] flex-col overflow-y-auto border-l border-border bg-card transition-opacity duration-200",
            filtersOpen ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <SlidersHorizontal className="size-3.5" /> Filters
            </span>
            {isActiveFilter && (
              <button
                type="button"
                onClick={() => { setParserFilter("All Sources"); setWorkTypeFilter("All Types"); setDateRange("all"); setSort("relevance"); setPage(1) }}
                className="text-meta text-primary hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
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

          {/* Source (from the configured scrapers) */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Source</p>
            <div className="flex flex-col gap-0.5">
              {parsers.map(p => (
                <FilterOption
                  key={p}
                  active={parserFilter === p}
                  onClick={() => changeParser(p)}
                  dot={p !== "All Sources" ? PARSER_COLOR[p] : undefined}
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

          {/* Time + Sort (shared with Discovery) */}
          <DateRangeSection value={dateRange} onValueChange={changeDateRange} />
          <SortSection value={sort} onValueChange={changeSort} />
        </div>
      </aside>

      {/* Job detail drawer */}
      <JobDrawer
        open={selectedJob !== null}
        job={selectedJob}
        activeProfile={profile}
        onClose={() => setSelectedJob(null)}
        showActions={false}
        onAddToLead={handleAddToLead}
        addToLeadPending={addToLeadPending}
        onDismiss={handleDismiss}
        dismissOpen={dismissOpen}
        setDismissOpen={setDismissOpen}
        dismissReason={dismissReason}
        setDismissReason={setDismissReason}
      />
    </div>
  )
}
