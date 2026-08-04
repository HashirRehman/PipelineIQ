import type { Profile } from '@/app/page'

export interface Job {
  id: string
  title: string
  company: string
  location: string
  workType: 'remote' | 'onsite' | 'hybrid'
  postedAt: Date
  salary: string
  description: string
  requirements: string[]
  niceToHave: string[]
  parser: string
  status: 'new' | 'applied' | 'dismissed'
  dismissReason?: string
  applyUrl: string
  companySize: string
  companyIndustry: string
  experienceLevel: string
}

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const workTypeColor: Record<string, string> = {
  remote: '#10b981', onsite: '#6366f1', hybrid: '#f59e0b',
}

const parserColor: Record<string, string> = {
  LinkedIn: '#0a66c2', Indeed: '#003a9b', Greenhouse: '#24a148', Lever: '#7c3aed', Workday: '#f59e0b',
}

function ResumeMatch({ profile, job }: { profile: Profile; job: Job }) {
  const matchSkills = profile.skills.filter(s => job.requirements.some(r => r.toLowerCase().includes(s.toLowerCase())))
  const score = Math.min(100, Math.round((matchSkills.length / Math.max(job.requirements.length, 1)) * 100) + 15)

  const arc = (pct: number, r = 34) => {
    const circumference = 2 * Math.PI * r
    return circumference - (pct / 100) * circumference
  }

  return (
    <div className="p-3.5 px-4 bg-[var(--muted)] rounded-lg border border-[var(--border)] mb-4">
      <div className="text-xs font-semibold text-[var(--fg)] mb-3">Match with {profile.name}</div>
      <div className="flex items-center gap-4">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'}
            strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34}
            strokeDashoffset={arc(score)} transform="rotate(-90 40 40)" className="transition-[stroke-dashoffset] duration-500 ease-in-out" />
          <text x="40" y="44" textAnchor="middle" fill="var(--fg)" fontSize="14" fontWeight="700" className="font-mono">{score}%</text>
        </svg>
        <div className="flex-1">
          <div className="text-xs text-[var(--muted-fg)] mb-2">Matching skills</div>
          <div className="flex flex-wrap gap-1">
            {matchSkills.map(s => (
              <span key={s} className="px-1.75 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded text-[11px] text-emerald-500">{s}</span>
            ))}
            {profile.skills.filter(s => !matchSkills.includes(s)).slice(0, 3).map(s => (
              <span key={s} className="px-1.75 py-0.5 bg-[var(--secondary)] rounded text-[11px] text-[var(--muted-fg)]">{s}</span>
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
  dismissReason = '', setDismissReason, dismissOpen = false, setDismissOpen,
}: Props) {
  const allProfiles = profiles.length > 0 ? profiles : [activeProfile]

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-[2px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ml-auto w-[580px] bg-[var(--card)] border-l border-[var(--border)] flex flex-col overflow-hidden">
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
            <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--muted-fg)] shrink-0 p-1 hover:text-[var(--fg)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <span className="inline-flex items-center px-2 py-0.75 rounded text-[11px] font-semibold font-mono" style={{ background: workTypeColor[job.workType] + '20', color: workTypeColor[job.workType] }}>
              {job.workType}
            </span>
            <span className="inline-flex items-center px-2 py-0.75 rounded text-[11px] font-semibold font-mono" style={{ background: (parserColor[job.parser] || '#64748b') + '20', color: parserColor[job.parser] || '#64748b' }}>
              via {job.parser}
            </span>
            <span className="inline-flex items-center px-2 py-0.75 rounded text-[11px] bg-[var(--secondary)] text-[var(--muted-fg)] font-mono">
              {timeAgo(job.postedAt)}
            </span>
            {job.salary && (
              <span className="inline-flex items-center px-2 py-0.75 rounded text-[11px] font-semibold bg-emerald-500/12 text-emerald-500 font-mono">
                {job.salary}
              </span>
            )}
          </div>

          {showActions && (
            <div className="flex gap-2">
              {job.status === 'new' && (
                <>
                  <button onClick={() => onApply?.(job.id)}
                    className="flex-1 p-2.25 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90 transition-opacity">
                    Apply Now
                  </button>
                  <button onClick={() => onMarkApplied?.(job.id)}
                    className="flex-1 p-2.25 bg-transparent border border-[var(--border-strong)] rounded-[7px] cursor-pointer text-xs font-medium text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    Mark Applied
                  </button>
                  <button onClick={() => setDismissOpen?.(!dismissOpen)}
                    className="px-3.5 py-2.25 bg-transparent border border-red-500/30 rounded-[7px] cursor-pointer text-xs text-red-500 hover:bg-red-500/10 transition-colors">
                    Dismiss
                  </button>
                </>
              )}
              {job.status === 'applied' && <div className="px-3 py-2.25 bg-emerald-500/10 border border-emerald-500/25 rounded-[7px] text-xs font-semibold text-emerald-500">✓ Applied</div>}
              {job.status === 'dismissed' && <div className="px-3 py-2.25 bg-red-500/10 border border-red-500/25 rounded-[7px] text-xs text-red-500">Dismissed · {job.dismissReason}</div>}
            </div>
          )}

          {dismissOpen && setDismissReason && setDismissOpen && (
            <div className="mt-2.5 p-3 bg-red-500/5 border border-red-500/20 rounded-[7px]">
              <textarea rows={2} placeholder="Reason for dismissal (required)…" value={dismissReason} onChange={e => setDismissReason(e.target.value)}
                className="w-full p-2 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-none outline-none mb-2 focus:border-[var(--primary)]" />
              <div className="flex gap-2">
                <button onClick={() => { if (dismissReason.trim()) { onDismiss?.(job.id, dismissReason); setDismissOpen(false) } }}
                  disabled={!dismissReason.trim()}
                  className={`px-3.5 py-1.5 border-none rounded-md text-xs font-semibold transition-colors ${dismissReason.trim() ? 'bg-red-500 text-white cursor-pointer hover:bg-red-600' : 'bg-[var(--secondary)] text-[var(--muted-fg)] cursor-default'}`}>
                  Confirm Dismiss
                </button>
                <button onClick={() => setDismissOpen(false)} className="px-3 py-1.5 bg-transparent border border-[var(--border-strong)] rounded-md cursor-pointer text-xs text-[var(--muted-fg)] hover:text-[var(--fg)] transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 px-6">
          {/* Resume Match */}
          {allProfiles.map(p => <ResumeMatch key={p.id} profile={p} job={job} />)}

          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Company Size', value: job.companySize },
              { label: 'Industry', value: job.companyIndustry },
              { label: 'Experience', value: job.experienceLevel },
            ].map(m => (
              <div key={m.label} className="p-2.5 px-3 bg-[var(--muted)] rounded-[7px] border border-[var(--border)]">
                <div className="text-[10px] text-[var(--muted-fg)] mb-1 uppercase tracking-[0.5px] font-mono">{m.label}</div>
                <div className="text-xs font-medium text-[var(--fg)]">{m.value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="mb-5">
            <div className="text-xs font-semibold text-[var(--fg)] mb-2.5">About the Role</div>
            <p className="text-xs text-[var(--fg)] leading-relaxed m-0">{job.description}</p>
          </div>

          {/* Requirements */}
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
      </div>
    </div>
  )
}
