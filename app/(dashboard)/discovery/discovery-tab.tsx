"use client"
import { useEffect, useState } from "react"
import { Loader2, Briefcase, SlidersHorizontal } from "lucide-react"
import type { DiscoveryProfile } from "@/app/api/discovery/route"
import { PageHeader } from "@/components/page-header"
import { GooeyInput } from "@/components/ui/gooey-input"
import { RunDiscoveryButton } from "@/components/run-discovery-button"
import { FilterOption } from "@/components/jobs/filter-option"
import { JobCard } from "@/components/jobs/job-card"
import { Pagination } from "@/components/jobs/pagination"
import { DateRangeSection, SortSection } from "@/components/jobs/filter-sections"
import { PARSERS, WORK_TYPES, PARSER_COLOR, WORK_TYPE_COLOR, type DateRange, type SortOption } from "@/lib/constants"
import { cn } from "@/lib/utils"
import JobDrawer, { type Job } from "@/components/job-drawer"
import { apiPost, withOrgId } from "@/lib/api/client"

const REGIONS = ["Global", "US Only"]
const PAGE_SIZE = 5

const REGION_TO_PARAM: Record<string, string> = { Global: "", "US Only": "us_only" }

const buildQueryKey = (opts: { page: number; workType: string; parser: string; search: string; region: string; dateRange: DateRange; sort: SortOption }) =>
  new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    workType: opts.workType === "All Types" ? "" : opts.workType,
    parser: opts.parser === "All Sources" ? "" : opts.parser,
    search: opts.search,
    region: REGION_TO_PARAM[opts.region] ?? "",
    dateRange: opts.dateRange,
    sort: opts.sort,
  }).toString()

interface DiscoveryResponse {
  jobs: Job[]
  profile: DiscoveryProfile | null
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export default function DiscoveryTab() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null)
  const [search, setSearch] = useState("")
  const [parserFilter, setParserFilter] = useState("All Sources")
  const [workTypeFilter, setWorkTypeFilter] = useState("All Types")
  const [regionFilter, setRegionFilter] = useState("Global")
  const [dateRange, setDateRange] = useState<DateRange>("all")
  const [sort, setSort] = useState<SortOption>("relevance")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissReason, setDismissReason] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [markAppliedPending, setMarkAppliedPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadingKey = buildQueryKey({ page, workType: workTypeFilter, parser: parserFilter, search, region: regionFilter, dateRange, sort })
  const loading = appliedKey !== loadingKey

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(withOrgId(`/api/discovery?${loadingKey}`), { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error("Failed to load jobs")
        return res.json() as Promise<DiscoveryResponse>
      })
      .then(json => {
        setJobs(json.jobs)
        setProfile(json.profile)
        setTotalCount(json.totalCount)
        setTotalPages(json.totalPages)
        if (page > json.totalPages) setPage(Math.max(1, json.totalPages))
        setAppliedKey(loadingKey)
        setError(null)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Failed to load jobs")
        setAppliedKey(loadingKey)
      })
    return () => ctrl.abort()
  }, [loadingKey, page])

  const changeSearch = (v: string) => { setSearch(v); setPage(1) }
  const changeWorkType = (v: string) => { setWorkTypeFilter(v); setPage(1) }
  const changeParser = (v: string) => { setParserFilter(v); setPage(1) }
  const changeRegion = (v: string) => { setRegionFilter(v); setPage(1) }
  const changeDateRange = (v: DateRange) => { setDateRange(v); setPage(1) }
  const changeSort = (v: SortOption) => { setSort(v); setPage(1) }

  const handleApply = (id: string) => {
    const job = jobs.find(j => j.id === id) ?? selectedJob
    if (job?.applyUrl) window.open(job.applyUrl, "_blank", "noopener,noreferrer")
  }

  const handleMarkApplied = async (id: string) => {
    if (!profile || markAppliedPending) return
    setMarkAppliedPending(true)
    setActionError(null)
    try {
      await apiPost<{ success: boolean }>("/api/discovery/mark-applied", { jobId: id, profileId: profile.id })
    } catch (err) {
      console.error("markApplied failed", err)
      setActionError(err instanceof Error ? err.message : "Failed to mark as applied. Please try again.")
      return
    } finally {
      setMarkAppliedPending(false)
    }
    setJobs(js => js.filter(j => j.id !== id))
    if (selectedJob?.id === id) setSelectedJob(null)
  }

  const handleDismiss = async (id: string, reason: string) => {
    if (!profile) return
    try {
      await apiPost<{ success: boolean }>("/api/discovery/dismiss", { jobId: id, profileId: profile.id, reason })
    } catch (err) {
      console.error("dismissJob failed", err)
      return
    }
    setJobs(js => js.filter(j => j.id !== id))
    if (selectedJob?.id === id) setSelectedJob(null)
    setDismissReason("")
  }

  const isActiveFilter =
    parserFilter !== "All Sources" ||
    workTypeFilter !== "All Types" ||
    regionFilter !== "Global" ||
    dateRange !== "all" ||
    sort !== "relevance"

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <PageHeader
          title="Discovery"
          subtitle={profile ? `Jobs matched for ${profile.name}` : "No active profile — assign one in Profiles to act on jobs"}
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{totalCount} job{totalCount !== 1 ? "s" : ""}</span>
              <RunDiscoveryButton />
            </div>
          }
        />

        {/* Search bar + filters toggle */}
        <div className="flex justify-between items-center gap-2 px-5 py-3 border-b border-border bg-background shrink-0">
          <GooeyInput
            value={search}
            onValueChange={changeSearch}
            placeholder="Search jobs by title, company, or location..."
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
              <span className="text-sm">Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-border">
              <Briefcase className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-semibold text-foreground">No jobs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || isActiveFilter ? "Try adjusting your search or filters." : "Run discovery to find matching jobs."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onClick={() => { setSelectedJob(job); setActionError(null) }}
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
                onClick={() => { setParserFilter("All Sources"); setWorkTypeFilter("All Types"); setRegionFilter("Global"); setDateRange("all"); setSort("relevance"); setPage(1) }}
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

          {/* Source (disabled — not implemented yet) */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Source</p>
            <div className="flex flex-col gap-0.5">
              {PARSERS.map(p => (
                <FilterOption
                  key={p}
                  active={parserFilter === p}
                  onClick={() => changeParser(p)}
                  disabled={p !== "All Sources"}
                  dot={p !== "All Sources" ? PARSER_COLOR[p] : undefined}
                >
                  {p}
                </FilterOption>
              ))}
            </div>
          </div>

          {/* Region */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">Region</p>
            <div className="flex flex-col gap-0.5">
              {REGIONS.map(r => (
                <FilterOption
                  key={r}
                  active={regionFilter === r}
                  onClick={() => changeRegion(r)}
                >
                  {r}
                </FilterOption>
              ))}
            </div>
          </div>

          {/* Time + Sort (shared with Applied Jobs) */}
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
        onApply={handleApply}
        onMarkApplied={handleMarkApplied}
        markAppliedPending={markAppliedPending}
        actionError={actionError}
        onDismiss={handleDismiss}
        showActions={true}
        dismissOpen={dismissOpen}
        setDismissOpen={setDismissOpen}
        dismissReason={dismissReason}
        setDismissReason={setDismissReason}
      />
    </div>
  )
}

