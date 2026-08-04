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
import { computeMatchScore } from "@/lib/matching"

export interface Job {
  id: string
  title: string
  company: string
  location: string
  workType: "remote" | "onsite" | "hybrid"
  postedAt: Date
  salary: string
  description: string
  requirements: string[]
  niceToHave: string[]
  parser: string
  status: "new" | "applied" | "dismissed"
  dismissReason?: string
  applyUrl: string
  companySize: string
  companyIndustry: string
  experienceLevel: string
}

function ResumeMatch({ profile, job }: { profile: Profile; job: Job }) {
  const { score, matchSkills } = computeMatchScore(profile.skills, job.requirements)

  const arc = (pct: number, r = 34) => {
    const circumference = 2 * Math.PI * r
    return circumference - (pct / 100) * circumference
  }

  return (
    <div className="p-3.5 px-4 bg-[var(--muted)] rounded-lg border border-[var(--border)] mb-4">
      <div className="text-xs font-semibold text-[var(--fg)] mb-3">
        Match with {profile.name}
      </div>
      <div className="flex items-center gap-4">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444"}
            strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34}
            strokeDashoffset={arc(score)} transform="rotate(-90 40 40)" className="transition-[stroke-dashoffset] duration-500 ease-in-out" />
          <text x="40" y="44" textAnchor="middle" fill="var(--fg)" fontSize="14" fontWeight="700" className="font-mono">{score}%</text>
        </svg>
        <div className="flex-1">
          <div className="text-xs text-[var(--muted-fg)] mb-2">Matching skills</div>
          <div className="flex flex-wrap gap-1">
            {matchSkills.map(s => (
              <TintedBadge key={s} color="#10b981" className="px-1.75 py-0.5 text-[11px] font-normal">
                {s}
              </TintedBadge>
            ))}
            {profile.skills.filter(s => !matchSkills.includes(s)).slice(0, 3).map(s => (
              <Badge key={s} variant="secondary" className="px-1.75 py-0.5 bg-[var(--secondary)] rounded text-[11px] text-[var(--muted-fg)] font-normal">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  job: Job
  onClose: () => void
  activeProfile: Profile
  profiles?: Profile[]
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
  job, onClose, activeProfile, profiles = [],
  onApply, onMarkApplied, onDismiss, showActions = true,
  dismissReason = "", setDismissReason, dismissOpen = false, setDismissOpen,
}: Props) {
  const allProfiles = profiles.length > 0 ? profiles : [activeProfile]

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
            </TintedBadge>
            <TintedBadge color={PARSER_COLOR[job.parser] || "#64748b"} className="px-2 py-0.75">
              via {job.parser}
            </TintedBadge>
            <Badge variant="secondary" className="px-2 py-0.75 rounded text-[11px] text-[var(--muted-fg)] font-mono font-normal">
              {timeAgo(job.postedAt)}
            </Badge>
            {job.salary && (
              <TintedBadge color="#10b981" className="px-2 py-0.75">
                {job.salary}
              </TintedBadge>
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
              {job.status === "applied" && <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-[7px] text-xs font-semibold text-emerald-500">✓ Applied</div>}
              {job.status === "dismissed" && <div className="px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-[7px] text-xs text-red-500">Dismissed · {job.dismissReason}</div>}
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
          {allProfiles.map(p => <ResumeMatch key={p.id} profile={p} job={job} />)}

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Company Size", value: job.companySize },
              { label: "Industry", value: job.companyIndustry },
              { label: "Experience", value: job.experienceLevel },
            ].map(m => (
              <div key={m.label} className="p-2.5 px-3 bg-[var(--muted)] rounded-[7px] border border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-fg)] mb-1 uppercase tracking-[0.5px] font-mono">{m.label}</div>
                <div className="text-xs font-medium text-[var(--fg)]">{m.value}</div>
              </div>
            ))}
          </div>

          <div className="mb-5">
            <div className="text-xs font-semibold text-[var(--fg)] mb-2.5">About the Role</div>
            <p className="text-xs text-[var(--fg)] leading-relaxed m-0">{job.description}</p>
          </div>

          <div className="mb-5">
            <div className="text-xs font-semibold text-[var(--fg)] mb-2.5">Requirements</div>
            <div className="flex flex-col gap-1.5">
              {job.requirements.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.25 h-1.25 rounded-full bg-[var(--primary)] mt-1.25 shrink-0" />
                  <span className="text-xs text-[var(--fg)] leading-normal">{r}</span>
                </div>
              ))}
            </div>
          </div>

          {job.niceToHave.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-semibold text-[var(--fg)] mb-2.5">Nice to Have</div>
              <div className="flex flex-col gap-1.5">
                {job.niceToHave.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.25 h-1.25 rounded-full bg-[var(--muted-fg)] mt-1.25 shrink-0" />
                    <span className="text-xs text-[var(--muted-fg)] leading-normal">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
