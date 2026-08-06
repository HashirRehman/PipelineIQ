"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import type { DiscoveryProfile } from "@/app/api/discovery/route";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { StatCard } from "@/components/stat-card";
import { TintedBadge } from "@/components/tinted-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARSER_COLOR, WORK_TYPE_COLOR } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import JobDrawer, { type Job } from "@/components/job-drawer";

const WORK_TYPES = ["All Types", "remote", "onsite"];

interface AppliedJobsResponse {
  jobs: Job[];
  profile: DiscoveryProfile | null;
}

export default function AppliedJobsTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [parserFilter, setParserFilter] = useState("All Sources");
  const [workTypeFilter, setWorkTypeFilter] = useState("All Types");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAppliedJobs() {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          page: "1",
          pageSize: "50",
          status: "applied",
        }).toString();

        const res = await fetch(`/api/discovery?${query}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as AppliedJobsResponse;
          setJobs(json.jobs ?? []);
          setProfile(json.profile ?? null);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to load applied jobs:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchAppliedJobs();
    return () => controller.abort();
  }, []);

  // 100% Dynamic source options derived directly from the real jobs data.
  const dynamicParsers = Array.from(
    new Set(
      jobs
        .map((j) => j.parser)
        .filter((p): p is string => Boolean(p && p.trim().length > 0)),
    ),
  ).sort();
  const availableParsers = ["All Sources", ...dynamicParsers];

  const filteredJobs = jobs.filter((job) => {
    const q = search.toLowerCase().trim();
    const matchQ =
      !q ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q) ||
      (job.parser && job.parser.toLowerCase().includes(q));

    const jobSource = (job.parser || "LinkedIn").toLowerCase().trim();
    const targetSource = parserFilter.toLowerCase().trim();
    const matchParser =
      parserFilter === "All Sources" ||
      jobSource.includes(targetSource) ||
      targetSource.includes(jobSource);

    const matchWorkType =
      workTypeFilter === "All Types" || job.workType === workTypeFilter;

    return matchQ && matchParser && matchWorkType;
  });

  const remoteCount = jobs.filter((j) => j.workType === "remote").length;
  const onsiteCount = jobs.filter((j) => j.workType === "onsite").length;

  return (
    <div className="p-7 px-8 flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        title="Applied Jobs"
        subtitle={
          profile
            ? `Showing applied applications for ${profile.name}`
            : "Showing applied applications"
        }
        className="mb-6"
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Total Applied Jobs"
          value={jobs.length}
          color="var(--primary)"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
        <StatCard
          label="Remote Positions"
          value={remoteCount}
          color="#10b981"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
        <StatCard
          label="Onsite / Hybrid"
          value={onsiteCount}
          color="#6366f1"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2.5 mb-5 items-center">
        <SearchInput
          placeholder="Search applied jobs by title, company, or location..."
          value={search}
          onChange={setSearch}
          className="flex-1"
        />

        <Select value={parserFilter} onValueChange={(v) => setParserFilter(v ?? "All Sources")}>
          <SelectTrigger className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableParsers.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={workTypeFilter} onValueChange={(v) => setWorkTypeFilter(v ?? "All Types")}>
          <SelectTrigger className="min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORK_TYPES.map((w) => (
              <SelectItem key={w} value={w}>
                {w === "All Types" ? "All Types" : w.charAt(0).toUpperCase() + w.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-[var(--muted-fg)]">
          <Loader2 className="w-6 h-6 animate-spin mb-3 text-[var(--primary)]" />
          <span className="text-sm">Loading applied jobs...</span>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center border border-dashed border-[var(--border)] rounded-xl bg-[var(--card)]/40">
          <CheckCircle2 className="w-10 h-10 text-[var(--muted-fg)] mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-[var(--fg)] mb-1">No Applied Jobs Found</h3>
          <p className="text-xs text-[var(--muted-fg)] max-w-sm">
            {search || parserFilter !== "All Sources" || workTypeFilter !== "All Types"
              ? "No jobs match your current search or filter criteria."
              : "Jobs marked as applied in the Discovery feed will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredJobs.map((job) => {
            const matchScore = job.relevanceScore ?? 0;
            return (
              <div
                key={job.id}
                onClick={() => setSelectedJob(job)}
                className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all cursor-pointer shadow-sm flex flex-col gap-3 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-[var(--fg)] group-hover:text-[var(--primary)] transition-colors truncate">
                        {job.title}
                      </h3>
                      <TintedBadge color="#10b981" className="font-mono text-[10px]">
                        APPLIED
                      </TintedBadge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--muted-fg)]">
                      <span className="font-medium text-[var(--fg)]">{job.company}</span>
                      <span>·</span>
                      <span>{job.location}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
                        MATCH
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[var(--border)]/40">
                  <div className="flex gap-1.5 flex-wrap">
                    <TintedBadge color={WORK_TYPE_COLOR[job.workType]}>
                      {job.workType}
                    </TintedBadge>
                    <TintedBadge color={PARSER_COLOR[job.parser] || "#64748b"} className="font-medium">
                      via {job.parser || "Unknown source"}
                    </TintedBadge>
                  </div>
                  <span className="font-mono text-[11px] text-[var(--muted-fg)]">
                    {timeAgo(job.postedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side Drawer for Job Details */}
      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          activeProfile={profile}
          onClose={() => setSelectedJob(null)}
          showActions={false}
        />
      )}
    </div>
  );
}