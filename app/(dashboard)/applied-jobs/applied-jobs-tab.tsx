"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, MapPin, Briefcase, ExternalLink } from "lucide-react"

import type { DiscoveryProfile } from "@/app/api/discovery/route"
import { PageHeader } from "@/components/page-header"
import { SearchInput } from "@/components/search-input"
import { StatCard } from "@/components/stat-card"
import { TintedBadge } from "@/components/tinted-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PARSER_COLOR, WORK_TYPE_COLOR } from "@/lib/constants"
import { timeAgo } from "@/lib/format"
import JobDrawer, { type Job } from "@/components/job-drawer"

const WORK_TYPES = ["All Types", "remote", "onsite"]

interface AppliedJobsResponse {
  jobs: Job[]
  profile: DiscoveryProfile | null
}

export default function AppliedJobsTab() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [parserFilter, setParserFilter] = useState("All Sources")
  const [workTypeFilter, setWorkTypeFilter] = useState("All Types")
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchAppliedJobs() {
      setLoading(true)
      try {
        const query = new URLSearchParams({ page: "1", pageSize: "50", status: "applied" }).toString()
        const res = await fetch(`/api/discovery?${query}`, { signal: controller.signal })
        if (res.ok) {
          const json = (await res.json()) as AppliedJobsResponse
          setJobs(json.jobs ?? [])
          setProfile(json.profile ?? null)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error("Failed to load applied jobs:", err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    fetchAppliedJobs()
    return () => controller.abort()
  }, [])

  const dynamicParsers = Array.from(
    new Set(jobs.map((j) => j.parser).filter((p): p is string => Boolean(p?.trim())))
  ).sort()
  const availableParsers = ["All Sources", ...dynamicParsers]

  const filteredJobs = jobs.filter((job) => {
    const q = search.toLowerCase().trim()
    const matchQ =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      (job.parser && job.parser.toLowerCase().includes(q))
    const jobSource = (job.parser || "LinkedIn").toLowerCase().trim()
    const targetSource = parserFilter.toLowerCase().trim()
    const matchParser =
      parserFilter === "All Sources" ||
      jobSource.includes(targetSource) ||
      targetSource.includes(jobSource)
    const matchWorkType = workTypeFilter === "All Types" || job.workType === workTypeFilter
    return matchQ && matchParser && matchWorkType
  })

  const remoteCount = jobs.filter((j) => j.workType === "remote").length
  const onsiteCount = jobs.filter((j) => j.workType === "onsite").length

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <PageHeader
        title="Applied Jobs"
        subtitle={profile ? `Applications for ${profile.name}` : "Your submitted applications"}
        actions={
          <span className="text-xs text-muted-foreground font-medium">{jobs.length} total</span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Stat row */}
        <div className="grid grid-cols-3 gap-4 px-6 py-5 border-b border-border">
          <StatCard label="Total Applied" value={jobs.length} color="var(--primary)" />
          <StatCard label="Remote" value={remoteCount} color="var(--status-emerald)" />
          <StatCard label="Onsite / Hybrid" value={onsiteCount} color="var(--brand-sky)" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background">
          <SearchInput
            placeholder="Search by title, company, location…"
            value={search}
            onChange={setSearch}
            className="flex-1 max-w-sm"
          />
          <Select value={parserFilter} onValueChange={(v) => setParserFilter(v ?? "All Sources")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableParsers.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={workTypeFilter} onValueChange={(v) => setWorkTypeFilter(v ?? "All Types")}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_TYPES.map((w) => (
                <SelectItem key={w} value={w} className="text-xs">
                  {w === "All Types" ? "All Types" : w.charAt(0).toUpperCase() + w.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mb-2 text-primary" />
            <span className="text-sm">Loading applied jobs…</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <CheckCircle2 className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No Applied Jobs Found</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {search || parserFilter !== "All Sources" || workTypeFilter !== "All Types"
                ? "No jobs match your filters."
                : "Jobs marked as applied in Discovery will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
            {filteredJobs.map((job) => {
              const score = job.relevanceScore ?? 0
              const parserColor = PARSER_COLOR[job.parser ?? ""] ?? "var(--brand-blue)"
              const workColor = WORK_TYPE_COLOR[job.workType ?? "remote"] ?? "var(--status-green)"
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="group bg-background px-6 py-4 hover:bg-accent/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {job.title}
                        </span>
                        <TintedBadge color="var(--status-green)" className="text-caption font-mono">APPLIED</TintedBadge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Briefcase className="size-3" />
                          {job.company}
                        </span>
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`font-mono text-item font-bold ${
                          score >= 70 ? "text-status-emerald" : score >= 40 ? "text-status-amber-500" : "text-status-red"
                        }`}
                      >
                        {score}%
                      </span>
                      <TintedBadge color={workColor} className="text-caption">
                        {job.workType ?? "remote"}
                      </TintedBadge>
                      {job.parser && (
                        <TintedBadge color={parserColor} className="text-caption">
                          {job.parser}
                        </TintedBadge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-meta text-muted-foreground">
                      {job.postedAt ? timeAgo(job.postedAt) : ""}
                    </span>
                    {job.applyUrl && (
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-meta text-primary hover:underline"
                      >
                        View posting <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <JobDrawer
        open={selectedJob !== null}
        job={selectedJob}
        activeProfile={profile}
        onClose={() => setSelectedJob(null)}
        showActions={false}
      />
    </div>
  )
}
