import { useEffect, useState } from "react"
import { Bookmark, X } from "lucide-react"

import { Avatar } from "@/components/avatar"
import { LeadNotesPanel } from "@/components/leads/lead-notes-panel"

// Minimal shape — only profile.name is rendered; both the real discovery
// profile and any caller-supplied profile satisfy it.
type ActiveProfile = { name: string }
import { TintedBadge } from "@/components/tinted-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { scoreColor } from "@/lib/constants"
import { createClient } from "@/lib/supabase/client"
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
          <text x="40" y="44" textAnchor="middle" fill="currentColor" style={{ fontSize: "var(--text-sm)" }} fontWeight="700" className="font-mono">{job.relevanceScore ?? "–"}%</text>
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
                  {cv.isCurrentCv && <span className="ml-1.5 text-caption text-muted-foreground">(current)</span>}
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

type DescBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }

const BULLET_RE = /^[•·*\-–]\s*/

function isHeading(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  if (/[.!?]$/.test(trimmed)) return false
  if (trimmed.length > 60) return false
  if (trimmed.endsWith(":") || trimmed.endsWith("：")) return true
  if (/,/.test(trimmed)) return false
  const words = trimmed.split(/\s+/)
  const titleCase = words.every(w => /^[A-Z0-9(&]/.test(w))
  const allCaps = /[A-Z]{2}/.test(trimmed) && trimmed === trimmed.toUpperCase()
  return titleCase || allCaps
}

function parseDescription(text: string): DescBlock[] {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)

  const blocks: DescBlock[] = []
  const pushList = (item: string) => {
    const prev = blocks[blocks.length - 1]
    if (prev && prev.type === "list") {
      prev.items.push(item)
    } else {
      blocks.push({ type: "list", items: [item] })
    }
  }
  const pushHeading = (heading: string) => {
    const prev = blocks[blocks.length - 1]
    const normalized = heading.replace(/[：:]$/, "").trim().toLowerCase()
    const prevNormalized = prev?.type === "heading"
      ? prev.text.replace(/[：:]$/, "").trim().toLowerCase()
      : ""
    if (!(prev?.type === "heading" && prevNormalized === normalized)) {
      blocks.push({ type: "heading", text: heading })
    }
  }

  for (const line of lines) {
    if (BULLET_RE.test(line)) {
      pushList(line.replace(BULLET_RE, ""))
      continue
    }

    const glued = line.match(/^(.{1,60}?)[：:]•\s*(.+)$/)
    if (glued) {
      pushHeading(glued[1].trim())
      pushList(glued[2].trim())
      continue
    }

    if (isHeading(line)) {
      pushHeading(line)
      continue
    }

    blocks.push({ type: "paragraph", text: line })
  }

  return blocks
}

function FormattedDescription({ text }: { text: string }) {
  const blocks = parseDescription(text)

  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <div key={i} className="text-xs font-semibold text-foreground">
                {block.text}
              </div>
            )
          case "paragraph":
            return (
              <p key={i} className="text-xs text-foreground leading-relaxed m-0">
                {block.text}
              </p>
            )
          case "list":
            return (
              <ul key={i} className="flex flex-col gap-1.5 m-0 pl-0 list-none">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
                    <span className="mt-[6px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
}

