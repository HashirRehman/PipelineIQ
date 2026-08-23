"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, SlidersHorizontal } from "lucide-react";
import type { DiscoveryProfile } from "@/app/api/discovery/route";
import { Button } from "@/components/ui/button";
import { GooeyInput } from "@/components/ui/gooey-input";
import { Skeleton } from "@/components/ui/skeleton";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { RunDiscoveryButton } from "@/components/run-discovery-button";
import { ResultsCount } from "@/components/results-count";
import { FilterOption } from "@/components/jobs/filter-option";
import { FilterSidebar } from "@/components/jobs/filter-sidebar";
import { JobCard } from "@/components/jobs/job-card";
import { JobListView } from "@/components/jobs/job-list-view";
import { Pagination } from "@/components/jobs/pagination";
import { ViewToggle } from "@/components/jobs/view-toggle";
import { useJobView } from "@/hooks/use-job-view";
import {
  DateRangeSection,
  SortSection,
} from "@/components/jobs/filter-sections";
import {
  WORK_TYPES,
  WORK_TYPE_COLOR,
  type DateRange,
  type SortOption,
} from "@/lib/constants";
import { getDateWindow } from "@/lib/date-window";
import { cn } from "@/lib/utils";
import JobDrawer, { type Job, type JobFieldPatch } from "@/components/job-drawer";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

const REGIONS = ["Global", "US Only"];
const PAGE_SIZE = 20;

const REGION_TO_PARAM: Record<string, string> = {
  Global: "",
  "US Only": "us_only",
};

const buildQueryKey = (opts: {
  page: number;
  workType: string;
  parser: string;
  search: string;
  region: string;
  country: string;
  dateRange: DateRange;
  sort: SortOption;
}) => {
  const params = new URLSearchParams({
    page: String(opts.page),
    pageSize: String(PAGE_SIZE),
    workType: opts.workType === "All Types" ? "" : opts.workType,
    parser: opts.parser === "All Sources" ? "" : opts.parser,
    search: opts.search,
    region: REGION_TO_PARAM[opts.region] ?? "",
    country: opts.country,
    dateRange: opts.dateRange,
    sort: opts.sort,
  });
  // Exact week/month/year window, computed client-side in local time.
  const window = getDateWindow(opts.dateRange);
  if (window) {
    params.set("from", window.from);
    params.set("to", window.to);
  }
  return params.toString();
};

interface DiscoveryResponse {
  jobs: Job[];
  profiles: DiscoveryProfile[];
  /** Admin / BD Manager may edit job fields (the jobs_update RLS policy). */
  canEditJobs: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Actual parsers/scrapers from the database (e.g. Jsearch). */
  parsers?: string[];
}

