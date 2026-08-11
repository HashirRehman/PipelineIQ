"use client";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
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
import { stageColor } from "@/lib/constants";
import { withOrgId } from "@/lib/api/client";

const LEADS_PAGE_SIZE = 50;

type Granularity = "daily" | "weekly" | "monthly";
type Range = "1mo" | "3mo" | "6mo" | "1y";

const RANGE_DAYS: Record<Range, number> = {
  "1mo": 30,
  "3mo": 90,
  "6mo": 180,
  "1y": 365,
};

interface LeadsPage {
  leads: ApiLead[];
  users: ApiLeadUser[];
  profiles: { id: string; name: string; userId: string | null }[];
  pipelineStages: { id: string; name: string; orderIndex: number }[];
  currentUser: { id: string; name: string };
  totalPages: number;
}

function BarChart({
  data,
  labels,
  color = "var(--brand-blue)",
}: {
  data: number[];
  labels: string[];
  color?: string;
}) {
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-2 h-[152px]">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className={`font-mono text-micro text-muted-foreground font-semibold ${v > 0 ? "visible" : "invisible"}`}>{v}</div>
          <div className="w-full relative h-[120px] flex items-end">
            <div
              className="w-full rounded-t transition-[height] duration-400 ease-in-out"
              style={{
                background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 53%, transparent))`,
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 4 : 0,
              }}
            />
          </div>
          <div className="font-mono text-micro text-muted-foreground text-center">{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1);
  const w = 400;
  const h = 100;
  const pad = { l: 8, r: 8, t: 10, b: 0 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  // A single bucket (monthly + "Last month") has no line or area to draw —
  // just center the point so the value still shows.
  const single = data.length <= 1;
  const pts = data.map((v, i) => ({
    x: pad.l + (single ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.t + (1 - v / max) * innerH,
  }));

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fill = single
    ? null
    : `${path} L ${pts[pts.length - 1].x} ${h} L ${pts[0].x} ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full h-auto overflow-visible">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} y1={pad.t + f * innerH} x2={w - pad.r} y2={pad.t + f * innerH}
          stroke="var(--border)" strokeWidth="0.5" />
      ))}
      {fill && <path d={fill} fill="color-mix(in srgb, var(--brand-blue) 8%, transparent)" />}
      <path d={path} fill="none" stroke="var(--brand-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--brand-blue)" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={pts[i].x} y={h + 16} textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: "var(--text-micro)", fontFamily: "var(--font-mono)" }}>{l}</text>
      ))}
    </svg>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 52;
  const cx = 70;
  const cy = 70;

  const arcs = segments.reduce<{ label: string; value: number; color: string; startAngle: number; sweep: number }[]>((arr, seg) => {
    const prev = arr[arr.length - 1];
    const startAngle = prev ? prev.startAngle + prev.sweep : -Math.PI / 2;
    const sweep = (seg.value / total) * 2 * Math.PI;
    arr.push({ ...seg, startAngle, sweep });
    return arr;
  }, []);

  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        {arcs.map((seg, i) => {
          const x1 = cx + r * Math.cos(seg.startAngle);
          const y1 = cy + r * Math.sin(seg.startAngle);
          const x2 = cx + r * Math.cos(seg.startAngle + seg.sweep);
          const y2 = cy + r * Math.sin(seg.startAngle + seg.sweep);
          const largeArc = seg.sweep > Math.PI ? 1 : 0;
          return (
            <path key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={seg.color} opacity="0.85"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r * 0.58} fill="var(--card)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--page-fg)" style={{ fontSize: "var(--text-lg)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted-foreground)" style={{ fontSize: "var(--text-nano)", fontFamily: "var(--font-mono)" }}>TOTAL</text>
      </svg>
      <div className="flex flex-col gap-1.75">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-foreground">{s.label}</span>
            <span className="font-mono text-meta text-muted-foreground ml-auto">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Bucket keys + short labels for the leads-over-time chart. Buckets are
// anchored to the given reference time so recent empty periods still show as
// zero bars.
function buildBuckets(granularity: Granularity, days: number, nowMs: number): { key: string; label: string }[] {
  const now = new Date(nowMs);
  const buckets: { key: string; label: string }[] = [];
  if (granularity === "monthly") {
    const months = Math.max(1, Math.ceil(days / 30));
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
      });
    }
  } else if (granularity === "weekly") {
    const weeks = Math.max(1, Math.ceil(days / 7));
    const start = new Date(now);
    start.setDate(start.getDate() - (weeks - 1) * 7);
    for (let i = 0; i < weeks; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i * 7);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
  } else {
    const daysCount = Math.max(1, days);
    const start = new Date(now);
    start.setDate(start.getDate() - (daysCount - 1));
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
  }
  return buckets;
}

function bucketKey(granularity: Granularity, date: Date): string {
  if (granularity === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "weekly") {
    // Monday-start week.
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const [dateRange, setDateRange] = useState<Range>("6mo");
  const [granularity, setGranularity] = useState<Granularity>("monthly");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setNowMs(Date.now());
        // All leads, page by page (the route caps pageSize at 50). The first
        // page reveals totalPages; the rest are independent, so fetch them in
        // parallel instead of waiting for each one (async-parallel).
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

        // Active profile count for the stat card.
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
  const isAdmin = currentUser
    ? users.find((u) => u.id === currentUser.id)?.role === "admin"
    : false;

  const rangeDays = RANGE_DAYS[dateRange];

  // Leads in the selected window, then narrowed by the user/profile filters.
  const filtered = useMemo(() => {
    if (!nowMs) return [];
    const cutoff = nowMs - rangeDays * 24 * 60 * 60 * 1000;
    return leads.filter((lead) => {
      const t = new Date(lead.appliedAt).getTime();
      if (!Number.isFinite(t) || t < cutoff) return false;
      if (userFilter !== "all" && lead.assignedTo !== userFilter) return false;
      if (profileFilter !== "all" && lead.profileId !== profileFilter) return false;
      return true;
    });
  }, [leads, rangeDays, userFilter, profileFilter, nowMs]);

  const buckets = useMemo(() => buildBuckets(granularity, rangeDays, nowMs), [granularity, rangeDays, nowMs]);

  const chartData = useMemo(() => {
    const counts = new Map(buckets.map((b) => [b.key, 0]));
    for (const lead of filtered) {
      const key = bucketKey(granularity, new Date(lead.appliedAt));
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return buckets.map((b) => counts.get(b.key) ?? 0);
  }, [filtered, buckets, granularity]);

  const totalLeads = filtered.length;
  const now = new Date(nowMs);
  const leadsThisMonth = filtered.filter((l) => {
    const d = new Date(l.appliedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const avgPerUser = bdUsers.length > 0 ? (totalLeads / bdUsers.length).toFixed(1) : "0";

  const statsCards = [
    { label: "Total Leads", value: totalLeads, sub: `in the selected range`, color: "var(--brand-blue)" },
    { label: "Active Profiles", value: activeProfileCount, sub: `of ${profiles.length} total`, color: "var(--status-green)" },
    { label: "Leads This Month", value: leadsThisMonth, sub: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }), color: "var(--brand-sky)" },
    { label: "Avg / BD", value: avgPerUser, sub: `${bdUsers.length} team members`, color: "var(--status-amber)" },
  ];

  // Status breakdown — every DB stage with leads, colored by its position.
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

  const perUserData = useMemo(
    () =>
      bdUsers.map((u) => ({
        user: u,
        total: filtered.filter((l) => l.assignedTo === u.id).length,
      })),
    [bdUsers, filtered],
  );

  const perProfileData = useMemo(
    () =>
      profiles.map((p) => ({
        profile: p,
        total: filtered.filter((l) => l.profileId === p.id).length,
      })),
    [profiles, filtered],
  );
  const maxProfileLeads = Math.max(...perProfileData.map((p) => p.total), 1);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-background shrink-0">
        {isAdmin && (
          <Select value={userFilter} onValueChange={(v) => setUserFilter(v ?? "all")}>
            <SelectTrigger size="sm" className="h-8 w-auto min-w-[140px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {bdUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
        <Select value={dateRange} onValueChange={(v) => setDateRange((v ?? "6mo") as Range)}>
          <SelectTrigger size="sm" className="h-8 w-auto min-w-[130px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1mo">Last month</SelectItem>
            <SelectItem value="3mo">Last 3 months</SelectItem>
            <SelectItem value="6mo">Last 6 months</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
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
              {statsCards.map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} color={s.color} />
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Leads over time */}
              <Card className="gap-0 p-5">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Leads Over Time</div>
                  <div className="text-meta text-muted-foreground mb-4">
                    {granularity} · {userFilter === "all" ? "All users" : (users.find((u) => u.id === userFilter)?.name ?? "All users")}
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

            {/* Per-BD bar charts (admin only) */}
            {isAdmin && userFilter === "all" && (
              <Card className="gap-0 p-5">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Leads by Team Member</div>
                  <div className="text-meta text-muted-foreground mb-5">Totals in the selected range</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6">
                    {perUserData.map((entry, i) => {
                      const colors = ["var(--brand-blue)", "var(--brand-sky)", "var(--status-green)", "var(--status-amber)"];
                      const color = colors[i % colors.length];
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
                          <div className="flex items-center gap-1.75 mb-2.5">
                            <div className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-micro font-bold text-white" style={{ background: color }}>
                              {entry.user.name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-foreground">{entry.user.name.split(" ")[0]}</div>
                              <div className="font-mono text-caption" style={{ color }}>{entry.total} total</div>
                            </div>
                          </div>
                          <BarChart data={ownCounts.slice(-5)} labels={buckets.slice(-5).map((b) => b.label)} color={color} />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Profile activity */}
            <Card className="gap-0 p-5">
              <CardContent className="p-0">
                <div className="text-sm font-semibold text-foreground mb-4">Profile Activity</div>
                {perProfileData.length > 0 ? (
                  <div className="flex flex-col">
                    {perProfileData.map((entry, i) => {
                      const pct = (entry.total / maxProfileLeads) * 100;
                      return (
                        <div key={entry.profile.id} className={`flex items-center gap-3 py-2.75 ${i < perProfileData.length - 1 ? "border-b border-border" : ""}`}>
                          <Avatar name={entry.profile.name} size={30} />
                          <div className="w-[140px] shrink-0">
                            <div className="text-xs font-medium text-foreground">{entry.profile.name}</div>
                            <div className="font-mono text-caption text-muted-foreground">
                              {users.find((u) => u.id === entry.profile.userId)?.name ?? "Unassigned"}
                            </div>
                          </div>
                          <Progress value={pct} className="flex-1 gap-0"
                            trackClassName="h-1.5 bg-muted"
                            indicatorClassName="h-full bg-gradient-to-r from-brand-blue to-brand-sky rounded-full" />
                          <div className="font-mono w-[60px] text-right text-xs font-bold text-foreground shrink-0">
                            {entry.total} <span className="font-normal text-muted-foreground text-caption">leads</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-muted-foreground">No profiles yet</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
