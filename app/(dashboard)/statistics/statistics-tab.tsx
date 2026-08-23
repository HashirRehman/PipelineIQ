"use client";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { DonutChart, FunnelChart, LineChart, StackedBarChart } from "@/components/charts";
import { ProfileUserFilters } from "@/components/leads/profile-user-filters";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { SERIES_PALETTE, stageColor, type DateRange, DATE_RANGES } from "@/lib/constants";
import {
  businessWeekStart,
  dateRangeLabel,
  getDateWindow,
  getMonthWindow,
  getYearWindow,
  monthWindowLabel,
  yearWindowLabel,
} from "@/lib/date-window";
import { isWithinWindow } from "@/lib/api/job-filters";
import { useAllLeads } from "@/hooks/use-all-leads";
import { useApplications } from "@/hooks/use-applications";

type Granularity = "daily" | "weekly" | "monthly";

/** Sensible default bucket size for a window's length. */
function suggestGranularity(window: { from: string; to: string } | null): Granularity {
  if (!window) return "monthly";
  const days = (new Date(window.to).getTime() - new Date(window.from).getTime()) / 86_400_000;
  if (days <= 31) return "daily";
  if (days <= 200) return "weekly";
  return "monthly";
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Friday-start business weeks (Fri → Thu) — the same week the date filters
// use, shared via businessWeekStart so the buckets and the window bounds can
// never disagree.
function weekKey(d: Date): string {
  return dayKey(businessWeekStart(d));
}

// Bucket keys + short labels for the leads-over-time chart, built from the
// selected date window's [from, to] bounds (anchored to the window, not to
// "now", so empty periods still show as zero bars).
function buildBuckets(granularity: Granularity, from: Date, to: Date): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  if (granularity === "monthly") {
    let d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d <= to) {
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else if (granularity === "weekly") {
    // Friday-start business weeks, aligned to the window's first Friday.
    let d = businessWeekStart(new Date(from));
    while (d <= to) {
      buckets.push({
        key: weekKey(d),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    }
  } else {
    let d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (d <= to) {
      buckets.push({
        key: dayKey(d),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  }
  return buckets;
}

function bucketKey(granularity: Granularity, date: Date): string {
  if (granularity === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "weekly") return weekKey(date);
  return dayKey(date);
}

export default function StatisticsTab() {
  const {
    leads,
    users,
    profiles,
    stages,
    roleKey,
    activeProfileCount,
    isPending,
    error,
  } = useAllLeads();
  // Reference timestamp captured when the component mounts — kept in state so
  // the date windows and chart buckets are stable across re-renders.
  const [nowMs] = useState(() => Date.now());

  const [userFilter, setUserFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  // Pipeline-style date filters — three mutually exclusive controls: quick
  // ranges (this/last week, month, year, all time), months of this year, and
  // this/last year. Picking one clears the others (they'd otherwise conflict).
  const [dateRange, setDateRange] = useState<DateRange>("this_week");
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  // What the widgets below show — leads (the pipeline) or applied jobs. One
  // dataset at a time, sharing the same filters and date buckets.
  const [statsMode, setStatsMode] = useState<"leads" | "applications">("leads");

  const bdUsers = users.filter((u) => u.role === "bd" || u.role === "lead");
  // Admin and BD Manager see the whole org (and the user filter + team
  // charts); Business Developers only ever see their own scoped data.
  const canViewTeam = roleKey !== "bd";

  // Reference time for date windows — derived once from nowMs so the window
  // stays stable across re-renders.
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // The exact [from, to] window for the active date control (null = all time).
  const dateWindow = useMemo(() => {
    if (monthFilter !== null) return getMonthWindow(monthFilter, currentYear);
    if (yearFilter !== null) return getYearWindow(yearFilter);
    return getDateWindow(dateRange, now);
  }, [monthFilter, yearFilter, dateRange, now, currentYear]);

  // Leads inside the selected window, then narrowed by user/profile filters.
  const filtered = useMemo(() => {
    if (!nowMs) return [];
    return leads.filter((lead) => {
      const t = new Date(lead.appliedAt).getTime();
      if (!Number.isFinite(t)) return false;
      if (dateWindow && !isWithinWindow(lead.appliedAt, dateWindow)) return false;
      if (userFilter !== "all" && lead.assignedTo !== userFilter) return false;
      if (profileFilter !== "all" && lead.profileId !== profileFilter) return false;
      return true;
    });
  }, [leads, dateWindow, userFilter, profileFilter, nowMs]);

  // Buckets span the selected window (or the data's own range for all time).
  const buckets = useMemo(() => {
    if (dateWindow) return buildBuckets(granularity, new Date(dateWindow.from), new Date(dateWindow.to));
    const times = leads.map((l) => new Date(l.appliedAt).getTime()).filter(Number.isFinite);
    if (times.length === 0) return [];
    const from = new Date(Math.min(...times));
    const to = new Date(Math.max(...times));
    return buildBuckets(granularity, from, to);
  }, [granularity, dateWindow, leads]);

  const chartData = useMemo(() => {
    const counts = new Map(buckets.map((b) => [b.key, 0]));
    for (const lead of filtered) {
      const key = bucketKey(granularity, new Date(lead.appliedAt));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return buckets.map((b) => counts.get(b.key) ?? 0);
  }, [filtered, buckets, granularity]);

  const totalLeads = filtered.length;
  const leadsThisMonth = filtered.filter((l) => {
    const d = new Date(l.appliedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Exact label for the active date control, e.g. "This year", "August", "2025".
  const dateFilterLabel = monthFilter !== null
    ? monthWindowLabel(monthFilter, currentYear, now)
    : yearFilter !== null
      ? yearWindowLabel(yearFilter)
      : dateRangeLabel(dateRange, now);

  // Any filter active (profile / user / date) — the funnel then shows only
  // stages that actually have leads in the filtered set, not zero rows.
  const hasActiveFilter =
    userFilter !== "all" ||
    profileFilter !== "all" ||
    monthFilter !== null ||
    yearFilter !== null ||
    dateRange !== "all";

  const statsCards = [
    { label: "Total Active Leads", value: totalLeads, sub: dateFilterLabel },
    canViewTeam
      ? { label: "Active Profiles", value: activeProfileCount, sub: `of ${profiles.length} total` }
      : { label: "My Profiles", value: profiles.length, sub: "assigned to you" },
    { label: "Active Leads This Month", value: leadsThisMonth, sub: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) },
  ];

  // Status breakdown — every DB stage with leads, colored by pipeline
  // position so the donut matches the funnel and the rest of the app.
  const statusSegments = useMemo(
    () =>
      stages
        .map((s, i) => ({
          label: s.name,
          value: filtered.filter((l) => l.status === s.name).length,
          color: stageColor(i),
        }))
        .filter((seg) => seg.value > 0),
    [stages, filtered],
  );

  // Per-stage lead counts for the distribution chart — already scoped by the
  // profile/user/date filters. With a filter active, drop stages with no
  // leads so the chart shows only the records it actually represents.
  const stageCounts = useMemo(
    () => stages.map((s) => filtered.filter((l) => l.status === s.name).length),
    [stages, filtered],
  );
  // When a filter is active, only stages with leads in the filtered set are
  // shown — colors keep pointing at each stage's ORIGINAL pipeline position.
  const funnelRows = useMemo(() => {
    if (hasActiveFilter) {
      return stages
        .map((s, i) => ({ stage: s, count: stageCounts[i] }))
        .filter((r) => r.count > 0);
    }
    return stages.map((s, i) => ({ stage: s, count: stageCounts[i] }));
  }, [stages, stageCounts, hasActiveFilter]);
  const funnelColors = useMemo(
    () => funnelRows.map((r) => stageColor(stages.findIndex((s) => s.id === r.stage.id))),
    [funnelRows, stages],
  );

  const perUserData = useMemo(
    () =>
      bdUsers.map((u) => ({
        user: u,
        total: filtered.filter((l) => l.assignedTo === u.id).length,
      })),
    [bdUsers, filtered],
  );
  // When a user or profile is selected, the team widget only shows the
  // filtered user(s) — a profile filters down to the user it's assigned to.
  const visiblePerUser = useMemo(() => {
    let list = perUserData;
    if (profileFilter !== "all") {
      const ownerId = profiles.find((p) => p.id === profileFilter)?.userId ?? null;
      if (ownerId) list = list.filter((e) => e.user.id === ownerId);
    }
    if (userFilter !== "all") {
      list = list.filter((e) => e.user.id === userFilter);
    }
    return list;
  }, [perUserData, profileFilter, userFilter, profiles]);

  const perProfileData = useMemo(
    () =>
      profiles.map((p) => ({
        profile: p,
        total: filtered.filter((l) => l.profileId === p.id).length,
      })),
    [profiles, filtered],
  );
  // Same scoping for the profile widget: a user filter narrows it to that
  // user's currently assigned profiles; a profile filter narrows it to just
  // that profile.
  const visiblePerProfile = useMemo(() => {
    let list = perProfileData;
    if (userFilter !== "all") {
      list = list.filter((e) => e.profile.userId === userFilter);
    }
    if (profileFilter !== "all") {
      list = list.filter((e) => e.profile.id === profileFilter);
    }
    return list;
  }, [perProfileData, userFilter, profileFilter]);
  // With any filter active (including the default date window) rows with no
  // leads in range are dropped — the same zero-row rule as the funnel, so
  // these widgets show only records the selection actually represents.
  const teamRows = hasActiveFilter ? visiblePerUser.filter((e) => e.total > 0) : visiblePerUser;
  const profileRows = hasActiveFilter ? visiblePerProfile.filter((e) => e.total > 0) : visiblePerProfile;
  const maxProfileLeads = Math.max(...profileRows.map((p) => p.total), 1);

  // ── Applied-jobs stats ────────────────────────────────────────────────
  // Every applied (job, profile) pair in scope. Narrowed by the SAME
  // profile/user/date filters as the leads widgets, so the two halves of the
  // page always describe the same selection.
  const {
    data: appsData,
    isPending: appsPending,
    error: appsError,
  } = useApplications();
  const applications = useMemo(() => appsData?.applications ?? [], [appsData]);
  const canViewAllApps = appsData?.canViewAllData ?? false;

  const filteredApplications = useMemo(
    () =>
      applications.filter((a) => {
        if (!isWithinWindow(a.appliedAt, dateWindow)) return false;
        if (userFilter !== "all" && a.userId !== userFilter) return false;
        if (profileFilter !== "all" && a.profileId !== profileFilter) return false;
        return true;
      }),
    [applications, dateWindow, userFilter, profileFilter],
  );

  const totalApplications = filteredApplications.length;
  const appsThisMonth = filteredApplications.filter((a) => {
    const d = new Date(a.appliedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Applications over time — reuses the exact buckets as the leads chart so
  // the two lines share a time axis.
  const appChartData = useMemo(() => {
    const counts = new Map(buckets.map((b) => [b.key, 0]));
    for (const a of filteredApplications) {
      const key = bucketKey(granularity, new Date(a.appliedAt));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return buckets.map((b) => counts.get(b.key) ?? 0);
  }, [filteredApplications, buckets, granularity]);

  // Per-BD applications — scoped by the same user/profile filter rules as
  // the leads team widget.
  const appsPerUserData = useMemo(
    () =>
      bdUsers.map((u) => ({
        user: u,
        total: filteredApplications.filter((a) => a.userId === u.id).length,
      })),
    [bdUsers, filteredApplications],
  );
  const visibleAppsPerUser = useMemo(() => {
    let list = appsPerUserData;
    if (profileFilter !== "all") {
      const ownerId = profiles.find((p) => p.id === profileFilter)?.userId ?? null;
      if (ownerId) list = list.filter((e) => e.user.id === ownerId);
    }
    if (userFilter !== "all") {
      list = list.filter((e) => e.user.id === userFilter);
    }
    return list;
  }, [appsPerUserData, profileFilter, userFilter, profiles]);
  const appsTeamRows = hasActiveFilter
    ? visibleAppsPerUser.filter((e) => e.total > 0)
    : visibleAppsPerUser;

  // Per-profile applications — same scoping as the leads profile widget.
  const appsPerProfileData = useMemo(
    () =>
      profiles.map((p) => ({
        profile: p,
        total: filteredApplications.filter((a) => a.profileId === p.id).length,
      })),
    [profiles, filteredApplications],
  );
  const visibleAppsPerProfile = useMemo(() => {
    let list = appsPerProfileData;
    if (userFilter !== "all") {
      list = list.filter((e) => e.profile.userId === userFilter);
    }
    if (profileFilter !== "all") {
      list = list.filter((e) => e.profile.id === profileFilter);
    }
    return list;
  }, [appsPerProfileData, userFilter, profileFilter]);
  const appsProfileRows = hasActiveFilter
    ? visibleAppsPerProfile.filter((e) => e.total > 0)
    : visibleAppsPerProfile;
  const maxProfileApps = Math.max(...appsProfileRows.map((p) => p.total), 1);

  const appsStatCards = [
    { label: "Total Applications", value: totalApplications, sub: dateFilterLabel },
    { label: "Job Applications This Month", value: appsThisMonth, sub: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) },
  ];

  const changeDateRange = (v: DateRange) => {
    setDateRange(v);
    setMonthFilter(null);
    setYearFilter(null);
    setGranularity(suggestGranularity(getDateWindow(v, now)));
  };
  const changeMonth = (v: string | null) => {
    const month = v === "" || v === null ? null : Number(v);
    setMonthFilter(month);
    if (month !== null) {
      setDateRange("all");
      setYearFilter(null);
      setGranularity(suggestGranularity(getMonthWindow(month, currentYear)));
    }
  };
  const changeYear = (v: string | null) => {
    const year = v === "" || v === null ? null : Number(v);
    setYearFilter(year);
    if (year !== null) {
      setDateRange("all");
      setMonthFilter(null);
      setGranularity(suggestGranularity(getYearWindow(year)));
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-background shrink-0">
        {/* Dataset toggle — the widgets render either leads or applied-jobs
            stats; the filters below apply to whichever is selected. */}
        <Tabs value={statsMode} onValueChange={(v) => setStatsMode((v ?? "leads") as "leads" | "applications")}>
          <TabsList className="rounded-md border border-border overflow-hidden p-0 h-auto gap-0 shadow-none bg-card">
            {(["leads", "applications"] as const).map((m) => (
              <TabsTrigger key={m} value={m}
                className={`h-auto p-2 px-3 border-none rounded-none text-xs shadow-none ${
                  statsMode === m
                    ? "bg-primary/15 font-semibold text-primary"
                    : "bg-transparent font-normal text-foreground hover:bg-accent"
                }`}>
                {m === "applications" ? "Applied Jobs" : "Leads"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {canViewTeam ? (
          /* Coupled team filters — picking a user narrows the profile list to
             that user's currently assigned profiles (and vice versa), exactly
             like the Pipeline page's ProfileUserFilters. */
          <ProfileUserFilters
            profiles={profiles}
            bdUsers={bdUsers}
            profileFilter={profileFilter}
            setProfileFilter={(v) => setProfileFilter(v ?? "all")}
            bdFilter={userFilter}
            setBdFilter={(v) => setUserFilter(v ?? "all")}
          />
        ) : profiles.length > 1 ? (
          /* Business Developers see only their own scoped profiles — no user
             dropdown (their own data is all there is). The profile filter
             only appears when they have more than one profile assigned; with
             one (or zero) there's nothing worth filtering by. */
          <Select value={profileFilter} onValueChange={(v) => setProfileFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="h-8 w-auto min-w-[140px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Profiles</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={dateRange} onValueChange={(v) => changeDateRange((v ?? "this_year") as DateRange)}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-[130px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{dateRangeLabel(r.value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter === null ? "" : String(monthFilter)} onValueChange={changeMonth}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-[110px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All months</SelectItem>
            {Array.from({ length: currentMonth + 1 }, (_, i) => (
              <SelectItem key={i} value={String(i)}>{monthWindowLabel(i, currentYear, now)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter === null ? "" : String(yearFilter)} onValueChange={changeYear}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-[90px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All years</SelectItem>
            <SelectItem value={String(currentYear)}>{yearWindowLabel(currentYear)}</SelectItem>
            <SelectItem value={String(currentYear - 1)}>{yearWindowLabel(currentYear - 1)}</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Tabs value={granularity} onValueChange={(v) => setGranularity((v ?? "monthly") as Granularity)}>
            <TabsList className="rounded-md border border-border overflow-hidden p-0 h-auto gap-0 shadow-none bg-card">
              {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                <TabsTrigger key={g} value={g}
                  className={`h-auto p-2 px-3 border-none rounded-none text-xs shadow-none ${
                    granularity === g
                      ? "bg-primary/15 font-semibold text-primary"
                      : "bg-transparent font-normal text-foreground hover:bg-accent"
                  }`}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load statistics
          </div>
        ) : isPending ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-2.5 w-3/4" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-40 w-full" />
              </div>
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          </>
        ) : (
          <>
            {statsMode === "leads" ? (
              <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {statsCards.map((s, i) => (
                <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} delay={i * 60} />
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Leads over time */}
              <Card className="gap-0 p-5 overflow-visible">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Leads Over Time</div>
                  <div className="text-meta text-muted-foreground mb-4">
                    {granularity} · {dateFilterLabel} · {userFilter !== "all"
                      ? (users.find((u) => u.id === userFilter)?.name ?? "All users")
                      : canViewTeam
                        ? "All users"
                        : "Your leads"}
                  </div>
                  <LineChart data={chartData} labels={buckets.map((b) => b.label)} />
                </CardContent>
              </Card>

              {/* Status donut */}
              <Card className="gap-0 p-5 overflow-visible">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Status Breakdown</div>
                  <div className="text-meta text-muted-foreground mb-4">Current lead distribution</div>
                  {statusSegments.length > 0 ? (
                    <DonutChart segments={statusSegments} />
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">No leads in this range</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pipeline distribution */}
            <Card className="gap-0 p-5 overflow-visible">
              <CardContent className="p-0">
                <div className="text-sm font-semibold text-foreground mb-1">Leads by Stage</div>
                <div className="text-meta text-muted-foreground mb-4">
                  {hasActiveFilter
                    ? `Leads per stage in the selected range`
                    : `All stages — leads currently in each stage`}
                </div>
                {funnelRows.some((r) => r.count > 0) ? (
                  <FunnelChart stages={funnelRows.map((r) => r.stage)} counts={funnelRows.map((r) => r.count)} colors={funnelColors} />
                ) : (
                  <div className="py-10 text-center text-sm text-muted-foreground">No leads in this range</div>
                )}
              </CardContent>
            </Card>

            {/* Per-BD bar charts (Admin + BD Manager only) — rows scope to
                the selected user/profile filter. */}
            {canViewTeam && visiblePerUser.length > 0 && (
              <Card className="gap-0 p-5 overflow-visible">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Leads by Team Member</div>
                  <div className="text-meta text-muted-foreground mb-5">Totals in the selected range</div>
                  {teamRows.length > 0 ? (
                    <StackedBarChart
                      labels={buckets.slice(-5).map((b) => b.label)}
                      series={teamRows.map((entry, i) => ({
                        name: entry.user.name,
                        color: SERIES_PALETTE[i % SERIES_PALETTE.length],
                        // Bucket the user's own leads the same way as the main chart.
                        counts: buckets
                          .map((b) => {
                            const key = b.key;
                            let n = 0;
                            for (const lead of filtered) {
                              if (lead.assignedTo !== entry.user.id) continue;
                              if (bucketKey(granularity, new Date(lead.appliedAt)) === key) n += 1;
                            }
                            return n;
                          })
                          .slice(-5),
                      }))}
                    />
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">No leads in this range</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Profile activity — rows scope to the selected user/profile
                filter (a user shows only their assigned profiles). */}
            <Card className="gap-0 p-5">
              <CardContent className="p-0">
                <div className="text-sm font-semibold text-foreground mb-4">Profile Activity</div>
                {visiblePerProfile.length > 0 ? (
                  <div className="flex flex-col">
                    {profileRows.map((entry, i) => {
                      const pct = (entry.total / maxProfileLeads) * 100;
                      const color = SERIES_PALETTE[i % SERIES_PALETTE.length];
                      const ownerName = users.find((u) => u.id === entry.profile.userId)?.name ?? "Unassigned";
                      return (
                        <div key={entry.profile.id} className={`flex items-center gap-3 py-2.75 ${i < profileRows.length - 1 ? "border-b border-border" : ""}`}>
                          <div
                            className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-micro font-bold text-white shrink-0"
                            style={{ background: color }}
                          >
                            {entry.profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="w-[140px] shrink-0">
                            <div className="text-xs font-medium text-foreground">{entry.profile.name}</div>
                            <div className="font-mono text-caption text-muted-foreground">
                              {ownerName}
                            </div>
                          </div>
                          <Progress value={pct} className="flex-1 gap-0"
                            trackClassName="h-1.5 bg-muted"
                            indicatorClassName="h-full rounded-full"
                            indicatorStyle={{ background: color }} />
                          <div className="font-mono w-[60px] text-right text-xs font-bold text-foreground shrink-0">
                            {entry.total} <span className="font-normal text-muted-foreground text-caption">leads</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-muted-foreground">No profiles in this selection</div>
                )}
              </CardContent>
            </Card>

              </>
            ) : (
              <>
                {/* Application stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {appsStatCards.map((s, i) => (
                    <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} delay={i * 60} />
                  ))}
                </div>

                {appsError ? (
                  <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    Failed to load application stats
                  </div>
                ) : appsPending ? (
                  <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : (
                  <>
                    {/* Applications over time */}
                    <Card className="gap-0 p-5 overflow-visible">
                      <CardContent className="p-0">
                        <div className="text-sm font-semibold text-foreground mb-1">Applications Over Time</div>
                        <div className="text-meta text-muted-foreground mb-4">
                          {granularity} · {userFilter !== "all"
                            ? (users.find((u) => u.id === userFilter)?.name ?? "All users")
                            : canViewTeam
                              ? "All users"
                              : "Your applications"}
                        </div>
                        {filteredApplications.length > 0 ? (
                          <LineChart small unit="application" data={appChartData} labels={buckets.map((b) => b.label)} />
                        ) : (
                          <div className="py-10 text-center text-sm text-muted-foreground">No applications in this range</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Per-BD applications (Admin + BD Manager only) */}
                    {canViewTeam && canViewAllApps && visibleAppsPerUser.length > 0 && (
                      <Card className="gap-0 p-5 overflow-visible">
                        <CardContent className="p-0">
                          <div className="text-sm font-semibold text-foreground mb-1">Applications by Team Member</div>
                          <div className="text-meta text-muted-foreground mb-5">Totals in the selected range</div>
                          {appsTeamRows.length > 0 ? (
                            <StackedBarChart
                              labels={buckets.slice(-5).map((b) => b.label)}
                              unit="application"
                              series={appsTeamRows.map((entry, i) => ({
                                name: entry.user.name,
                                color: SERIES_PALETTE[i % SERIES_PALETTE.length],
                                counts: buckets
                                  .map((b) => {
                                    const key = b.key;
                                    let n = 0;
                                    for (const a of filteredApplications) {
                                      if (a.userId !== entry.user.id) continue;
                                      if (bucketKey(granularity, new Date(a.appliedAt)) === key) n += 1;
                                    }
                                    return n;
                                  })
                                  .slice(-5),
                              }))}
                            />
                          ) : (
                            <div className="py-10 text-center text-sm text-muted-foreground">No applications in this range</div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Per-profile applications */}
                    <Card className="gap-0 p-5">
                      <CardContent className="p-0">
                        <div className="text-sm font-semibold text-foreground mb-4">Profile Application Activity</div>
                        {appsProfileRows.length > 0 ? (
                          <div className="flex flex-col">
                            {appsProfileRows.map((entry, i) => {
                              const pct = (entry.total / maxProfileApps) * 100;
                              const color = SERIES_PALETTE[i % SERIES_PALETTE.length];
                              const ownerName = users.find((u) => u.id === entry.profile.userId)?.name ?? "Unassigned";
                              return (
                                <div key={entry.profile.id} className={`flex items-center gap-3 py-2.75 ${i < appsProfileRows.length - 1 ? "border-b border-border" : ""}`}>
                                  <div
                                    className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-micro font-bold text-white shrink-0"
                                    style={{ background: color }}
                                  >
                                    {entry.profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="w-[140px] shrink-0">
                                    <div className="text-xs font-medium text-foreground">{entry.profile.name}</div>
                                    <div className="font-mono text-caption text-muted-foreground">
                                      {ownerName}
                                    </div>
                                  </div>
                                  <Progress value={pct} className="flex-1 gap-0"
                                    trackClassName="h-1.5 bg-muted"
                                    indicatorClassName="h-full rounded-full"
                                    indicatorStyle={{ background: color }} />
                                  <div className="font-mono w-[60px] text-right text-xs font-bold text-foreground shrink-0">
                                    {entry.total} <span className="font-normal text-muted-foreground text-caption">apps</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-10 text-center text-sm text-muted-foreground">No profiles with applications in this selection</div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
