import { useRef, useState } from "react"
import { Bookmark, Loader2, X } from "lucide-react"

import { InlineEditBlock } from "@/components/inline-edit-block"
import { InlineEditField } from "@/components/inline-edit-field"
import { JobComments } from "@/components/job-comments"
import { LeadNotesPanel } from "@/components/leads/lead-notes-panel"
import { LeadStatusSelect, type StageOption } from "@/components/leads/lead-status-select"
import { COUNTRY_OPTIONS } from "@/components/ui/country-combobox"
import { parseDescription, type DescBlock } from "@/lib/job-description"

// Minimal shape — only profile.name is rendered; both the real discovery
// profile and any caller-supplied profile satisfy it.
type ActiveProfile = { name: string }

// jobs.is_remote is a boolean, so the editor offers exactly the two states
// the column can hold.
const WORK_TYPE_EDIT_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Onsite" },
] as const
import { TintedBadge } from "@/components/tinted-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { scoreColor, type EngagementType } from "@/lib/constants"
import { formatDate, timeAgo } from "@/lib/format"

export interface CvMatch {
  matchId: string
  /** The assigned profile whose CV produced this match — labeled next to
   * each CV row so multi-profile users can tell the matches apart. */
  profileId: string
  profileName: string
  cvId: string
  cvLabel: string
  isCurrentCv: boolean
  relevanceScore: number
  status: "new" | "applied" | "dismissed"
  dismissReason?: string
}

export interface JobProfileState {
  profileId: string
  profileName: string
  status: "new" | "applied" | "dismissed"
  isLead: boolean
  /** When this profile applied — null unless the pair is applied. */
  appliedAt?: string | null
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  workType: "remote" | "onsite"
  postedAt: string
  /** When the job was applied (most recent applied pair) — set on the
   * applied feed so cards and sorting reflect the application time, not the
   * posting time. */
  appliedAt?: string | null
  applyUrl: string
  parser: string
  status: "new" | "applied" | "dismissed"
  dismissReason?: string
  /** Lead pipeline stage — set by the Leads drawer; absent on plain jobs. */
  stage?: string | null
  description: string
  relevanceScore?: number
  cvMatches?: CvMatch[]
  possiblyClosed?: boolean | null
  remoteRegion?: string | null
  /** How the job reached us; null/absent on scraped jobs. */
  engagementType?: EngagementType | null
  /** True when this (job, profile) pair already has a live lead. */
  isLead?: boolean
  /** Per-profile state for every profile assigned to the acting user — a job
   * can be new for one profile while applied/dismissed for another, so the
   * action buttons target a subset of these. */
  profiles: JobProfileState[]
  parsedData?: {
    skills?: string[]
    technologies?: string[]
    experienceYears?: number | null
    salaryRange?: string | null
    /** Manual / imported extras — set by the Pipeline "New Job" and Import
     * flows; absent on AI-enriched rows. */
    budget?: string | null
    source?: string | null
    developer?: string | null
  } | null
}


