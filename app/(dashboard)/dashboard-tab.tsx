"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { FunnelChart } from "@/components/charts";
import { Card, CardContent } from "@/components/ui/card";
import type { ApiLead, ApiLeadUser } from "@/app/api/leads/route";
import { SERIES_PALETTE, stageColor } from "@/lib/constants";
import { businessWeekStart } from "@/lib/date-window";
import { withOrgId } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const LEADS_PAGE_SIZE = 50;
const STALL_DAYS = 14;

interface LeadsPage {
  leads: ApiLead[];
  users: ApiLeadUser[];
  profiles: { id: string; name: string; userId: string | null }[];
  pipelineStages: { id: string; name: string; orderIndex: number }[];
  currentUser: { id: string; name: string };
  totalPages: number;
}

// Compact "when" labels for activity lists: today / yesterday / Nd ago /
// Nw ago / Nmo ago.
function timeAgo(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((nowMs - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function DashboardTab() {
  const [leads, setLeads] = useState<ApiLead[]>([]);
  const [users, setUsers] = useState<ApiLeadUser[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string; userId: string | null }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; orderIndex: number }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [activeProfileCount, setActiveProfileCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Reference timestamp captured when the data loads — kept in state so the
  // snapshot windows (this week, stalled cutoff) are stable across re-renders.
  const [nowMs, setNowMs] = useState(0);

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

        // Active profile count for the stat card — only Admin + BD Manager
        // may read /api/profiles (Business Developers get 403 there, so this
        // fetch is skipped for them; their card counts their own profiles
        // from the scoped leads response instead).
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
  // App-facing role of the signed-in user ("admin" | "lead" | "bd"). The
  // leads API scopes BDs to their own leads, so the admin/manager view shows
  // the whole org and the BD view shows their own pipeline.
  const roleKey = users.find((u) => u.id === currentUser?.id)?.role ?? "bd";

  // Terminal / done stages: the last pipeline stage plus any accept/reject
  // stage. Everything else is an open lead.
  const doneStages = useMemo(() => {
    const last = stages.length > 0 ? stages[stages.length - 1].name : null;
    const terminal = stages
      .filter((s) => /accept|reject|declin/i.test(s.name))
      .map((s) => s.name);
    return [last, ...terminal].filter((n): n is string => Boolean(n));
  }, [stages]);

  const openLeads = useMemo(
    () => leads.filter((l) => !doneStages.includes(l.status)),
    [leads, doneStages],
  );

  // Pending-offer stages: named "offer" but not an accept/reject/closed one.
  const offerStages = useMemo(
    () => stages.filter((s) => /offer/i.test(s.name) && !/accept|reject|declin/i.test(s.name)).map((s) => s.name),
    [stages],
  );
  const offerLeads = useMemo(
    () => (offerStages.length > 0 ? leads.filter((l) => offerStages.includes(l.status)) : []),
    [leads, offerStages],
  );

  const now = new Date(nowMs);
  // "This week" = the Friday → Thursday business week (same rule as every
  // date filter in the app — see businessWeekStart in lib/date-window.ts).
  const weekStartMs = businessWeekStart(now).getTime();
  const weekEndMs = weekStartMs + 7 * 86_400_000 - 1;
  const newThisWeek = useMemo(
    () =>
      leads.filter((l) => {
        const t = new Date(l.appliedAt).getTime();
        return t >= weekStartMs && t <= weekEndMs;
      }).length,
    [leads, weekStartMs, weekEndMs],
  );
  const weekLabel = `${new Date(weekStartMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekEndMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  // Stalled: open, not waiting on an offer, applied STALL_DAYS+ ago. Oldest
  // first — the longest-stuck leads surface at the top.
  const stalledLeads = useMemo(() => {
    const cutoff = nowMs - STALL_DAYS * 86_400_000;
    return openLeads
      .filter((l) => !offerStages.includes(l.status) && new Date(l.appliedAt).getTime() <= cutoff)
      .sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime())
      .slice(0, 4);
  }, [openLeads, offerStages, nowMs]);

  const offerRows = useMemo(
    () => [...offerLeads].sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)).slice(0, 4),
    [offerLeads],
  );

  const hasAttention = offerRows.length > 0 || stalledLeads.length > 0;

  // BD leaderboard: new leads in the last 7 days, top 5.
  const teamWeek = useMemo(
    () =>
      bdUsers
        .map((u) => ({
          user: u,
          total: leads.filter((l) => {
            const t = new Date(l.appliedAt).getTime();
            return l.assignedTo === u.id && t >= weekStartMs && t <= weekEndMs;
          }).length,
        }))
        .filter((e) => e.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    [bdUsers, leads, weekStartMs, weekEndMs],
  );
  const teamMax = Math.max(...teamWeek.map((e) => e.total), 1);

  const recent = useMemo(
    () => [...leads].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)).slice(0, 6),
    [leads],
  );

  // Per-stage lead counts for the funnel — today's snapshot across the whole
  // pipeline (no date window; this is a dashboard, not an explorer).
  const stageCounts = useMemo(
    () => stages.map((s) => leads.filter((l) => l.status === s.name).length),
    [stages, leads],
  );

  const stageIndexOf = (status: string) => {
    const i = stages.findIndex((s) => s.name === status);
    return i < 0 ? 0 : i;
  };

  // BDs can't read the profiles API, so their profile KPI counts their own
  // profiles from the (scoped) leads response instead.
  const statsCards = [
    { label: "Open Leads", value: openLeads.length, sub: "in the pipeline" },
    roleKey === "bd"
      ? { label: "My Profiles", value: profiles.length, sub: "assigned to you" }
      : { label: "Active Profiles", value: activeProfileCount, sub: `of ${profiles.length} total` },
    { label: "Offers Out", value: offerLeads.length, sub: "waiting on decision" },
    { label: "New This Week", value: newThisWeek, sub: weekLabel },
  ];

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      <div className="p-6 space-y-6">
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statsCards.map((s, i) => (
                <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} delay={i * 60} />
              ))}
            </div>

            {/* Pipeline health + needs attention */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="gap-0 p-5 lg:col-span-2">
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Pipeline Health</div>
                  <div className="text-meta text-muted-foreground mb-4">Leads currently in each stage — today&apos;s snapshot</div>
                  {stageCounts.some((c) => c > 0) ? (
                    <FunnelChart stages={stages} counts={stageCounts} />
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">No leads yet</div>
                  )}
                </CardContent>
              </Card>

              {/* Needs attention */}
              <Card className="gap-0 p-5 flex flex-col">
                <CardContent className="p-0 flex-1">
                  <div className="text-sm font-semibold text-foreground mb-1">Needs Attention</div>
                  <div className="text-meta text-muted-foreground mb-4">Stalled leads and pending decisions</div>
                  {hasAttention ? (
                    <div className="flex flex-col gap-4">
                      {offerRows.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Offers waiting</span>
                            <span className="font-mono text-micro font-bold text-amber-500">{offerLeads.length}</span>
                          </div>
                          <div className="flex flex-col">
                            {offerRows.map((l) => (
                              <div key={l.id} className="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0">
                                <Avatar name={l.profileName} size={24} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-medium text-foreground truncate">{l.profileName}</div>
                                  <div className="text-meta text-muted-foreground truncate">{l.company}</div>
                                </div>
                                <span className="font-mono text-micro text-muted-foreground shrink-0">{timeAgo(l.appliedAt, nowMs)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {stalledLeads.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Stalled</span>
                            <span className="font-mono text-micro font-bold text-muted-foreground">{stalledLeads.length}</span>
                          </div>
                          <div className="flex flex-col">
                            {stalledLeads.map((l) => {
                              const days = Math.floor((nowMs - new Date(l.appliedAt).getTime()) / 86_400_000);
                              return (
                                <div key={l.id} className="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0">
                                  <Avatar name={l.profileName} size={24} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-foreground truncate">{l.profileName}</div>
                                    <div className="text-meta text-muted-foreground truncate">{l.status}</div>
                                  </div>
                                  <span className="font-mono text-micro text-amber-500 shrink-0">{days}d</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">All clear — no stalled leads or pending offers</div>
                  )}
                </CardContent>
                <div className="mt-4 pt-3 border-t border-border">
                  <Link href="/leads" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                    Open Leads →
                  </Link>
                </div>
              </Card>
            </div>

            {/* Team this week (admin/manager) + recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Team leaderboard — a manager/admin tool; BDs only see their
                  own data, so the widget is hidden for them. */}
              {roleKey !== "bd" && (
                <Card className="gap-0 p-5">
                  <CardContent className="p-0">
                    <div className="text-sm font-semibold text-foreground mb-1">Team This Week</div>
                    <div className="text-meta text-muted-foreground mb-4">New leads in the last 7 days</div>
                    {teamWeek.length > 0 ? (
                      <div className="flex flex-col">
                        {teamWeek.map((e, i) => {
                          const color = SERIES_PALETTE[i % SERIES_PALETTE.length];
                          const isSelf = e.user.id === currentUser?.id;
                          return (
                            <div key={e.user.id} className="flex items-center gap-3 py-2.75 border-b border-border last:border-b-0">
                              <span className="font-mono text-micro text-muted-foreground w-4 shrink-0">{i + 1}</span>
                              <Avatar name={e.user.name} size={26} />
                              <div className="min-w-0 flex-1">
                                <div className={cn("text-xs font-medium truncate", isSelf ? "text-primary" : "text-foreground")}>
                                  {e.user.name}
                                  {isSelf && <span className="text-meta text-muted-foreground font-normal"> · you</span>}
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${(e.total / teamMax) * 100}%`,
                                      background: color,
                                      animation: "chart-grow-x 0.6s ease-out backwards",
                                      animationDelay: `${i * 0.06}s`,
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="font-mono text-xs font-bold text-foreground shrink-0">{e.total}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-10 text-center text-sm text-muted-foreground">No new leads this week</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recent activity — BDs see only their own leads (the API
                  scopes them), so the card spans full width for them. */}
              <Card className={cn("gap-0 p-5", roleKey === "bd" && "lg:col-span-2")}>
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Recent Activity</div>
                  <div className="text-meta text-muted-foreground mb-4">
                    {roleKey === "bd" ? "Your latest leads" : "Latest leads across the pipeline"}
                  </div>
                  {recent.length > 0 ? (
                    <div className="flex flex-col">
                      {recent.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 py-2.75 border-b border-border last:border-b-0">
                          <Avatar name={l.profileName} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-foreground truncate">{l.profileName}</div>
                            <div className="text-meta text-muted-foreground truncate">{l.jobTitle} · {l.company}</div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                              <span className="size-1.5 rounded-full shrink-0" style={{ background: stageColor(stageIndexOf(l.status)) }} />
                              {l.status}
                            </span>
                            <span className="font-mono text-micro text-muted-foreground">{timeAgo(l.appliedAt, nowMs)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">No leads yet</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
