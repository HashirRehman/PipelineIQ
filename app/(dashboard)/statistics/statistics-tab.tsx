"use client";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/stat-card";
import { BarChart, DonutChart, FunnelChart, LineChart } from "@/components/charts";
import { ProfileUserFilters } from "@/components/leads/profile-user-filters";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { ApiLead, ApiLeadUser } from "@/app/api/leads/route";
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
import { withOrgId } from "@/lib/api/client";

const LEADS_PAGE_SIZE = 50;

type Granularity = "daily" | "weekly" | "monthly";

interface LeadsPage {
  leads: ApiLead[];
  users: ApiLeadUser[];
  profiles: { id: string; name: string; userId: string | null }[];
  pipelineStages: { id: string; name: string; orderIndex: number }[];
  currentUser: { id: string; name: string };
  totalPages: number;
}

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
  const [leads, setLeads] = useState<ApiLead[]>([]);
  const [users, setUsers] = useState<ApiLeadUser[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string; userId: string | null }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; orderIndex: number }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [activeProfileCount, setActiveProfileCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Reference timestamp captured when the data loads — kept in state so the
  // date windows and chart buckets are stable across re-renders.
  const [nowMs, setNowMs] = useState(0);

  const [userFilter, setUserFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  // Pipeline-style date filters — three mutually exclusive controls: quick
  // ranges (this/last week, month, year, all time), months of this year, and
  // this/last year. Picking one clears the others (they'd otherwise conflict).
  const [dateRange, setDateRange] = useState<DateRange>("this_year");
  const [monthFilter, setMonthFilter] = useState<number | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setNowMs(Date.now());
        // All leads, page by page (the route caps pageSize at 50). The first
        // page reveals totalPages; the rest are independent, so fetch them in
        // parallel instead of waiting for each one (async-parallel). The
        // route scopes BDs to their own leads, so this list is the caller's
        // visible pipeline from the start.
        const firstRes = await fetch(withOrgId(`/api/leads?page=1&pageSize=${LEADS_PAGE_SIZE}&dateRange=all&sort=newest`));
        if (!firstRes.ok) throw new Error("Failed to load leads");
        const first = (await firstRes.json()) as LeadsPage;
        const all: ApiLead[] = [...first.leads];
        const users = first.users;
        const profiles = first.profiles;
        const stages = first.pipelineStages;
        const currentUser = first.currentUser;

        const rest = await Promise.all(
          Array.from({ length: first.totalPages - 1 }, (_, i) =>
            fetch(withOrgId(`/api/leads?page=${i + 2}&pageSize=${LEADS_PAGE_SIZE}&dateRange=all&sort=newest`)).then(
              async (res) => {
                if (!res.ok) throw new Error("Failed to load leads");
                return (await res.json()) as LeadsPage;
              },
            ),
          ),
        );

        if (cancelled) return;
        for (const json of rest) all.push(...json.leads);
        setLeads(all);
        setUsers(users);
        setProfiles(profiles);
        setStages(stages);
        setCurrentUser(currentUser);

        // Active profile count for the stat card — Admin + BD Manager only
        // (Business Developers get 403 from /api/profiles; their card counts
        // their own profiles from the scoped leads response instead).
        const roleKey = users.find((u) => u.id === currentUser?.id)?.role ?? "bd";
        if (roleKey !== "bd") {
          const profileRes = await fetch(withOrgId("/api/profiles"));
          if (profileRes.ok) {
            const profileJson = (await profileRes.json()) as { profiles?: { isActive: boolean }[]; isActive?: boolean };
            const list = Array.isArray(profileJson.profiles)
              ? profileJson.profiles
              : Array.isArray(profileJson)
                ? (profileJson as unknown as { isActive: boolean }[])
                : [];
            if (list.length > 0 && "isActive" in list[0]) {
              setActiveProfileCount(list.filter((p) => p.isActive).length);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load statistics:", err);
        if (!cancelled) setError("Failed to load statistics");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const bdUsers = users.filter((u) => u.role === "bd" || u.role === "lead");
  // Admin and BD Manager see the whole org (and the user filter + team
  // charts); Business Developers only ever see their own scoped data.
  const canViewTeam = (users.find((u) => u.id === currentUser?.id)?.role ?? "bd") !== "bd";

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
  // "Avg / BD" divides by the number of users in scope: with a user or
  // profile filter active the selection already pins the work to one user,
  // so the denominator is 1 — dividing by the whole team would under-report
  // (e.g. one user's 4 leads ÷ 6 members = 0.7).
  const avgDenominator =
    userFilter !== "all" || profileFilter !== "all" ? 1 : bdUsers.length;
  const avgPerUser = bdUsers.length > 0 ? (totalLeads / avgDenominator).toFixed(1) : "0";

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
    { label: "Total Leads", value: totalLeads, sub: dateFilterLabel },
    canViewTeam
      ? { label: "Active Profiles", value: activeProfileCount, sub: `of ${profiles.length} total` }
      : { label: "My Profiles", value: profiles.length, sub: "assigned to you" },
    { label: "Leads This Month", value: leadsThisMonth, sub: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) },
    { label: "Avg / BD", value: avgPerUser, sub: `${bdUsers.length} team member${bdUsers.length === 1 ? "" : "s"}` },
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
            {error}
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statsCards.map((s, i) => (
                <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} delay={i * 60} />
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Leads over time */}
              <Card className="gap-0 p-5">
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
              <Card className="gap-0 p-5">
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
            <Card className="gap-0 p-5">
              <CardContent className="p-0">
                <div className="text-sm font-semibold text-foreground mb-1">Pipeline Distribution</div>
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
              <Card className="gap-0 p-5">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Leads by Team Member</div>
                  <div className="text-meta text-muted-foreground mb-5">Totals in the selected range</div>
                  {teamRows.length > 0 ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
                    {teamRows.map((entry, i) => {
                      const color = SERIES_PALETTE[i % SERIES_PALETTE.length];
                      // Bucket the user's own leads the same way as the main chart.
                      const ownCounts = buckets.map((b) => {
                        const key = b.key;
                        let n = 0;
                        for (const lead of filtered) {
                          if (lead.assignedTo !== entry.user.id) continue;
                          if (bucketKey(granularity, new Date(lead.appliedAt)) === key) n += 1;
                        }
                        return n;
                      });
                      return (
                        <div key={entry.user.id}>
                          <div className="flex items-center gap-2 mb-2.5">
                            <div
                              className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-micro font-bold text-white shrink-0"
                              style={{ background: color }}
                            >
                              {entry.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-foreground">{entry.user.name.split(" ")[0]}</div>
                              <div className="font-mono text-caption text-muted-foreground">{entry.total} total</div>
                            </div>
                          </div>
                          <BarChart data={ownCounts.slice(-5)} labels={buckets.slice(-5).map((b) => b.label)} color={color} />
                        </div>
                      );
                    })}
                  </div>
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
        )}
      </div>
    </div>
  );
}
