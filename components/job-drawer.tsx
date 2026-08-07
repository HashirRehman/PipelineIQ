import type { CSSProperties } from "react"
import { X } from "lucide-react"

import { LeadNotesPanel } from "@/components/leads/lead-notes-panel"

// Minimal shape — only profile.name is rendered; both the real discovery
// profile and any caller-supplied profile satisfy it.
type ActiveProfile = { name: string }
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
  return score >= 70 ? "#059669" : score >= 40 ? "#d97706" : "#ef4444"
}

function RelevanceMatch({ profile, job }: { profile: ActiveProfile; job: Job }) {
  const score = job.relevanceScore ?? 0
  const cvMatches = job.cvMatches ?? []
  const bestCv = cvMatches.length > 0
    ? cvMatches.reduce((best, cv) => (cv.relevanceScore > best.relevanceScore ? cv : best))
    : null

  if (cvMatches.length === 0) {
    return (
      <div className="p-3.5 px-4 bg-muted/30 rounded-lg border border-border mb-4">
        <div className="text-xs font-semibold text-foreground mb-1">
          Match with {profile.name}
        </div>
        <div className="text-xs text-muted-foreground">
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
    <div className="p-3.5 px-4 bg-muted/30 rounded-lg border border-border mb-4">
      <div className="text-xs font-semibold text-foreground mb-3">
        Match with {profile.name}
        {bestCv && <span className="font-normal text-muted-foreground"> · {bestCv.cvLabel}</span>}
      </div>
      <div className="flex items-center gap-4 mb-1">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor(score)}
            strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34}
            strokeDashoffset={arc(score)} transform="rotate(-90 40 40)" className="transition-[stroke-dashoffset] duration-500 ease-in-out" />
          <text x="40" y="44" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="700" className="font-mono">{job.relevanceScore ?? "–"}%</text>
        </svg>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Relevance score from the discovery engine</div>
        </div>
      </div>

      {cvMatches.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border">
          {cvMatches
            .slice()
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .map(cv => (
              <div key={cv.cvId} className="flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate text-xs text-foreground">
                  {cv.cvLabel}
                  {cv.isCurrentCv && <span className="ml-1.5 text-[10px] text-muted-foreground">(current)</span>}
                </span>
                <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden shrink-0">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${cv.relevanceScore}%`, background: scoreColor(cv.relevanceScore) }}
                  />
                </div>
                <span className="w-9 text-right font-mono text-xs font-semibold text-foreground shrink-0">
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
  activeProfile: ActiveProfile | null
  onApply?: (id: string) => void
  onMarkApplied?: (id: string) => void
  onDismiss?: (id: string, reason: string) => void
  showActions?: boolean
  // Lead-only: DiscoveryTab renders jobs that have no lead (and so no
  // note) behind them, so both stay optional.
  notes?: string
  onNotesSave?: (value: string) => void
  dismissReason?: string
  setDismissReason?: (r: string) => void
  dismissOpen?: boolean
  setDismissOpen?: (v: boolean) => void
}

export default function JobDrawer({
  job, onClose, activeProfile,
  onApply, onMarkApplied, onDismiss, showActions = true,
  notes, onNotesSave,
  dismissReason = "", setDismissReason, dismissOpen = false, setDismissOpen,
}: Props) {

  return (
    <Drawer open swipeDirection="right" showSwipeHandle onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent
        style={{ "--drawer-content-width": "580px" } as CSSProperties}
        className="rounded-none! border-border bg-card text-foreground"
      >
        {/* Header */}
        <div className="p-5 px-6 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground mb-1.5 mt-0">{job.title}</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{job.company}</span>
                <span className="text-border">·</span>
                <span className="text-xs text-muted-foreground">{job.location}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
            <Badge variant="secondary" className="px-2 py-0.75 rounded text-[11px] text-muted-foreground font-mono font-normal">
              {timeAgo(job.postedAt)}
            </Badge>
            {job.status === "applied" && (
              <TintedBadge color="#059669">Applied</TintedBadge>
            )}
            {job.status === "dismissed" && (
              <TintedBadge color="#ef4444">Dismissed</TintedBadge>
            )}
            {job.possiblyClosed && (
              <TintedBadge color="#d97706">Possibly Closed</TintedBadge>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2">
              {job.status === "new" && (
                <>
                  <Button onClick={() => onApply?.(job.id)}
                    className="flex-1 bg-primary text-white hover:opacity-90 text-xs font-semibold h-9 shadow-none">
                    Apply Now
                  </Button>
                  <Button variant="outline" onClick={() => onMarkApplied?.(job.id)}
                    className="flex-1 border-border text-foreground text-xs font-medium h-9 shadow-none">
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
                className="w-full p-2 bg-muted/40 border-border rounded-md text-foreground text-xs resize-none outline-none mb-2 focus:border-primary" />
              <div className="flex gap-2">
                <Button onClick={() => { if (dismissReason.trim()) { onDismiss?.(job.id, dismissReason); setDismissOpen(false) } }}
                  disabled={!dismissReason.trim()}
                  className={`px-3.5 h-8 text-xs font-semibold shadow-none ${dismissReason.trim() ? "bg-red-500 text-white hover:bg-red-600" : "bg-secondary text-muted-foreground"}`}>
                  Confirm Dismiss
                </Button>
                <Button variant="outline" onClick={() => setDismissOpen(false)} className="h-8 text-xs text-muted-foreground hover:text-foreground shadow-none">Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 px-6">
          {activeProfile && <RelevanceMatch profile={activeProfile} job={job} />}

          <div className="mb-5">
            <div className="text-xs font-semibold text-foreground mb-2.5">About the Role</div>
            <p className="text-xs text-foreground leading-relaxed m-0">{job.description}</p>
          </div>

          {notes !== undefined && onNotesSave && (
            <LeadNotesPanel key={job.id} notes={notes} onSave={onNotesSave} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
