"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  List,
  LayoutDashboard,
  Upload,
  SlidersHorizontal,
} from "lucide-react";

import type { ApiLead, ApiLeadUser } from "@/app/api/leads/route";
import { LeadsBoardView } from "@/components/leads/board/leads-board-view";
import { LeadsListView } from "@/components/leads/list/leads-list-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppUser, Lead, Profile } from "@/components/leads/types";
import { FilterOption } from "@/components/jobs/filter-option";
import { FilterSidebar } from "@/components/jobs/filter-sidebar";
import {
  DateRangeSection,
  EngagementSection,
  FilterSection,
  SortSection,
} from "@/components/jobs/filter-sections";
import { ProfileUserFilters } from "@/components/leads/profile-user-filters";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { GooeyInput } from "@/components/ui/gooey-input";
import { cn } from "@/lib/utils";
import {
  stageColor,
  type DateRange,
  type EngagementType,
  type SortOption,
} from "@/lib/constants";
import { apiDelete, apiGet, apiPatch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { getDateWindow } from "@/lib/date-window";
import JobDrawer, { type Job, type JobFieldPatch } from "@/components/job-drawer";
import dynamic from "next/dynamic";

// Loaded on demand — the Excel parser (SheetJS) is a ~330 KB chunk that
// should never ship on a page load when the user isn't importing.
const ImportJobsDialog = dynamic(
  () =>
    import("@/components/jobs/import-jobs-dialog").then(
      (m) => m.ImportJobsDialog,
    ),
  { ssr: false },
);

const PAGE_SIZE = 100;

interface LeadsResponse {
  leads: ApiLead[];
  users: ApiLeadUser[];
  profiles: { id: string; name: string; userId: string | null }[];
  pipelineStages: {
    id: string;
    name: string;
    orderIndex: number;
    state: "active" | "paused" | "closed";
  }[];
  currentUser: { id: string; name: string };
  canManageLeadNotes: boolean;
  canEditJobs: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const buildQueryKey = (opts: {
  search: string;
  status: string;
  country: string;
  profileId: string;
  userId: string;
  dateRange: DateRange;
  sort: SortOption;
  engagement: EngagementType | "";
}) => {
  const params = new URLSearchParams({
    search: opts.search,
    status: opts.status === "all" ? "" : opts.status,
    country: opts.country,
    profileId: opts.profileId === "all" ? "" : opts.profileId,
    userId: opts.userId === "all" ? "" : opts.userId,
    dateRange: opts.dateRange,
    sort: opts.sort,
    engagement: opts.engagement,
    pageSize: String(PAGE_SIZE),
  });
  // Exact week/month/year window (leads are dated by applied_at).
  const window = getDateWindow(opts.dateRange);
  if (window) {
    params.set("from", window.from);
    params.set("to", window.to);
  }
  return params.toString();
};

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
    status: a.status,
    assignedTo: a.assignedTo,
    notes: a.notes,
    developer: a.developer,
    parsedData: a.parsedData,
    engagementType: a.engagementType,
    salary: null,
    parser: a.parser,
    applyUrl: a.applyUrl,
  };
}

