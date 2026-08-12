"use client";

import { Clock, MapPin } from "lucide-react";
import type { Job } from "@/components/job-drawer";
import { TintedBadge } from "@/components/tinted-badge";
import { WORK_TYPE_COLOR, scoreColor } from "@/lib/constants";
import { timeAgo } from "@/lib/format";

// Table-style list view for the job list pages (Pipeline, Discovery) — the
// default view. One row per job; clicking a row opens the same job drawer as
// the cards view. Only renders what the server already returned — no
// client-side filtering, sorting, or pagination here.
export function JobListView({
  jobs,
  onClick,
}: {
  jobs: Job[];
  onClick: (job: Job) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Job
            </th>
            <th className="hidden px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
              Work Type
            </th>
            <th className="hidden px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
              Parser
            </th>
            <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Score
            </th>
            <th className="px-4 py-3 text-right text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {jobs.map((job) => {
            const score = job.relevanceScore ?? 0;
            // Parser = the scraper that fetched the job (e.g. Jsearch), from
            // the scrapers table — a neutral badge, no hardcoded name→color map.
            const parserColor = "var(--status-slate)";
            const workColor = WORK_TYPE_COLOR[job.workType] ?? "var(--status-slate)";
            return (
              <tr
                key={job.id}
                onClick={() => onClick(job)}
                className="group cursor-pointer bg-background transition-colors hover:bg-accent/40"
              >
                {/* Job: title + status badges + company · location */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {job.title}
                    </p>
                    {job.status === "applied" && (
                      <TintedBadge color="var(--status-green)">Applied</TintedBadge>
                    )}
                    {job.status === "dismissed" && (
                      <TintedBadge color="var(--status-red)">Dismissed</TintedBadge>
                    )}
                    {job.isLead && <TintedBadge color="var(--brand-sky)">In Leads</TintedBadge>}
                    {job.possiblyClosed && (
                      <TintedBadge color="var(--status-amber)">Possibly Closed</TintedBadge>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{job.company}</span>
                    <span className="text-border">·</span>
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </span>
                  </p>
                </td>

                {/* Work type */}
                <td className="hidden px-4 py-3 md:table-cell">
                  <TintedBadge color={workColor}>{job.workType}</TintedBadge>
                </td>

                {/* Parser */}
                <td className="hidden px-4 py-3 md:table-cell">
                  <TintedBadge color={parserColor}>{job.parser}</TintedBadge>
                </td>

                {/* Relevance score */}
                <td className="px-4 py-3">
                  {score > 0 ? (
                    <span
                      className="inline-flex min-w-9 items-center justify-center rounded-md px-2 py-0.5 font-mono text-meta font-semibold tabular-nums"
                      style={{
                        background: `color-mix(in srgb, ${scoreColor(score)} 9%, transparent)`,
                        color: scoreColor(score),
                      }}
                    >
                      {score}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </td>

                {/* Date — applied jobs are dated by when they were applied;
                    the discovery feed has no appliedAt and falls back to the
                    posting date (same rule as the cards view). */}
                <td className="px-4 py-3 text-right">
                  <span className="flex items-center justify-end gap-1 whitespace-nowrap text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {timeAgo(job.appliedAt ?? job.postedAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
