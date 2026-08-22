"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Briefcase, Info, TrendingUp, Users2 } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { FunnelChart } from "@/components/charts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/tooltip";
import { SERIES_PALETTE } from "@/lib/constants";
import { businessWeekStart } from "@/lib/date-window";
import { useAllLeads } from "@/hooks/use-all-leads";
import { useApplications } from "@/hooks/use-applications";
import { cn } from "@/lib/utils";

const STALL_DAYS = 4;

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

// Shared row shape for the offers/stalled/recent-activity lists below —
// avatar + truncated title/subtitle + a trailing slot for whatever each
// list needs to show (a relative time, a day count, a status dot). The team
// leaderboard row isn't included here — its rank number + progress bar is a
// different shape, not a variant of this one.
function ActivityRow({
  avatarName,
  avatarSize = 24,
  title,
  subtitle,
  trailing,
  className,
}: {
  avatarName: string;
  avatarSize?: number;
  title: string;
  subtitle: string;
  trailing: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-2 border-b border-border last:border-b-0 rounded-md px-1.5 -mx-1.5 transition-colors duration-150 hover:bg-accent/60",
        className,
      )}
    >
      <Avatar name={avatarName} size={avatarSize} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground truncate">{title}</div>
        <div className="text-meta text-muted-foreground truncate">{subtitle}</div>
      </div>
      <span className="shrink-0">{trailing}</span>
    </div>
  );
}

