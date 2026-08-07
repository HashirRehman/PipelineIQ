import type { CSSProperties } from "react"
import { X } from "lucide-react"

import type { Profile } from "@/app/page"
import { TintedBadge } from "@/components/tinted-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { PARSER_COLOR, WORK_TYPE_COLOR } from "@/lib/constants"
import { timeAgo } from "@/lib/format"

export interface CvMatch {
  matchId: string
  cvId: string
  cvLabel: string
  isCurrentCv: boolean
  relevanceScore: number
  status: "new" | "applied" | "dismissed"
  dismissReason?: string
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  workType: "remote" | "onsite"
  postedAt: string
  applyUrl: string
  parser: string
  status: "new" | "applied" | "dismissed"
  dismissReason?: string
  description: string
  relevanceScore?: number
  cvMatches?: CvMatch[]
  possiblyClosed?: boolean | null
  remoteRegion?: string | null
}


function scoreColor(score: number) {
  return score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"
}

function RelevanceMatch({ profile, job }: { profile: Profile; job: Job }) {
  const score = job.relevanceScore ?? 0
  const cvMatches = job.cvMatches ?? []
  const bestCv = cvMatches.length > 0
    ? cvMatches.reduce((best, cv) => (cv.relevanceScore > best.relevanceScore ? cv : best))
    : null

  if (cvMatches.length === 0) {
    return (
      <div className="p-3.5 px-4 bg-[var(--muted)] rounded-lg border border-[var(--border)] mb-4">
        <div className="text-xs font-semibold text-[var(--fg)] mb-1">
          Match with {profile.name}
        </div>
        <div className="text-xs text-[var(--muted-fg)]">
          No match yet — this job hasn&apos;t been scored against this profile&apos;s CVs.
        </div>
      </div>
    )
  }

  const arc = (pct: number, r = 34) => {
    const circumference = 2 * Math.PI * r
    return circumference - (pct / 100) * circumference
  }

  return (
    <div className="p-3.5 px-4 bg-[var(--muted)] rounded-lg border border-[var(--border)] mb-4">
      <div className="text-xs font-semibold text-[var(--fg)] mb-3">
        Match with {profile.name}
        {bestCv && <span className="font-normal text-[var(--muted-fg)]"> · {bestCv.cvLabel}</span>}
      </div>
      <div className="flex items-center gap-4 mb-1">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor(score)}
            strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34}
            strokeDashoffset={arc(score)} transform="rotate(-90 40 40)" className="transition-[stroke-dashoffset] duration-500 ease-in-out" />
          <text x="40" y="44" textAnchor="middle" fill="var(--fg)" fontSize="14" fontWeight="700" className="font-mono">{job.relevanceScore ?? "–"}%</text>
        </svg>
        <div className="flex-1">
          <div className="text-xs text-[var(--muted-fg)]">Relevance score from the discovery engine</div>
        </div>
      </div>

      {cvMatches.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-[var(--border)]">
          {cvMatches
            .slice()
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .map(cv => (
              <div key={cv.cvId} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--fg)]">
                  {cv.cvLabel}
                  {cv.isCurrentCv && <span className="ml-1.5 text-[10px] text-[var(--muted-fg)]">(current)</span>}
                </span>
                <div className="w-24 h-1.5 rounded-full bg-[var(--border)] overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${cv.relevanceScore}%`, background: scoreColor(cv.relevanceScore) }}
                  />
                </div>
                <span className="w-9 text-right font-mono text-xs font-semibold text-[var(--fg)] shrink-0">
                  {cv.relevanceScore}%
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  job: Job
  onClose: () => void
  activeProfile: Profile | null
  onApply?: (id: string) => void
  onMarkApplied?: (id: string) => void
  onDismiss?: (id: string, reason: string) => void
  showActions?: boolean
  dismissReason?: string
  setDismissReason?: (r: string) => void
  dismissOpen?: boolean
  setDismissOpen?: (v: boolean) => void
}

export default function JobDrawer({
  job, onClose, activeProfile,
  onApply, onMarkApplied, onDismiss, showActions = true,
  dismissReason = "", setDismissReason, dismissOpen = false, setDismissOpen,
}: Props) {

  return (
    <Drawer open swipeDirection="right" showSwipeHandle onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent
        style={{ "--drawer-content-width": "580px" } as CSSProperties}
        className="rounded-none! border-[var(--border)] bg-[var(--card)] text-[var(--fg)]"
      >
        {/* Header */}
        <div className="p-5 px-6 border-b border-[var(--border)] shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--fg)] mb-1.5 mt-0">{job.title}</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-[var(--fg)]">{job.company}</span>
                <span className="text-[var(--border-strong)]">·</span>
                <span className="text-xs text-[var(--muted-fg)]">{job.location}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-[var(--muted-fg)] hover:text-[var(--fg)]">
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <TintedBadge color={WORK_TYPE_COLOR[job.workType]} className="px-2 py-0.75">
              {job.workType}
              {job.workType === "remote" && job.remoteRegion
                ? ` — ${job.remoteRegion}`
                : null}
            </TintedBadge>
            <TintedBadge color={PARSER_COLOR[job.parser] || "#64748b"} className="px-2 py-0.75">
              via {job.parser}
            </TintedBadge>
            <Badge variant="secondary" className="px-2 py-0.75 rounded text-[11px] text-[var(--muted-fg)] font-mono font-normal">
              {timeAgo(job.postedAt)}
            </Badge>
            {job.possiblyClosed && (
              <Badge variant="secondary" className="px-2 py-0.75 rounded text-[11px] text-amber-600 font-mono font-normal">
                Possibly Closed
              </Badge>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2">
              {job.status === "new" && (
                <>
                  <Button onClick={() => onApply?.(job.id)}
                    className="flex-1 bg-[var(--primary)] text-white hover:opacity-90 text-xs font-semibold h-9 shadow-none">
                    Apply Now
                  </Button>
                  <Button variant="outline" onClick={() => onMarkApplied?.(job.id)}
                    className="flex-1 border-[var(--border-strong)] text-[var(--fg)] text-xs font-medium h-9 shadow-none">
                    Mark Applied
                  </Button>
                  <Button variant="outline" onClick={() => setDismissOpen?.(!dismissOpen)}
                    className="border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs h-9 shadow-none">
                    Dismiss
                  </Button>
                </>
              )}
            </div>
          )}

          {dismissOpen && setDismissReason && setDismissOpen && (
            <div className="mt-2.5 p-3 bg-red-500/5 border border-red-500/20 rounded-[7px]">
              <Textarea rows={2} placeholder="Reason for dismissal (required)…" value={dismissReason} onChange={e => setDismissReason(e.target.value)}
                className="w-full p-2 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-none outline-none mb-2 focus:border-[var(--primary)]" />
              <div className="flex gap-2">
                <Button onClick={() => { if (dismissReason.trim()) { onDismiss?.(job.id, dismissReason); setDismissOpen(false) } }}
                  disabled={!dismissReason.trim()}
                  className={`px-3.5 h-8 text-xs font-semibold shadow-none ${dismissReason.trim() ? "bg-red-500 text-white hover:bg-red-600" : "bg-[var(--secondary)] text-[var(--muted-fg)]"}`}>
                  Confirm Dismiss
                </Button>
                <Button variant="outline" onClick={() => setDismissOpen(false)} className="h-8 text-xs text-[var(--muted-fg)] hover:text-[var(--fg)] shadow-none">Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 px-6">
          {activeProfile && <RelevanceMatch profile={activeProfile} job={job} />}

          <div className="mb-5">
            <div className="text-xs font-semibold text-[var(--fg)] mb-2.5">About the Role</div>
            <p className="text-xs text-[var(--fg)] leading-relaxed m-0">{job.description}</p>
          </div>

        </div>
      </DrawerContent>
    </Drawer>
  )
}
