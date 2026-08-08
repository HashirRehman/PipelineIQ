"use client"
import { useEffect, useState } from "react"
import { Loader2, Briefcase, MapPin, Clock, ChevronLeft, ChevronRight, SlidersHorizontal, Bookmark } from "lucide-react"
import type { DiscoveryProfile } from "@/app/api/discovery/route"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { RunDiscoveryButton } from "@/components/run-discovery-button"
import { TintedBadge } from "@/components/tinted-badge"
import { JOB_STATUS_BG, JOB_STATUS_BORDER, PARSER_COLOR, WORK_TYPE_COLOR, scoreColor } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import JobDrawer, { type Job } from "@/components/job-drawer"
import { apiPost } from "@/lib/api/client"

const PARSERS = ["All Sources", "LinkedIn", "Indeed", "Greenhouse", "Lever", "Workday"]
const WORK_TYPES = ["All Types", "remote", "onsite"]
const REGIONS = ["Global", "US Only"]
const PAGE_SIZE = 5

const REGION_TO_PARAM: Record<string, string> = { Global: "", "US Only": "us_only" }

const buildQueryKey = (opts: { page: number; workType: string; parser: string; search: string; region: string }) =>
  new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    workType: opts.workType === "All Types" ? "" : opts.workType,
    parser: opts.parser === "All Sources" ? "" : opts.parser,
    search: opts.search,
    region: REGION_TO_PARAM[opts.region] ?? "",
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
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissReason, setDismissReason] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)

  const loadingKey = buildQueryKey({ page, workType: workTypeFilter, parser: parserFilter, search, region: regionFilter })
  const loading = appliedKey !== loadingKey

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/discovery?${loadingKey}`, { signal: ctrl.signal })
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

  const handleApply = (id: string) => {
    const job = jobs.find(j => j.id === id) ?? selectedJob
    if (job?.applyUrl) window.open(job.applyUrl, "_blank", "noopener,noreferrer")
  }

  const handleMarkApplied = async (id: string) => {
    if (!profile) return
    try {
      await apiPost<{ success: boolean }>("/api/discovery/mark-applied", { jobId: id, profileId: profile.id })
    } catch (err) {
      console.error("markApplied failed", err)
      return
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

  const isActiveFilter = parserFilter !== "All Sources" || workTypeFilter !== "All Types" || regionFilter !== "Global"

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <PageHeader
          title="Discovery"
          subtitle={profile ? `Jobs matched for ${profile.name}` : "Job matches for your active profile"}
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{totalCount} job{totalCount !== 1 ? "s" : ""}</span>
              <RunDiscoveryButton />
            </div>
          }
        />

        {/* Search bar + filters toggle */}
        <div className="flex justify-between items-center gap-2 px-5 py-3 border-b border-border bg-background shrink-0">
          <SearchInput
            value={search}
            onChange={changeSearch}
            placeholder="Search jobs by title, company, or location..."
            className="flex-1 max-w-xl"
            inputClassName="rounded-[7px]"
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
                onClick={() => { setParserFilter("All Sources"); setWorkTypeFilter("All Types"); setRegionFilter("Global"); setPage(1) }}
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

/* ─── Sub-components ─── */

function FilterOption({
  active,
  onClick,
  children,
  dot,
  disabled = false,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  dot?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 w-full rounded px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer",
        disabled && "opacity-40 cursor-not-allowed",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-foreground",
        !disabled && !active && "hover:bg-accent",
      )}
    >
      {dot && <span className="size-1.5 rounded-full shrink-0" style={{ background: dot }} />}
      {children}
    </button>
  )
}

function JobCard({
  job,
  onClick,
}: {
  job: Job
  onClick: () => void
}) {
  const score = job.relevanceScore ?? 0
  const scoreRingColor = scoreColor(score)
  const parserColor = PARSER_COLOR[job.parser] ?? "var(--status-slate)"
  const workColor = WORK_TYPE_COLOR[job.workType] ?? "var(--status-slate)"

  return (
    <div
      onClick={onClick}
      className="group flex flex-col rounded-lg border bg-card p-4 cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm"
      style={{
        borderColor: JOB_STATUS_BORDER[job.status] ?? "var(--border)",
        background: JOB_STATUS_BG[job.status] === "transparent" ? "var(--card)" : JOB_STATUS_BG[job.status],
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {job.title}
            </h3>
            {job.status === "applied" && <TintedBadge color="var(--status-green)">Applied</TintedBadge>}
            {job.status === "dismissed" && <TintedBadge color="var(--status-red)">Dismissed</TintedBadge>}
            {job.possiblyClosed && <TintedBadge color="var(--status-amber)">Possibly Closed</TintedBadge>}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{job.company}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />{job.location}
            </span>
            <TintedBadge color={workColor}>{job.workType}</TintedBadge>
            <TintedBadge color={parserColor}>{job.parser}</TintedBadge>
          </div>
        </div>

        {/* Score ring */}
        {score > 0 && (
          <div className="shrink-0 text-center">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none" stroke={scoreRingColor} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - score / 100)}
                transform="rotate(-90 20 20)"
              />
              <text x="20" y="24" textAnchor="middle" fill="currentColor" style={{ fontSize: "var(--text-micro)", fontWeight: 700 }}>{score}</text>
            </svg>
          </div>
        )}
      </div>

      {/* Footer: save (disabled) + time */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
        <button
          type="button"
          disabled
          title="Save (coming soon)"
          aria-label="Save job (coming soon)"
          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed"
        >
          <Bookmark className="size-3.5" />
        </button>
        <span className="flex items-center gap-1 text-meta text-muted-foreground">
          <Clock className="size-3" />{timeAgo(job.postedAt)}
        </span>
      </div>
    </div>
  )
}

function getPageItems(current: number, total: number): (number | "…")[] {
  const items: (number | "…")[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      items.push(i)
    } else if (items[items.length - 1] !== "…") {
      items.push("…")
    }
  }
  return items
}

function Pagination({
  page,
  totalPages,
  onChange,
  className,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
  className?: string
}) {
  const items = getPageItems(page, totalPages)

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="flex size-8 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors cursor-pointer"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>

      {items.map((item, i) =>
        item === "…" ? (
          <span key={`ellipsis-${i}`} className="flex size-8 items-center justify-center text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "flex size-8 items-center justify-center rounded border text-xs font-medium transition-colors cursor-pointer",
              item === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="flex size-8 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors cursor-pointer"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