export default function DiscoveryTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [parserFilter, setParserFilter] = useState("All Sources");
  const [workTypeFilter, setWorkTypeFilter] = useState("All Types");
  const [regionFilter, setRegionFilter] = useState("Global");
  const [countryFilter, setCountryFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortOption>("relevance");
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [markAppliedPending, setMarkAppliedPending] = useState(false);
  const [view, setView] = useJobView();

  const loadingKey = buildQueryKey({
    page,
    workType: workTypeFilter,
    parser: parserFilter,
    search,
    region: regionFilter,
    country: countryFilter,
    dateRange,
    sort,
  });
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.jobs.discovery(loadingKey),
    queryFn: ({ signal }) => apiGet<DiscoveryResponse>(`/api/discovery?${loadingKey}`, signal),
  });

  const jobs = data?.jobs ?? [];
  const profiles = data?.profiles ?? [];
  const canEditJobs = data?.canEditJobs ?? false;
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;
  // Real parser/scraper list from the API (the scrapers table) — NOT a
  // hardcoded list of platforms.
  const parsers = data?.parsers?.length ? data.parsers : ["All Sources"];

  // Applying to or dismissing a job changes what Applied Jobs shows too, and
  // both read /api/discovery — so the whole "jobs" area is invalidated.
  const refreshJobs = () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all() });

  // Dismissing the last page's jobs can leave `page` past the end.
  if (data && page > data.totalPages) {
    setPage(Math.max(1, data.totalPages));
  }

  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const changeWorkType = (v: string) => {
    setWorkTypeFilter(v);
    setPage(1);
  };
  const changeParser = (v: string) => {
    setParserFilter(v);
    setPage(1);
  };
  const changeRegion = (v: string) => {
    setRegionFilter(v);
    setPage(1);
  };
  const changeCountry = (v: string) => {
    setCountryFilter(v);
    setPage(1);
  };
  const changeDateRange = (v: DateRange) => {
    setDateRange(v);
    setPage(1);
  };
  const changeSort = (v: SortOption) => {
    setSort(v);
    setPage(1);
  };

  const handleApply = (id: string) => {
    const job = jobs.find((j) => j.id === id) ?? selectedJob;
    if (job?.applyUrl)
      window.open(job.applyUrl, "_blank", "noopener,noreferrer");
  };

  const handleMarkApplied = async (id: string, profileIds: string[]) => {
    if (!profiles.length || markAppliedPending) return;
    setMarkAppliedPending(true);
    try {
      await apiPost<{ success: boolean }>("/api/discovery/mark-applied", {
        jobId: id,
        profileIds,
      });
    } catch (err) {
      console.error("markApplied failed", err);
      return;
    } finally {
      setMarkAppliedPending(false);
    }
    setSelectedJob(null);
    await refreshJobs();
  };

  const handleDismiss = async (
    id: string,
    reason: string,
    profileIds: string[],
  ) => {
    if (!profiles.length) return;
    try {
      await apiPost<{ success: boolean }>("/api/discovery/dismiss", {
        jobId: id,
        profileIds,
        reason,
      });
    } catch (err) {
      console.error("dismissJob failed", err);
      return;
    }
    setSelectedJob(null);
    setDismissReason("");
    await refreshJobs();
  };

  // Job field editing (title, location, summary, skills, source…) — Admin
  // and BD Managers only, gated by canEditJobs from the API and the PATCH
  // route. The edited job is refetched so the new values come back from the
  // server rather than being guessed here.
  const saveJobFields = async (patch: JobFieldPatch) => {
    if (!selectedJob) return "No job selected.";
    try {
      await apiPatch<{ success: boolean }>(`/api/jobs/${selectedJob.id}`, patch);
      await refreshJobs();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Something went wrong. Please try again.";
    }
  };

  const isActiveFilter =
    parserFilter !== "All Sources" ||
    workTypeFilter !== "All Types" ||
    regionFilter !== "Global" ||
    countryFilter !== "" ||
    dateRange !== "all" ||
    sort !== "relevance";

  const clearFilters = () => {
    setParserFilter("All Sources");
    setWorkTypeFilter("All Types");
    setRegionFilter("Global");
    setCountryFilter("");
    setDateRange("all");
    setSort("relevance");
    setPage(1);
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Search bar + filters toggle */}
        <div className="flex justify-between items-center gap-2 px-5 py-3 border-b border-border bg-background shrink-0">
          <GooeyInput
            value={search}
            onValueChange={changeSearch}
            placeholder="Search jobs by title, company, or location…"
            expandedWidth={300}
          />
          <div className="flex items-center gap-2">
            <RunDiscoveryButton />
            <ViewToggle view={view} onChange={setView} />
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen((open) => !open)}
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
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              Failed to load jobs
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
              <p className="text-sm font-semibold text-foreground">
                No jobs found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || isActiveFilter
                  ? "Try adjusting your search or filters."
                  : "Run discovery to find matching jobs."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center pb-3">
                <ResultsCount
                  count={totalCount}
                  label={totalCount === 1 ? "job" : "jobs"}
                />
              </div>
              {view === "list" ? (
                <JobListView jobs={jobs} onClick={setSelectedJob} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {jobs.map((job, i) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => setSelectedJob(job)}
                      delay={Math.min(i, 12) * 25}
                    />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onChange={setPage}
                  className="mt-6"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Right filter sidebar */}
      <FilterSidebar
        open={filtersOpen}
        clearable={isActiveFilter}
        onClear={clearFilters}
        widthClass="w-[240px]"
      >
          {/* Work Type */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Work Type
            </p>
            <div className="flex flex-col gap-0.5">
              {WORK_TYPES.map((wt) => (
                <FilterOption
                  key={wt}
                  active={workTypeFilter === wt}
                  onClick={() => changeWorkType(wt)}
                  dot={wt !== "All Types" ? WORK_TYPE_COLOR[wt] : undefined}
                >
                  {wt === "All Types"
                    ? "All Types"
                    : wt.charAt(0).toUpperCase() + wt.slice(1)}
                </FilterOption>
              ))}
            </div>
          </div>

          {/* Parser — the scrapers that fetch jobs (e.g. Jsearch), from the
              database's scrapers table. Job platforms like LinkedIn are
              sources, not parsers. */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Parser
            </p>
            <div className="flex flex-col gap-0.5">
              {parsers.map((p) => (
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

          {/* Region */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Region
            </p>
            <div className="flex flex-col gap-0.5">
              {REGIONS.map((r) => (
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

          {/* Country — searchable dropdown over the ISO country list */}
          <div className="px-4 pb-4">
            <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Country
            </p>
            <CountryCombobox
              value={countryFilter}
              onValueChange={changeCountry}
              placeholder="All Countries"
              clearable
            />
          </div>

          {/* Time + Sort (shared with Pipeline) */}
          <DateRangeSection value={dateRange} onValueChange={changeDateRange} />
          <SortSection value={sort} onValueChange={changeSort} />
      </FilterSidebar>

      {/* Job detail drawer */}
      <JobDrawer
        open={selectedJob !== null}
        job={selectedJob}
        profiles={profiles}
        onClose={() => setSelectedJob(null)}
        onApply={handleApply}
        onMarkApplied={handleMarkApplied}
        markAppliedPending={markAppliedPending}
        onDismiss={handleDismiss}
        showActions={true}
        canEditJob={canEditJobs}
        onJobFieldSave={saveJobFields}
        dismissOpen={dismissOpen}
        setDismissOpen={setDismissOpen}
        dismissReason={dismissReason}
        setDismissReason={setDismissReason}
      />
    </div>
  );
}