export default function LeadsTab() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [engagementFilter, setEngagementFilter] = useState<EngagementType | "">("");
  const [profileFilter, setProfileFilter] = useState("all");
  const [bdFilter, setBdFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const [view, setView] = useState<"list" | "board">("list");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  // Stage each lead sat in before its checkbox was ticked, so unticking
  // returns it there rather than dumping everything back into the first stage.
  const [stageBeforeDone, setStageBeforeDone] = useState<Record<string, string>>({});
  // Lead awaiting a closed-stage choice — set when the admin has configured
  // more than one closed-state stage, so "mark done" can't default to
  // whichever one happens to be first.
  const [closingLeadId, setClosingLeadId] = useState<string | null>(null);
  const [revertPending, setRevertPending] = useState(false);

  const params = buildQueryKey({
    search,
    status: statusFilter,
    country: countryFilter,
    profileId: profileFilter,
    userId: bdFilter,
    dateRange,
    sort,
    engagement: engagementFilter,
  });
  const leadsKey = queryKeys.leads.list(params);

  const { data, isPending, error } = useQuery({
    queryKey: leadsKey,
    queryFn: ({ signal }) => apiGet<LeadsResponse>(`/api/leads?${params}`, signal),
  });

  const leads = useMemo(() => (data?.leads ?? []).map(toLead), [data]);
  const users: AppUser[] = data?.users ?? [];
  const profiles: Profile[] = data?.profiles ?? [];
  const stages = data?.pipelineStages ?? [];
  const currentUser = data?.currentUser ?? null;
  const canManageLeadNotes = data?.canManageLeadNotes ?? false;
  const canEditJobs = data?.canEditJobs ?? false;

  // Stage state (active / paused / closed) is admin-controlled on the Lead
  // Stages page — no longer inferred from stage position. "Done" now means
  // "in a closed-state stage" (there can be more than one). With exactly one
  // closed stage, marking a lead done goes straight there; with several, the
  // admin is asked which one (see closingLeadId). Unticking returns a lead to
  // its previous stage.
  const closedStages = stages.filter((s) => s.state === "closed");
  const closedStageNames = new Set(closedStages.map((s) => s.name));
  const doneStage = closedStages[0]?.name ?? null;
  const isClosedStatus = (status: string) => closedStageNames.has(status);

  /** Optimistic write into this filter's cached page. */
  const patchCachedLead = (id: string, patch: Partial<ApiLead>) => {
    queryClient.setQueryData<LeadsResponse>(leadsKey, (current) =>
      current
        ? { ...current, leads: current.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }
        : current,
    );
  };

  // Other filter combinations are cached too, and status is exactly what some
  // of them filter on, so every write invalidates the whole leads area.
  const refreshLeads = () => queryClient.invalidateQueries({ queryKey: queryKeys.leads.all() });

  const changeSearch = (v: string) => setSearch(v);
  const changeStatus = (v: string | null) => setStatusFilter(v ?? "all");
  const changeCountry = (v: string) => setCountryFilter(v);
  const changeProfile = (v: string) => setProfileFilter(v ?? "all");
  const changeBd = (v: string) => setBdFilter(v ?? "all");
  const changeDateRange = (v: DateRange) => setDateRange(v);
  const changeSort = (v: SortOption) => setSort(v);
  const changeEngagement = (v: EngagementType | "") => setEngagementFilter(v);

  // The drawer shows a synthetic job whose id is the LEAD id, so the edit has
  // to target the real jobId — patching selectedLead.id would 404.
  const saveJobFields = async (patch: JobFieldPatch) => {
    if (!selectedLead) return "No lead selected.";
    try {
      await apiPatch<{ success: boolean }>(`/api/jobs/${selectedLead.jobId}`, patch);
      await refreshLeads();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Something went wrong. Please try again.";
    }
  };

  const isActiveFilter =
    statusFilter !== "all" ||
    countryFilter !== "" ||
    engagementFilter !== "" ||
    profileFilter !== "all" ||
    bdFilter !== "all" ||
    dateRange !== "all" ||
    sort !== "newest";

  const clearFilters = () => {
    setStatusFilter("all");
    setCountryFilter("");
    setEngagementFilter("");
    setProfileFilter("all");
    setBdFilter("all");
    setDateRange("all");
    setSort("newest");
  };

  const stageIdFor = (status: string) =>
    stages.find((s) => s.name === status)?.id ?? null;

  const updateStatus = async (id: string, status: string) => {
    const stageId = stageIdFor(status);
    if (!stageId) return;
    // Optimistic update — the status select / board drag should feel instant.
    patchCachedLead(id, { status });
    setSelectedLead((current) =>
      current?.id === id ? { ...current, status } : current,
    );
    try {
      await apiPatch<{ success: boolean }>(`/api/leads/${id}`, {
        pipelineStageId: stageId,
      });
    } catch (err) {
      console.error("Failed to update lead status:", err);
    } finally {
      await refreshLeads();
    }
  };

  const toggleDone = (id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || !doneStage) return;

    if (isClosedStatus(lead.status)) {
      updateStatus(id, stageBeforeDone[id] ?? stages[0]?.name ?? doneStage);
      return;
    }

    // Several closed stages configured (e.g. "Offer Accepted" vs
    // "Rejected") — ask which one instead of silently picking the first.
    if (closedStages.length > 1) {
      setClosingLeadId(id);
      return;
    }

    setStageBeforeDone((current) => ({ ...current, [id]: lead.status }));
    updateStatus(id, doneStage);
  };

  const confirmClose = (stageName: string) => {
    if (!closingLeadId) return;
    const lead = leads.find((l) => l.id === closingLeadId);
    if (lead) {
      setStageBeforeDone((current) => ({ ...current, [closingLeadId]: lead.status }));
      updateStatus(closingLeadId, stageName);
    }
    setClosingLeadId(null);
  };

  // Applier's Notes: the profile's current assigned user (assignedTo — leads
  // follow the profile) may write or edit them — plus Admins and BD
  // Managers, who manage the whole pipeline (canManageLeadNotes).
  // The developer is a LEAD field (not the job's), so it patches
  // /api/leads/{id} rather than /api/jobs/{id}. Admin/BD Manager only — the
  // same canEditJobs gate that shows the row in the drawer.
  const saveDeveloper = async (value: string) => {
    if (!selectedLead) return "No lead selected.";
    try {
      await apiPatch<{ success: boolean }>(`/api/leads/${selectedLead.id}`, {
        developer: value,
      });
      await refreshLeads();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Something went wrong. Please try again.";
    }
  };

  const canEditNotes = Boolean(
    currentUser &&
    selectedLead &&
    (currentUser.id === selectedLead.assignedTo || canManageLeadNotes),
  );

  // Revert to Pipeline — undoes an accidental Convert to Leads. Same method
  // as converting (soft-delete via the API), gated the same way (the API
  // checks canAccessJobs, which every role that can convert also has — no
  // separate permission prop needed here, unlike canEditJobs for developer).
  const revertToPipeline = async () => {
    if (!selectedLead || revertPending) return;
    setRevertPending(true);
    try {
      await apiDelete<{ success: boolean }>(`/api/leads/${selectedLead.id}`);
    } catch (err) {
      console.error("Failed to revert lead to pipeline:", err);
      return;
    } finally {
      setRevertPending(false);
    }
    setSelectedLead(null);
    await refreshLeads();
  };

  const saveNote = async (id: string, notes: string) => {
    const lead = leads.find((l) => l.id === id);
    if (
      !lead ||
      !currentUser ||
      (currentUser.id !== lead.assignedTo && !canManageLeadNotes)
    )
      return;
    patchCachedLead(id, { notes });
    setSelectedLead((current) =>
      current?.id === id ? { ...current, notes } : current,
    );
    try {
      await apiPatch<{ success: boolean }>(`/api/leads/${id}`, { notes });
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      await refreshLeads();
    }
  };

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
    stage: lead.status,
    applyUrl: lead.applyUrl,
    isLead: true,
    // The lead's own developer rides on the job's parsedData so the drawer
    // renders it in the same spot — it's stored on the lead, not the job.
    parsedData: {
      ...((lead.parsedData ?? {}) as Record<string, unknown>),
      developer: lead.developer,
    } as Job["parsedData"],
    engagementType: lead.engagementType,
    profiles: [],
  });

  const bdUsers = users.filter((u) => u.role === "bd" || u.role === "lead");

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Toolbar — compact row. All filter controls live in the right-hand
            sidebar (shared shell with Discovery / Pipeline). */}
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
            placeholder="Search leads…"
            expandedWidth={192}
          />

          {/* Right: Filters toggle + List / Board toggle + Import */}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="rounded px-3 text-xs text-muted-foreground transition-colors duration-150 hover:bg-accent"
            >
              <Upload className="size-3.5" />
              Import
            </Button>
            <div className="flex items-center rounded border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 h-7 text-xs transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
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
                  "flex items-center gap-1.5 px-2.5 h-7 text-xs transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  view === "board"
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <LayoutDashboard className="size-3.5" />
                Board
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen((open) => !open)}
              className={cn(
                "h-9 shrink-0 rounded-md px-3 text-xs font-medium transition-colors duration-150 hover:bg-accent",
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

        {/* Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {isPending ? (
            <div className="flex flex-1 flex-col gap-3 p-4">
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
          ) : error ? (
            <div className="flex-1 py-10 text-center text-sm text-destructive">
              Failed to load leads
            </div>
          ) : view === "list" ? (
            <LeadsListView
              leads={leads}
              users={users}
              stages={stages}
              onToggleDone={toggleDone}
              onStatusChange={updateStatus}
              onOpen={setSelectedLead}
            />
          ) : (
            <LeadsBoardView
              leads={leads}
              users={users}
              stages={stages}
              onStatusChange={updateStatus}
              onOpen={setSelectedLead}
            />
          )}
        </div>
      </div>

      {/* Right filter sidebar — same shell and sections as Discovery/Pipeline */}
      <FilterSidebar
        open={filtersOpen}
        clearable={isActiveFilter}
        onClear={clearFilters}
        widthClass="w-[240px]"
      >
        {/* Team — profile/user (coupled); a manager/admin tool. Business
            Developers only ever see their own data, so it's hidden for them. */}
        {canManageLeadNotes && (
          <FilterSection title="Team">
            <ProfileUserFilters
              stacked
              profiles={profiles}
              bdUsers={bdUsers}
              profileFilter={profileFilter}
              setProfileFilter={changeProfile}
              bdFilter={bdFilter}
              setBdFilter={changeBd}
            />
          </FilterSection>
        )}

        {/* Status — stages come from the database (pipeline_stages) */}
        <FilterSection title="Status">
          <FilterOption
            active={statusFilter === "all"}
            onClick={() => changeStatus("all")}
          >
            Any
          </FilterOption>
          {stages.map((s, i) => (
            <FilterOption
              key={s.id}
              active={statusFilter === s.name}
              onClick={() => changeStatus(s.name)}
              dot={stageColor(i)}
            >
              {s.name}
            </FilterOption>
          ))}
        </FilterSection>

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

        {/* Type — how the originating job reached us */}
        <EngagementSection value={engagementFilter} onValueChange={changeEngagement} />

        {/* Time + Sort (shared with Discovery / Pipeline) */}
        <DateRangeSection value={dateRange} onValueChange={changeDateRange} />
        <SortSection
          value={sort}
          onValueChange={changeSort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
            { value: "company_asc", label: "Company A–Z" },
            { value: "company_desc", label: "Company Z–A" },
          ]}
        />
      </FilterSidebar>

      <JobDrawer
        open={selectedLead !== null}
        job={selectedLead ? jobForLead(selectedLead) : null}
        onClose={() => setSelectedLead(null)}
        profiles={profiles.filter((p) => p.id === selectedLead?.profileId)}
        showActions={false}
        commentsJobId={selectedLead?.jobId}
        notes={selectedLead?.notes}
        onNotesSave={(value) => {
          if (selectedLead) saveNote(selectedLead.id, value);
        }}
        canEditNotes={canEditNotes}
        canEditJob={canEditJobs}
        onJobFieldSave={saveJobFields}
        isLeadsView
        onDeveloperSave={saveDeveloper}
        stages={stages}
        onStageChange={(stage) => {
          if (selectedLead) updateStatus(selectedLead.id, stage);
        }}
        onRevertToPipeline={revertToPipeline}
        revertPending={revertPending}
      />

      {/* Import — bulk-add jobs from an Excel file; defaults to importing as
          Leads (this page's kind), so Stage / Developer / Notes are offered. */}
      <ImportJobsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshLeads}
        defaultKind="lead"
        profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
        stages={stages}
      />

      {/* Closed-stage picker — only shown when the admin has configured more
          than one closed-state stage (e.g. "Offer Accepted" vs "Rejected"),
          so marking a lead done never silently guesses which one. */}
      {closingLeadId && (
        <Dialog open onOpenChange={(open) => { if (!open) setClosingLeadId(null); }}>
          <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <DialogTitle className="text-base font-semibold">Move to which stage?</DialogTitle>
            </div>
            <div className="p-5 flex flex-col gap-2">
              {closedStages.map((stage) => (
                <Button
                  key={stage.id}
                  type="button"
                  variant="outline"
                  onClick={() => confirmClose(stage.name)}
                  className="h-9 justify-start rounded-md font-medium hover:bg-accent"
                >
                  {stage.name}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