export default function DashboardTab() {
  const {
    leads,
    users,
    profiles,
    stages,
    currentUser,
    roleKey,
    activeProfileCount,
    isPending,
    error,
  } = useAllLeads();
  // Reference timestamp captured when the component mounts — kept in state so
  // the snapshot windows (this week, stalled cutoff) are stable across re-renders.
  const [nowMs] = useState(() => Date.now());

  const bdUsers = users.filter((u) => u.role === "bd" || u.role === "lead");

  // Applied-jobs stats: every applied (job, profile) pair in scope.
  const { data: appsData } = useApplications();
  const applications = useMemo(() => appsData?.applications ?? [], [appsData]);

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
  // Applications this business week — the same window as "New This Week".
  const appsThisWeek = useMemo(
    () =>
      applications.filter((a) => {
        const t = new Date(a.appliedAt).getTime();
        return t >= weekStartMs && t <= weekEndMs;
      }).length,
    [applications, weekStartMs, weekEndMs],
  );
  const weekLabel = `${new Date(weekStartMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(weekEndMs).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  // Stalled: open, not waiting on an offer, with no activity (status change,
  // note, etc.) in STALL_DAYS — using updatedAt rather than appliedAt so a
  // lead that's actively being worked doesn't read as stalled just because
  // it applied a while ago. Oldest first — the longest-stuck leads surface
  // at the top. Unbounded — the card scrolls once it can't fit them all.
  const stalledLeads = useMemo(() => {
    const cutoff = nowMs - STALL_DAYS * 86_400_000;
    return openLeads
      .filter((l) => !offerStages.includes(l.status) && new Date(l.updatedAt).getTime() <= cutoff)
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }, [openLeads, offerStages, nowMs]);

  const offerRows = useMemo(
    () => [...offerLeads].sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)),
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

  // Per-stage lead counts for the funnel — today's snapshot across the whole
  // pipeline (no date window; this is a dashboard, not an explorer).
  const stageCounts = useMemo(
    () => stages.map((s) => leads.filter((l) => l.status === s.name).length),
    [stages, leads],
  );

  // BDs can't read the profiles API, so their profile KPI counts their own
  // profiles from the (scoped) leads response instead.
  const statsCards = [
    { label: "Active Leads", value: openLeads.length, sub: "not yet closed", icon: Briefcase, accent: "var(--brand-blue)" },
    roleKey === "bd"
      ? { label: "My Profiles", value: profiles.length, sub: "assigned to you", icon: Users2, accent: "var(--status-slate)" }
      : { label: "Active Profiles", value: activeProfileCount, sub: `of ${profiles.length} total`, icon: Users2, accent: "var(--status-slate)" },
    { label: "New Leads This Week", value: newThisWeek, sub: weekLabel, icon: ArrowUpRight, accent: "var(--status-emerald)" },
    { label: "Applied This Week", value: appsThisWeek, sub: "job applications", icon: TrendingUp, accent: "var(--status-amber-500)" },
  ];

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      <div className="p-6 space-y-6">
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load dashboard
          </div>
        ) : isPending ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-2.5 w-3/4" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-32 w-full" />
              </div>
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statsCards.map((s, i) => (
                <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} icon={s.icon} accent={s.accent} delay={i * 60} />
              ))}
            </div>

            {/* Needs attention + pipeline health — attention leads since it's
                the primary action surface; pipeline health is context. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Needs attention */}
              <Card
                className={cn(
                  "gap-0 p-5 flex flex-col lg:col-span-1 transition-shadow duration-200",
                  hasAttention && "ring-1 ring-amber-500/20 border-amber-500/30",
                )}
                style={{
                  animation: "chart-rise 0.35s ease-out backwards",
                  animationDelay: "240ms",
                }}
              >
                <CardContent className="p-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="flex size-6 items-center justify-center rounded-md"
                      style={{ background: hasAttention ? "color-mix(in srgb, var(--status-amber-500) 15%, transparent)" : "color-mix(in srgb, var(--status-slate) 12%, transparent)" }}
                    >
                      <AlertTriangle className="size-3.5" style={{ color: hasAttention ? "var(--status-amber-500)" : "var(--status-slate)" }} strokeWidth={2} />
                    </span>
                    <span className="text-sm font-semibold text-foreground">Needs Attention</span>
                    <Tooltip
                      content={`Shows leads waiting on decisions (pending offers) and stalled leads (no activity for ${STALL_DAYS}+ days)`}
                      side="top"
                    >
                      <button className="p-0 hover:text-primary transition-colors">
                        <Info className="size-4" />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="text-meta text-muted-foreground mb-4">Stalled leads and pending decisions</div>
                  {hasAttention ? (
                    <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
                      {offerRows.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">Offers waiting</span>
                            <span className="font-mono text-micro font-bold text-amber-500">{offerLeads.length}</span>
                          </div>
                          <div className="flex flex-col">
                            {offerRows.map((l) => (
                              <ActivityRow
                                key={l.id}
                                avatarName={l.profileName}
                                title={l.profileName}
                                subtitle={l.company}
                                trailing={<span className="font-mono text-micro text-muted-foreground">{timeAgo(l.appliedAt, nowMs)}</span>}
                              />
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
                              const days = Math.floor((nowMs - new Date(l.updatedAt).getTime()) / 86_400_000);
                              return (
                                <ActivityRow
                                  key={l.id}
                                  avatarName={l.profileName}
                                  title={l.profileName}
                                  subtitle={l.status}
                                  trailing={<span className="font-mono text-micro text-amber-500">{days}d</span>}
                                />
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
                    Active Leads →
                  </Link>
                </div>
              </Card>

              <Card
                className="gap-0 p-5 lg:col-span-2 overflow-visible"
                style={{
                  animation: "chart-rise 0.35s ease-out backwards",
                  animationDelay: "300ms",
                }}
              >
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Leads Health</div>
                  <div className="text-meta text-muted-foreground mb-4">Leads currently in each stage — today&apos;s snapshot</div>
                  {stageCounts.some((c) => c > 0) ? (
                    <FunnelChart stages={stages} counts={stageCounts} maxVisible={8} />
                  ) : (
                    <div className="py-10 text-center text-sm text-muted-foreground">No leads yet</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Team leaderboard — a manager/admin tool; BDs only see their
                own data, so the widget is hidden for them. */}
            {roleKey !== "bd" && (
              <Card
                className="gap-0 p-5"
                style={{ animation: "chart-rise 0.35s ease-out backwards", animationDelay: "360ms" }}
              >
                <CardContent className="p-0">
                  <div className="text-sm font-semibold text-foreground mb-1">Team This Week</div>
                  <div className="text-meta text-muted-foreground mb-4">New leads in the last 7 days</div>
                  {teamWeek.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                      {teamWeek.map((e, i) => {
                        const color = SERIES_PALETTE[i % SERIES_PALETTE.length];
                        const isSelf = e.user.id === currentUser?.id;
                        return (
                          <div key={e.user.id} className="flex items-center gap-3 py-2.75 border-b border-border last:border-b-0 rounded-md px-1.5 -mx-1.5 transition-colors duration-150 hover:bg-accent/60">
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
          </>
        )}
      </div>
    </div>
  );
}