interface Props {
  job: Job | null
  onClose: () => void
  open: boolean
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
  job, onClose, open, activeProfile,
  onApply, onMarkApplied, onDismiss, showActions = true,
  notes, onNotesSave,
  dismissReason = "", setDismissReason, dismissOpen = false, setDismissOpen,
}: Props) {
  const [lastJob, setLastJob] = useState<Job | null>(job)
  const [lastNotes, setLastNotes] = useState(notes)
  const [prevJob, setPrevJob] = useState<Job | null>(job)
  const [prevNotes, setPrevNotes] = useState(notes)
  const [userName, setUserName] = useState("")

  useEffect(() => {
    let cancelled = false
    const client = createClient()
    client.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const meta = data?.user?.user_metadata as Record<string, unknown> | undefined
      const name =
        (typeof meta?.full_name === "string" ? meta.full_name : null) ??
        data?.user?.email?.split("@")[0] ??
        ""
      setUserName(name)
    })
    return () => { cancelled = true }
  }, [])

  if (job !== prevJob) {
    setPrevJob(job)
    if (job) setLastJob(job)
  }
  if (notes !== prevNotes) {
    setPrevNotes(notes)
    if (notes !== undefined) setLastNotes(notes)
  }

  const displayJob = job ?? lastJob
  const displayNotes = notes ?? lastNotes
  const hasNotes = displayNotes !== undefined && onNotesSave !== undefined

  if (!displayJob) return null

  return (
    <Drawer direction="right" open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DrawerContent
        className="!w-full !max-w-none sm:!w-[880px] sm:!max-w-[880px] rounded-none! border-border bg-card text-foreground"
      >
        {/* Top bar */}
        <div className="flex items-center justify-end gap-2 px-5 py-2.5 border-b border-border bg-card shrink-0">
          <button
            type="button"
            disabled
            title="Save (coming soon)"
            aria-label="Save job (coming soon)"
            className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground opacity-50 cursor-not-allowed"
          >
            <Bookmark className="size-3.5" />
          </button>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column — white */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-card px-8 py-6">
            <h2 className="text-lg font-bold text-foreground mb-1.5 mt-0">{displayJob.title}</h2>
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              <span className="text-sm font-semibold text-foreground">{displayJob.company}</span>
              <span className="text-border">·</span>
              <span className="text-xs text-muted-foreground">{displayJob.location}</span>
            </div>

            {showActions && (
              <div className="flex gap-2 mb-4">
                {displayJob.status === "new" && (
                  <>
                    <Button onClick={() => onApply?.(displayJob.id)}
                      className="flex-1 bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold h-9 shadow-none">
                      Apply Now
                    </Button>
                    <Button variant="outline" onClick={() => onMarkApplied?.(displayJob.id)}
                      className="flex-1 border-border text-foreground text-xs font-medium h-9 shadow-none">
                      Mark Applied
                    </Button>
                    <Button variant="outline" onClick={() => setDismissOpen?.(!dismissOpen)}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-9 shadow-none">
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            )}

            {dismissOpen && setDismissReason && setDismissOpen && (
              <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-[7px]">
                <Textarea rows={2} placeholder="Reason for dismissal (required)…" value={dismissReason} onChange={e => setDismissReason(e.target.value)}
                  className="w-full p-2 bg-muted/40 border-border rounded-md text-foreground text-xs resize-none outline-none mb-2 focus:border-primary" />
                <div className="flex gap-2">
                  <Button onClick={() => { if (dismissReason.trim()) { onDismiss?.(displayJob.id, dismissReason); setDismissOpen(false) } }}
                    disabled={!dismissReason.trim()}
                    className={`px-3.5 h-8 text-xs font-semibold shadow-none ${dismissReason.trim() ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-secondary text-muted-foreground"}`}>
                    Confirm Dismiss
                  </Button>
                  <Button variant="outline" onClick={() => setDismissOpen(false)} className="h-8 text-xs text-muted-foreground hover:text-foreground shadow-none">Cancel</Button>
                </div>
              </div>
            )}

            {activeProfile && <RelevanceMatch profile={activeProfile} job={displayJob} />}

            <div className="mb-5">
              <div className="text-xs font-semibold text-foreground mb-2.5">About the Role</div>
              <FormattedDescription text={displayJob.description} />
            </div>

            {hasNotes && (
              <div className="mb-5">
                <LeadNotesPanel key={displayJob.id} notes={displayNotes} onSave={onNotesSave!} />
              </div>
            )}

            {/* Comments — disabled, not implemented yet */}
            <div className="pt-4 border-t border-border">
              <div className="text-xs font-semibold text-foreground mb-2.5">Comments</div>
              <div className="flex items-center gap-2 mb-3">
                <Avatar name={userName || "You"} size={26} />
                <Textarea
                  disabled
                  rows={2}
                  placeholder="Add a comment…"
                  className="flex-1 w-full p-2 bg-muted/40 border-border rounded-md text-foreground text-xs resize-none outline-none disabled:opacity-50"
                />
              </div>
              <p className="text-meta text-muted-foreground">
                Comments are coming soon — team members will be able to discuss this job here.
              </p>
            </div>
          </div>

          {/* Right column — page content background */}
          <aside className="w-[260px] shrink-0 border-l border-border bg-page-bg overflow-y-auto px-6 py-6">
            <div className="text-xs font-semibold text-foreground mb-4">Details</div>

            <dl className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Work Type</dt>
                <dd className="text-xs text-foreground capitalize">
                  {displayJob.workType}
                  {displayJob.workType === "remote" && displayJob.remoteRegion
                    ? ` — ${displayJob.remoteRegion}`
                    : null}
                </dd>
              </div>

              {displayJob.possiblyClosed && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Flag</dt>
                  <dd>
                    <TintedBadge color="var(--status-amber)" className="px-2.5 py-1 rounded-full">Possibly Closed</TintedBadge>
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Source</dt>
                <dd className="text-xs text-foreground">{displayJob.parser}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Posted</dt>
                <dd className="text-xs text-foreground font-mono">{timeAgo(displayJob.postedAt)}</dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Location</dt>
                <dd className="text-xs text-foreground text-right">{displayJob.location}</dd>
              </div>

              {displayJob.applyUrl && (
                <>
                  <div className="my-2 border-t border-border" />
                  <div className="flex flex-col gap-1">
                    <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Apply URL</dt>
                    <dd>
                      <a
                        href={displayJob.applyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {displayJob.applyUrl}
                      </a>
                    </dd>
                  </div>
                </>
              )}

              {displayJob.dismissReason && (
                <div className="flex flex-col gap-1">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Dismiss Reason</dt>
                  <dd className="text-xs text-foreground leading-relaxed">{displayJob.dismissReason}</dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