function RelevanceMatch({ profiles, job }: { profiles: ActiveProfile[]; job: Job }) {
  const score = job.relevanceScore ?? 0
  const cvMatches = job.cvMatches ?? []
  const bestCv = cvMatches.length > 0
    ? cvMatches.reduce((best, cv) => (cv.relevanceScore > best.relevanceScore ? cv : best))
    : null

  if (cvMatches.length === 0) {
    return (
      <div className="p-3.5 px-4 bg-muted/30 rounded-lg border border-border mb-4">
        <div className="text-xs font-semibold text-foreground mb-1">
          {profiles.length <= 1
            ? `Match with ${profiles[0]?.name ?? "profile"}`
            : `Matches across ${profiles.length} profiles`}
        </div>
        <div className="text-xs text-muted-foreground">
          No match yet. This job hasn&apos;t been scored against{" "}
          {profiles.length <= 1 ? "this profile" : "these profiles"}
          &apos; CVs.
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
        {profiles.length <= 1
          ? `Match with ${profiles[0]?.name ?? "profile"}`
          : `Matches across ${profiles.length} profiles`}
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
                  {cv.profileName && (
                    <span className="ml-1.5 text-caption text-muted-foreground">· {cv.profileName}</span>
                  )}
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

// "Which profile, or all?" — rendered whenever the acting user has two or
// more assigned profiles and an action still has profiles it can target,
// even if only one remains (the picker is gated on assigned count, not
// actionable count, per the product rule). Every assigned profile is listed;
// the ones the action can't target are disabled with a hint. Defaults to all
// targetable profiles.
function ActionProfilePicker({
  profiles,
  actionableIds,
  actionLabel,
  pending = false,
  onConfirm,
  onCancel,
}: {
  profiles: JobProfileState[]
  actionableIds: Set<string>
  actionLabel: string
  pending?: boolean
  onConfirm: (profileIds: string[]) => void
  onCancel: () => void
}) {
  const actionable = profiles.filter((p) => actionableIds.has(p.profileId))
  const [selected, setSelected] = useState<string | "all">("all")

  return (
    <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-foreground mb-2">
        {actionLabel} for which profile?
      </p>
      <div className="flex flex-col gap-1">
        <label
          className={`flex items-center gap-2 text-xs text-foreground ${actionable.length === 0 ? "pointer-events-none opacity-50" : ""}`}
        >
          <input
            type="radio"
            name="action-profile"
            checked={selected === "all"}
            onChange={() => setSelected("all")}
            disabled={actionable.length === 0}
            className="accent-primary"
          />
          All profiles ({actionable.length})
        </label>
        {profiles.map((p) => {
          const disabled = !actionableIds.has(p.profileId)
          const hint = p.isLead
            ? "in leads"
            : p.status === "applied"
              ? "applied"
              : p.status === "dismissed"
                ? "dismissed"
                : null
          return (
            <label
              key={p.profileId}
              className={`flex items-center gap-2 text-xs text-foreground ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="action-profile"
                checked={selected === p.profileId}
                onChange={() => setSelected(p.profileId)}
                disabled={disabled}
                className="accent-primary"
              />
              {p.profileName}
              {hint && (
                <span className="text-caption text-muted-foreground">({hint})</span>
              )}
            </label>
          )
        })}
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          type="button"
          onClick={() =>
            onConfirm(
              selected === "all"
                ? actionable.map((p) => p.profileId)
                : [selected],
            )
          }
          disabled={
            pending ||
            (selected === "all"
              ? actionable.length === 0
              : !actionableIds.has(selected))
          }
          className="px-3.5 h-8 text-xs font-semibold shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {pending ? "Working…" : actionLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-8 text-xs text-muted-foreground hover:text-foreground shadow-none"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
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
  /** Every profile assigned to the acting user — drives the no-profile
   * warning and the match panel header. */
  profiles: ActiveProfile[]
  onApply?: (id: string) => void
  onMarkApplied?: (id: string, profileIds: string[]) => void
  /** True while the mark-applied API call is in flight — shows a loader and
   * disables the button. */
  markAppliedPending?: boolean
  onDismiss?: (id: string, reason: string, profileIds: string[]) => void
  onAddToLead?: (profileIds: string[]) => void
  addToLeadPending?: boolean
  showActions?: boolean
  /**
   * Job id used to load comments. Defaults to the job's own id — the leads
   * drawer renders a synthetic job (id = lead id), so it passes the real
   * job id here to surface the same thread.
   */
  commentsJobId?: string
  // Lead-only: DiscoveryTab renders jobs that have no lead (and so no
  // note) behind them, so both stay optional.
  notes?: string
  onNotesSave?: (value: string) => void
  canEditNotes?: boolean
  /** Job field editing (Admin + BD Manager — the jobs_update RLS policy).
   * Both must be provided for the editable rows to appear. */
  canEditJob?: boolean
  onJobFieldSave?: (patch: JobFieldPatch) => Promise<string | null>
  /** Opened from the Leads section — shows the fields that belong to the
   * lead, not the job (Developer), which stay hidden on Discovery/Pipeline
   * even for the same job. */
  isLeadsView?: boolean
  dismissReason?: string
  setDismissReason?: (r: string) => void
  dismissOpen?: boolean
  setDismissOpen?: (v: boolean) => void
  // Lead stage editor — when both are provided, the Details column's Stage
  // row becomes a dropdown backed by the database's pipeline_stages.
  stages?: StageOption[]
  onStageChange?: (stage: string) => void
  /** Developer field saver for leads (Admin + BD Manager only). Lead-specific
   * since a job can have many leads, one per profile — returns error string
   * on failure or null on success. */
  onDeveloperSave?: (value: string) => Promise<string | null>
}

/** Payload accepted by onJobFieldSave — column values plus the parsed-data
 * extras (skills/technologies are string lists, minExperience a number). */
export type JobFieldPatch = Record<
  string,
  string | boolean | number | string[] | null
>

const COUNTRY_EDIT_OPTIONS: readonly { value: string; label: string }[] =
  COUNTRY_OPTIONS.map(({ value, label }) => ({ value, label }))

// A skills/technologies textarea holds one item per line (or comma); the
// stored value is a list, so commit splits on either separator.
const splitList = (value: string): string[] =>
  value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)

export default function JobDrawer({
  job, onClose, open, profiles,
  onApply, onMarkApplied, markAppliedPending = false, onDismiss, onAddToLead, addToLeadPending = false, showActions = true,
  commentsJobId, notes, onNotesSave, canEditNotes = true,
  canEditJob = false, onJobFieldSave, isLeadsView = false,
  dismissReason = "", setDismissReason, dismissOpen = false, setDismissOpen,
  stages, onStageChange, onDeveloperSave,
}: Props) {
  // The drawer content node — the lead stage select portals its popup into
  // it so the dialog's focus trap (vaul is modal) doesn't blink it shut.
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Editing needs both the permission and a save handler; pages that pass
  // neither keep the drawer read-only.
  const editable = Boolean(canEditJob && onJobFieldSave)
  const saveField = (field: string) => async (value: string) =>
    onJobFieldSave!({ [field]: value })

  const [lastJob, setLastJob] = useState<Job | null>(job)
  const [lastNotes, setLastNotes] = useState(notes)
  const [prevJob, setPrevJob] = useState<Job | null>(job)
  const [prevNotes, setPrevNotes] = useState(notes)

  // Profile picker for the action buttons: shown whenever the acting user
  // has 2+ assigned profiles and the action still has profiles it can
  // target ("which profile, or all?"). Lists every assigned profile with
  // the non-targetable ones disabled.
  const [pendingAction, setPendingAction] = useState<null | {
    kind: "apply" | "dismiss" | "lead"
    profiles: JobProfileState[]
    actionableIds: Set<string>
  }>(null)

  if (job !== prevJob) {
    setPrevJob(job)
    if (job) setLastJob(job)
    setPendingAction(null)
  }
  if (notes !== prevNotes) {
    setPrevNotes(notes)
    if (notes !== undefined) setLastNotes(notes)
  }

  const displayJob = job ?? lastJob
  const displayNotes = notes ?? lastNotes
  const hasNotes = displayNotes !== undefined && onNotesSave !== undefined

  if (!displayJob) return null

  // Which of the acting user's profiles each action can still target. The
  // picker lists every assigned profile and disables the ones an action
  // can't target ("All profiles" means all of the targetable ones).
  const profileStates = displayJob.profiles ?? []
  const markApplicable = profileStates.filter((p) => p.status !== "applied")
  const dismissable = profileStates.filter((p) => p.status !== "dismissed" && !p.isLead)
  const leadable = profileStates.filter((p) => p.status === "applied" && !p.isLead)

  // Ask "which profile, or all?" whenever the acting user has 2+ assigned
  // profiles and the action still has profiles it can target — even if only
  // one remains (the picker is gated on assigned count, not actionable
  // count, per the product rule). A single-profile user still acts directly.
  const beginAction = (kind: "apply" | "lead", applicable: JobProfileState[]) => {
    if (profiles.length >= 2 && applicable.length > 0) {
      setPendingAction({
        kind,
        profiles: profileStates,
        actionableIds: new Set(applicable.map((p) => p.profileId)),
      })
    } else if (applicable.length === 1) {
      const ids = [applicable[0].profileId]
      if (kind === "apply") onMarkApplied?.(displayJob.id, ids)
      else onAddToLead?.(ids)
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={(isOpen) => { if (!isOpen) { onClose(); setPendingAction(null) } }}>
      <DrawerContent
        ref={contentRef}
        className="!w-full !max-w-none sm:!w-[880px] sm:!max-w-[880px] rounded-none! border-border bg-card text-foreground"
      >
        {/* Top bar */}
        <div className="flex items-center justify-end gap-2 px-5 py-2.5 border-b border-border bg-card shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled
            title="Save (coming soon)"
            aria-label="Save job (coming soon)"
            className="size-7 rounded-md text-muted-foreground"
          >
            <Bookmark className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left column — white */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-card px-8 py-6">
            <InlineEditBlock
              value={displayJob.title}
              canEdit={editable}
              onSave={saveField("title")}
            >
              {(shown) => (
                <h2 className="font-heading text-lg font-bold tracking-tight text-foreground mb-1.5 mt-0">
                  {shown}
                </h2>
              )}
            </InlineEditBlock>
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              <InlineEditBlock
                value={displayJob.company}
                canEdit={editable}
                onSave={saveField("companyName")}
              >
                {(shown) => (
                  <span className="text-sm font-semibold text-foreground">{shown}</span>
                )}
              </InlineEditBlock>
              <span className="text-border">·</span>
              <InlineEditBlock
                type="combobox"
                options={COUNTRY_EDIT_OPTIONS}
                value={displayJob.location}
                canEdit={editable}
                onSave={saveField("companyLocation")}
              >
                {(shown) => (
                  <span className="text-xs text-muted-foreground">
                    {shown || (editable ? "Location not set" : "")}
                  </span>
                )}
              </InlineEditBlock>
            </div>

            {/* Stage — editable on the lead drawer, right under the title. */}
            {stages && onStageChange && displayJob.stage && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">
                  Stage
                </span>
                <LeadStatusSelect
                  value={displayJob.stage}
                  stages={stages}
                  onChange={onStageChange}
                  container={contentRef}
                />
              </div>
            )}

            {/* Profile-dependent actions can't run without a profile — the
                API requires the acting user's assigned profile id (RLS
                scopes it), so call it out instead of silently doing nothing. */}
            {profiles.length === 0 && (showActions || onAddToLead || onDismiss) && (
              <div role="status" className="mb-4 rounded-md border border-status-amber/30 bg-status-amber/10 px-3 py-2 text-xs text-status-amber dark:text-status-amber-500">
                No profile is assigned to your account, so job actions are unavailable. Assign a profile in Profiles, then reload this page.
              </div>
            )}

            {showActions && (
              <div className="flex gap-2 mb-4">
                {displayJob.status === "new" && (
                  <>
                    <Button onClick={() => onApply?.(displayJob.id)}
                      className="flex-1 bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold h-9 shadow-none">
                      Apply Now
                    </Button>
                    {markApplicable.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => beginAction("apply", markApplicable)}
                        disabled={markAppliedPending || profiles.length === 0}
                        className="flex-1 border-border text-foreground text-xs font-medium h-9 shadow-none disabled:opacity-60"
                      >
                        {markAppliedPending ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Marking…
                          </>
                        ) : (
                          "Mark Applied"
                        )}
                      </Button>
                    )}
                    {dismissable.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (profiles.length >= 2 && dismissable.length > 0) {
                            setPendingAction({
                              kind: "dismiss",
                              profiles: profileStates,
                              actionableIds: new Set(dismissable.map((p) => p.profileId)),
                            })
                          }
                          setDismissOpen?.(true)
                        }}
                        disabled={profiles.length === 0}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-9 shadow-none"
                      >
                        Dismiss
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Profile picker for mark-applied / add-to-leads — shown whenever
                the acting user has 2+ assigned profiles. Dismiss uses the
                panel below instead (reason + picker together). */}
            {pendingAction && pendingAction.kind !== "dismiss" && (
              <ActionProfilePicker
                profiles={pendingAction.profiles}
                actionableIds={pendingAction.actionableIds}
                actionLabel={pendingAction.kind === "apply" ? "Mark Applied" : "Add to Leads"}
                pending={pendingAction.kind === "apply" ? markAppliedPending : addToLeadPending}
                onConfirm={(ids) => {
                  if (pendingAction.kind === "apply") onMarkApplied?.(displayJob.id, ids)
                  else onAddToLead?.(ids)
                  setPendingAction(null)
                }}
                onCancel={() => setPendingAction(null)}
              />
            )}

            {/* Applied-job actions: shown in read-only drawers (Pipeline)
                when the caller supplies handlers — the discovery drawer passes
                no onAddToLead/onDismiss here. */}
            {displayJob.status === "applied" && (onAddToLead || onDismiss) && (
              <div className="flex gap-2 mb-4">
                {onAddToLead && (
                  <Button
                    onClick={() => beginAction("lead", leadable)}
                    disabled={addToLeadPending || leadable.length === 0 || profiles.length === 0}
                    className="flex-1 bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold h-9 shadow-none disabled:opacity-60"
                  >
                    {leadable.length === 0
                      ? "Convert to Leads"
                      : addToLeadPending
                        ? "Converting…"
                        : "Convert to Leads"}
                  </Button>
                )}
                {/* A job already in the leads pipeline can't be dismissed —
                    the lead pins its applied state row. */}
                {onDismiss && dismissable.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (profiles.length >= 2 && dismissable.length > 0) {
                        setPendingAction({
                          kind: "dismiss",
                          profiles: profileStates,
                          actionableIds: new Set(dismissable.map((p) => p.profileId)),
                        })
                      }
                      setDismissOpen?.(true)
                    }}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-9 shadow-none"
                  >
                    Dismiss
                  </Button>
                )}
              </div>
            )}

            {dismissOpen && setDismissReason && setDismissOpen && (
              <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20 rounded-[7px]">
                <Textarea rows={2} placeholder="Reason for dismissal (required)…" value={dismissReason} onChange={e => setDismissReason(e.target.value)}
                  className="w-full p-2 bg-muted/40 border-border rounded-md text-foreground text-xs resize-none outline-none mb-2 focus:border-primary" />
                {pendingAction?.kind === "dismiss" ? (
                  <ActionProfilePicker
                    profiles={pendingAction.profiles}
                    actionableIds={pendingAction.actionableIds}
                    actionLabel="Dismiss"
                    onConfirm={(ids) => {
                      if (!dismissReason.trim()) return
                      onDismiss?.(displayJob.id, dismissReason, ids)
                      setDismissOpen(false)
                    }}
                    onCancel={() => { setPendingAction(null); setDismissOpen(false) }}
                  />
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={() => { if (dismissReason.trim()) { onDismiss?.(displayJob.id, dismissReason, dismissable.map(p => p.profileId)); setDismissOpen(false) } }}
                      disabled={!dismissReason.trim()}
                      className={`px-3.5 h-8 text-xs font-semibold shadow-none ${dismissReason.trim() ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-secondary text-muted-foreground"}`}>
                      Confirm Dismiss
                    </Button>
                    <Button variant="outline" onClick={() => setDismissOpen(false)} className="h-8 text-xs text-muted-foreground hover:text-foreground shadow-none">Cancel</Button>
                  </div>
                )}
              </div>
            )}

            {profiles.length > 0 && <RelevanceMatch profiles={profiles} job={displayJob} />}

            {(editable || (displayJob.parsedData?.skills?.length ?? 0) > 0) && (
              <div className="mb-5">
                <div className="text-xs font-semibold text-foreground mb-2">Required Skills</div>
                <InlineEditBlock
                  type="textarea"
                  value={(displayJob.parsedData?.skills ?? []).join(", ")}
                  canEdit={editable}
                  onSave={async (value: string) =>
                    onJobFieldSave!({ skills: splitList(value) })
                  }
                >
                  {(shown) =>
                    shown.trim() ? (
                      <div className="flex flex-wrap gap-1.5">
                        {splitList(shown).map((skill) => (
                          <TintedBadge key={skill} color="var(--primary)">
                            {skill}
                          </TintedBadge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No skills yet — click to add.
                      </p>
                    )
                  }
                </InlineEditBlock>
              </div>
            )}

            {(editable || (displayJob.parsedData?.technologies?.length ?? 0) > 0) && (
              <div className="mb-5">
                <div className="text-xs font-semibold text-foreground mb-2">Technologies & Tools</div>
                <InlineEditBlock
                  type="textarea"
                  value={(displayJob.parsedData?.technologies ?? []).join(", ")}
                  canEdit={editable}
                  onSave={async (value: string) =>
                    onJobFieldSave!({ technologies: splitList(value) })
                  }
                >
                  {(shown) =>
                    shown.trim() ? (
                      <div className="flex flex-wrap gap-1.5">
                        {splitList(shown).map((tech) => (
                          <TintedBadge key={tech} color="#6366F1">
                            {tech}
                          </TintedBadge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No technologies yet — click to add.
                      </p>
                    )
                  }
                </InlineEditBlock>
              </div>
            )}

            <div className="mb-5">
              <div className="text-xs font-semibold text-foreground mb-2.5">About the Role</div>
              <InlineEditBlock
                type="textarea"
                value={displayJob.description}
                canEdit={editable}
                onSave={saveField("description")}
              >
                {(shown) => <FormattedDescription text={shown} />}
              </InlineEditBlock>
            </div>

            {hasNotes && (
              <div className="mb-5">
                <LeadNotesPanel key={displayJob.id} notes={displayNotes} onSave={onNotesSave!} canEdit={canEditNotes} />
              </div>
            )}

            {/* Comments — any org member can comment (flat thread) */}
            <div className="pt-4 border-t border-border">
              <div className="text-xs font-semibold text-foreground mb-2.5">Comments</div>
              <JobComments jobId={commentsJobId ?? displayJob.id} />
            </div>
          </div>

          {/* Right column — page content background */}
          <aside className="w-[260px] shrink-0 border-l border-border bg-page-bg overflow-y-auto px-6 py-6">
            <div className="text-xs font-semibold text-foreground mb-4">Details</div>

            <dl className="flex flex-col gap-4">
              {editable && (
                <div className="flex flex-col gap-0.5 pb-2 mb-2 border-b border-border">
                  <InlineEditField
                    label="Work Type"
                    type="select"
                    options={WORK_TYPE_EDIT_OPTIONS}
                    value={displayJob.workType}
                    canEdit
                    onSave={async (value: string) => onJobFieldSave!({ isRemote: value === "remote" })}
                  />
                  <InlineEditField
                    label="Apply URL"
                    value={displayJob.applyUrl}
                    canEdit
                    onSave={saveField("applyUrl")}
                  />
                  <InlineEditField
                    label="Source"
                    value={displayJob.parsedData?.source ?? null}
                    canEdit
                    onSave={saveField("source")}
                  />
                  <InlineEditField
                    label="Min Experience"
                    type="number"
                    value={displayJob.parsedData?.experienceYears ?? null}
                    canEdit
                    onSave={async (value: string) =>
                      onJobFieldSave!({ minExperience: value === "" ? null : Number(value) })
                    }
                  />
                  <InlineEditField
                    label="Exp. Compensation"
                    value={displayJob.parsedData?.salaryRange ?? null}
                    canEdit
                    onSave={saveField("expCompensation")}
                  />
                  <InlineEditField
                    label="Budget"
                    value={displayJob.parsedData?.budget ?? null}
                    canEdit
                    onSave={saveField("budget")}
                  />
                  {isLeadsView && onDeveloperSave && (
                    <InlineEditField
                      label="Developer"
                      value={displayJob.parsedData?.developer ?? null}
                      canEdit
                      onSave={onDeveloperSave}
                    />
                  )}
                </div>
              )}

              {!editable && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Work Type</dt>
                <dd className="text-xs text-foreground capitalize">
                  {displayJob.workType}
                  {displayJob.workType === "remote" && displayJob.remoteRegion
                    ? ` · ${displayJob.remoteRegion}`
                    : null}
                </dd>
              </div>
              )}

              {displayJob.engagementType && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Type</dt>
                  <dd className="text-xs text-foreground capitalize font-medium">{displayJob.engagementType}</dd>
                </div>
              )}

              {displayJob.stage && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Stage</dt>
                  <dd className="text-xs text-foreground font-medium">{displayJob.stage}</dd>
                </div>
              )}

              {!editable && displayJob.parsedData?.experienceYears && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Min Experience</dt>
                  <dd className="text-xs text-foreground font-medium">{displayJob.parsedData.experienceYears} Years</dd>
                </div>
              )}

              {!editable && displayJob.parsedData?.salaryRange && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Exp. Compensation</dt>
                  <dd className="text-xs text-foreground font-medium">{displayJob.parsedData.salaryRange}</dd>
                </div>
              )}

              {!editable && displayJob.parsedData?.budget && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Budget</dt>
                  <dd className="text-xs text-foreground font-medium text-right">{displayJob.parsedData.budget}</dd>
                </div>
              )}

              {!editable && isLeadsView && displayJob.parsedData?.developer && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Developer</dt>
                  <dd className="text-xs text-foreground font-medium text-right">{displayJob.parsedData.developer}</dd>
                </div>
              )}

              {displayJob.possiblyClosed && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Flag</dt>
                  <dd>
                    <TintedBadge color="var(--status-amber)" className="px-2.5 py-1 rounded-full">Possibly Closed</TintedBadge>
                  </dd>
                </div>
              )}

              {!editable && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Source</dt>
                  <dd className="text-xs text-foreground">
                    {displayJob.parsedData?.source || displayJob.parser}
                  </dd>
                </div>
              )}

              {(() => {
                // Who this job is tied to — the profile(s) it was applied
                // for (applied feed) or, on a lead, the lead's profile.
                const appliedNames = (displayJob.profiles ?? [])
                  .filter((p) => p.status === "applied" || p.isLead)
                  .map((p) => p.profileName)
                const names =
                  appliedNames.length > 0
                    ? appliedNames
                    : displayJob.isLead && profiles[0]?.name
                      ? [profiles[0].name]
                      : []
                if (names.length === 0) return null
                return (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">
                      Profile
                    </dt>
                    <dd className="text-xs text-foreground font-medium text-right">
                      {names.join(", ")}
                    </dd>
                  </div>
                )
              })()}

              <div className="flex items-center justify-between gap-3">
                <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">
                  {displayJob.status === "applied" || displayJob.isLead
                    ? "Applied"
                    : "Posted"}
                </dt>
                <dd className="text-xs text-foreground font-mono text-right">
                  {formatDate(displayJob.appliedAt ?? displayJob.postedAt)}{" "}
                  <span className="text-muted-foreground">· {timeAgo(displayJob.appliedAt ?? displayJob.postedAt)}</span>
                </dd>
              </div>

              {!editable && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-caption font-semibold text-muted-foreground uppercase tracking-widest">Location</dt>
                  <dd className="text-xs text-foreground text-right">{displayJob.location}</dd>
                </div>
              )}

              {displayJob.applyUrl && !editable && (
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
