import { Bookmark, Clock, MapPin } from "lucide-react"
import type { Job } from "@/components/job-drawer"
import { TintedBadge } from "@/components/tinted-badge"
import { PARSER_COLOR, WORK_TYPE_COLOR, scoreColor } from "@/lib/constants"
import { timeAgo } from "@/lib/format"

export function JobCard({
  job,
  onClick,
}: {
  job: Job
  onClick: () => void
}) {
  const score = job.relevanceScore ?? 0
  const scoreRingColor = scoreColor(score)
  const parserColor = PARSER_COLOR[job.parser] ?? "var(--status-slate)"
  const workColor = WORK_TYPE_COLOR[job.workType] ?? "var(--status-slate)"

  return (
    <div
      onClick={onClick}
      className="group flex flex-col rounded-xl border bg-card p-4 cursor-pointer shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {job.title}
            </h3>
            {job.status === "applied" && <TintedBadge color="var(--status-green)">Applied</TintedBadge>}
            {job.status === "dismissed" && <TintedBadge color="var(--status-red)">Dismissed</TintedBadge>}
            {job.isLead && <TintedBadge color="var(--brand-sky)">In Leads</TintedBadge>}
            {job.possiblyClosed && <TintedBadge color="var(--status-amber)">Possibly Closed</TintedBadge>}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{job.company}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />{job.location}
            </span>
            <TintedBadge color={workColor}>{job.workType}</TintedBadge>
            <TintedBadge color={parserColor}>{job.parser}</TintedBadge>
          </div>
        </div>

        {/* Score ring */}
        {score > 0 && (
          <div className="shrink-0 text-center">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16" fill="none" stroke={scoreRingColor} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                strokeDashoffset={2 * Math.PI * 16 * (1 - score / 100)}
                transform="rotate(-90 20 20)"
              />
              <text x="20" y="24" textAnchor="middle" fill="currentColor" style={{ fontSize: "var(--text-micro)", fontWeight: 700 }}>{score}</text>
            </svg>
          </div>
        )}
      </div>

      {/* Footer: save (disabled) + time */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
        <button
          type="button"
          disabled
          title="Save (coming soon)"
          aria-label="Save job (coming soon)"
          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed"
        >
          <Bookmark className="size-3.5" />
        </button>
        <span className="flex items-center gap-1 text-meta text-muted-foreground">
          {/* Applied jobs are dated by when they were applied; the discovery
              feed has no appliedAt and falls back to the posting date. */}
          <Clock className="size-3" />{timeAgo(job.appliedAt ?? job.postedAt)}
        </span>
      </div>
    </div>
  )
}
