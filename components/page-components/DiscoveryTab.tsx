import { useEffect, useState } from "react"
import { Search } from "lucide-react"

import type { DiscoveryProfile } from "@/app/api/discovery/route"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { RunDiscoveryButton } from "@/components/run-discovery-button"
import { TintedBadge } from "@/components/tinted-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  JOB_STATUS_BG,
  JOB_STATUS_BORDER,
  PARSER_COLOR,
  WORK_TYPE_COLOR,
} from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import JobDrawer, { type Job } from "./JobDrawer"
import { apiPost } from "@/lib/api/client"

const PARSERS = ["All Sources", "LinkedIn", "Indeed", "Greenhouse", "Lever", "Workday"]
const WORK_TYPES = ["All Types", "remote", "onsite"]
const REGIONS = ["Global", "US Only"]

const PAGE_SIZE = 5

const REGION_TO_PARAM: Record<string, string> = {
  Global: "",
  "US Only": "us_only",
}

const regionToParam = (region: string) => REGION_TO_PARAM[region] ?? ""

const buildQueryKey = (opts: {
  page: number
  workType: string
  parser: string
  search: string
  region: string
}) =>
  new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    workType: opts.workType === "All Types" ? "" : opts.workType,
    parser: opts.parser === "All Sources" ? "" : opts.parser,
    search: opts.search,
    region: regionToParam(opts.region),
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
  const [pendingDismissId, setPendingDismissId] = useState<string | null>(null)

  const loadingKey = buildQueryKey({
    page,
    workType: workTypeFilter,
    parser: parserFilter,
    search,
    region: regionFilter,
  })
  const loading = appliedKey !== loadingKey

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/discovery?${buildQueryKey({ page, workType: workTypeFilter, parser: parserFilter, search, region: regionFilter })}`, { signal: controller.signal })
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

    return () => controller.abort()
  }, [page, workTypeFilter, parserFilter, search, regionFilter, loadingKey])

  const changeSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const changeWorkType = (value: string) => {
    setWorkTypeFilter(value)
    setPage(1)
  }

  const changeParser = (value: string) => {
    setParserFilter(value)
    setPage(1)
  }

  const changeRegion = (value: string) => {
    setRegionFilter(value)
    setPage(1)
  }

  const handleApply = (id: string) => {
    const job = jobs.find(j => j.id === id) ?? selectedJob
    if (job?.applyUrl) {
      window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleMarkApplied = async (id: string) => {
    if (!profile) return
    try {
      await apiPost<{ success: boolean }>("/api/discovery/mark-applied", {
        jobId: id,
        profileId: profile.id,
      })
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
      await apiPost<{ success: boolean }>("/api/discovery/dismiss", {
        jobId: id,
        profileId: profile.id,
        reason,
      })
    } catch (err) {
      console.error("dismissJob failed", err)
      return
    }
    setJobs(js => js.filter(j => j.id !== id))
    if (selectedJob?.id === id) setSelectedJob(null)
    setPendingDismissId(null)
    setDismissReason("")
  }

  const startDismiss = (id: string) => {
    setPendingDismissId(id)
    setDismissOpen(true)
    setDismissReason("")
  }

  const confirmDismiss = () => {
    if (pendingDismissId && dismissReason.trim()) {
      handleDismiss(pendingDismissId, dismissReason)
      setDismissOpen(false)
      setPendingDismissId(null)
    }
  }

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`px-3 h-auto py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shadow-none ${
        active
          ? "bg-cyan-500/10 border border-cyan-500/30 font-semibold text-[var(--primary)]"
          : "bg-transparent border border-[var(--border-strong)] font-normal text-[var(--fg)] hover:border-gray-500"
      }`}
    >
      {label}
    </Button>
  )

  const filterOption = (active: boolean, onClick: () => void, children: React.ReactNode, withDot?: string) => (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "w-full h-auto justify-start px-2.5 py-1.5 rounded text-xs text-left shadow-none",
        active
          ? "bg-cyan-500/10 font-semibold text-[var(--primary)] hover:bg-cyan-500/10"
          : "bg-transparent font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5"
      )}
    >
      {withDot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: withDot }} />}
      {children}
    </Button>
  )

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Filters Panel */}
      <div className="w-[230px] border-r border-[var(--border)] p-6 overflow-y-auto shrink-0 bg-[var(--muted)]">
        <div className="text-xs font-bold text-[var(--fg)] mb-4 flex items-center justify-between">
          Filters
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("")
              setParserFilter("All Sources")
              setWorkTypeFilter("All Types")
              setRegionFilter("Global")
              setPage(1)
            }}
            className="h-auto p-0 bg-transparent text-[11px] text-[var(--primary)] hover:underline shadow-none"
          >
            Clear all
          </Button>
        </div>

        <div className="mb-5">
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Work Type
          </div>
          <div className="flex flex-col gap-1">
            {WORK_TYPES.map(t => (
              <div key={t}>
                {filterOption(
                  workTypeFilter === t,
                  () => changeWorkType(t),
                  t.charAt(0).toUpperCase() + t.slice(1),
                  t !== "All Types" ? WORK_TYPE_COLOR[t] : undefined
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Region
          </div>
          <div className="flex flex-col gap-1">
            {REGIONS.map(r => (
              <div key={r}>
                {filterOption(regionFilter === r, () => changeRegion(r), r)}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Platforms
          </div>
          <div className="flex flex-col gap-1">
            {PARSERS.map(p => (
              <div key={p}>
                {filterOption(parserFilter === p, () => changeParser(p), p)}
              </div>
            ))}
          </div>
         </div>
       </div>

      {/* Job List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-7 pt-6 pb-0 shrink-0">
          <PageHeader
            title="Discovery"
            subtitle={`${totalCount} jobs found`}
            className="mb-4"
            actions={
              <div className="flex items-center gap-2">
                <RunDiscoveryButton />
                <SearchInput
                  placeholder="Search jobs…"
                  value={search}
                  onChange={changeSearch}
                  className="w-[220px]"
                  inputClassName="rounded-[7px]"
                />
              </div>
            }
          />

          <div className="flex gap-1.5 overflow-x-auto pb-3.5">
            {filterBtn("All", workTypeFilter === "All Types", () => {
              changeWorkType("All Types")
            })}
             {filterBtn("Remote", workTypeFilter === "remote", () =>
               changeWorkType(workTypeFilter === "remote" ? "All Types" : "remote")
             )}             {filterBtn("Onsite", workTypeFilter === "onsite", () =>
               changeWorkType(workTypeFilter === "onsite" ? "All Types" : "onsite")
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-7 pb-6">
          <div className={cn("flex flex-col gap-2.5 transition-opacity duration-150", loading && "opacity-50")}>
            {jobs.map(job => {
              const matchScore = job.relevanceScore ?? 0

              return (
                <div
                  key={job.id}
                  className="job-card rounded-[10px] px-4.5 py-4 cursor-pointer transition-all duration-150 ease-in-out"
                  style={{
                    background: JOB_STATUS_BG[job.status] || "var(--card)",
                    border: `1px solid ${JOB_STATUS_BORDER[job.status] || "var(--border)"}`,
                  }}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[15px] font-semibold text-[var(--fg)]">{job.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-fg)]">
                        <span className="font-medium text-[var(--fg)]">{job.company}</span>
                        <span>·</span>
                        <span>{job.location}</span>
                        {job.workType === "remote" && job.remoteRegion && (
                          <>
                            <span>·</span>
                            <span>{job.remoteRegion}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {job.cvMatches && job.cvMatches.length > 0 ? (
                        <div className="text-center">
                          <div
                            className={`font-mono text-[15px] font-bold ${
                              matchScore >= 70
                                ? "text-emerald-500"
                                : matchScore >= 40
                                ? "text-amber-500"
                                : "text-red-500"
                            }`}
                          >
                            {matchScore}%
                          </div>
                          <div className="text-[9px] text-[var(--muted-fg)] uppercase tracking-[0.4px] font-mono">
                            match
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="font-mono text-[15px] font-bold text-[var(--muted-fg)]">—</div>
                          <div className="text-[9px] text-[var(--muted-fg)] uppercase tracking-[0.4px] font-mono">
                            no match
                          </div>
                        </div>
                      )}
                      {job.possiblyClosed && (
                        <Badge variant="secondary" className="px-1.75 py-0.5 rounded text-[10px] text-amber-600 font-mono font-normal">
                          Possibly Closed
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <TintedBadge color={WORK_TYPE_COLOR[job.workType]}>
                        {job.workType}
                      </TintedBadge>
                      <TintedBadge color={PARSER_COLOR[job.parser] || "#64748b"} className="font-medium">
                        via {job.parser || "Unknown source"}
                       </TintedBadge>
                     </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-[var(--muted-fg)]">
                        {timeAgo(job.postedAt)}
                      </span>
                      {job.status === "new" && (
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <Button onClick={() => handleApply(job.id)}
                            className="px-3 h-auto py-1.25 bg-[var(--primary)] rounded-md text-xs font-semibold text-white hover:opacity-90 shadow-none">
                            Apply
                          </Button>
                          <Button variant="outline" onClick={() => handleMarkApplied(job.id)}
                            className="px-2.5 h-auto py-1.25 border-[var(--border-strong)] rounded-md text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 shadow-none">
                            Mark Applied
                          </Button>
                          <Button variant="outline" onClick={() => startDismiss(job.id)}
                            className="px-2.5 h-auto py-1.25 border-red-500/30 rounded-md text-xs text-red-500 hover:bg-red-500/10 shadow-none">
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {loading && (
            <div className="flex flex-col items-center gap-3 py-15 text-[var(--muted-fg)]">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <div className="text-sm">Loading jobs…</div>
            </div>
          )}

          {error && (
            <div className="text-center py-15 text-red-500">
              <div className="text-sm">{error}</div>
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="text-center py-15 text-[var(--muted-fg)]">
              <Search className="mx-auto mb-3 block text-[var(--muted-fg)]" size={40} strokeWidth={1} />
              <div className="text-sm">No jobs match your filters</div>
            </div>
          )}

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 h-auto bg-[var(--card)] border-[var(--border-strong)] rounded-md text-xs shadow-none"
              >
                ← Prev
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <Button
                  key={p}
                  variant="ghost"
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 border border-[var(--border-strong)] rounded-md cursor-pointer text-xs transition-colors shadow-none ${
                    p === page
                      ? "bg-[var(--primary)] font-bold text-white border-[var(--primary)] hover:bg-[var(--primary)]"
                      : "bg-[var(--card)] font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 h-auto bg-[var(--card)] border-[var(--border-strong)] rounded-md text-xs shadow-none"
              >
                Next →
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Inline dismiss modal */}
      <Dialog open={dismissOpen && !selectedJob} onOpenChange={setDismissOpen}>
        <DialogContent
          overlayClassName="bg-black/50"
          showCloseButton={false}
          className="w-[380px] max-w-[380px] sm:max-w-[380px] bg-[var(--card)] text-[var(--fg)] border border-[var(--border-strong)] rounded-lg p-5 shadow-2xl gap-0 ring-0"
        >
          <DialogHeader className="p-0 mb-3">
            <DialogTitle className="text-[15px] font-semibold text-[var(--fg)]">Dismiss Job</DialogTitle>
          </DialogHeader>
          <DialogDescription className="hidden" />
          <Textarea
            rows={3}
            placeholder="Reason for dismissal (required)…"
            value={dismissReason}
            onChange={e => setDismissReason(e.target.value)}
            className="w-full p-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-none mb-3 focus:border-[var(--primary)]"
          />
          <div className="flex gap-2.5">
            <Button
              onClick={confirmDismiss}
              disabled={!dismissReason.trim()}
              className={`flex-1 h-auto py-2.25 rounded-md text-xs font-semibold transition-colors shadow-none ${
                dismissReason.trim()
                  ? "bg-red-500 text-white cursor-pointer hover:bg-red-600"
                  : "bg-[var(--secondary)] text-[var(--muted-fg)] cursor-default"
              }`}
            >
              Confirm Dismiss
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDismissOpen(false)
                setPendingDismissId(null)
              }}
              className="flex-1 h-auto py-2.25 border-[var(--border-strong)] rounded-md text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 shadow-none"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          activeProfile={profile}
          onApply={handleApply}
          onMarkApplied={handleMarkApplied}
          onDismiss={handleDismiss}
          showActions={true}
          dismissOpen={dismissOpen}
          setDismissOpen={setDismissOpen}
          dismissReason={dismissReason}
          setDismissReason={setDismissReason}
        />
      )}
    </div>
  )
}
