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
    <div style={{ padding: '14px 16px', background: 'var(--muted)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 12 }}>Match with {profile.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-strong)" strokeWidth="6" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'}
            strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 34}
            strokeDashoffset={arc(score)} transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          <text x="40" y="44" textAnchor="middle" fill="var(--fg)" fontSize="14" fontWeight="700" fontFamily="JetBrains Mono, monospace">{score}%</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginBottom: 8 }}>Matching skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {matchSkills.map(s => (
              <span key={s} style={{ padding: '2px 7px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 4, fontSize: 11, color: '#10b981' }}>{s}</span>
            ))}
            {profile.skills.filter(s => !matchSkills.includes(s)).slice(0, 3).map(s => (
              <span key={s} style={{ padding: '2px 7px', background: 'var(--secondary)', borderRadius: 4, fontSize: 11, color: 'var(--muted-fg)' }}>{s}</span>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'stretch', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ marginLeft: 'auto', width: 580, background: 'var(--card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px' }}>{job.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{job.company}</span>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>{job.location}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-fg)', flexShrink: 0, padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: workTypeColor[job.workType] + '20', color: workTypeColor[job.workType], fontFamily: 'JetBrains Mono, monospace' }}>
              {job.workType}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: (parserColor[job.parser] || '#64748b') + '20', color: parserColor[job.parser] || '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
              via {job.parser}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'var(--secondary)', color: 'var(--muted-fg)', fontFamily: 'JetBrains Mono, monospace' }}>
              {timeAgo(job.postedAt)}
            </span>
            {job.salary && (
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>
                {job.salary}
              </span>
            )}
          </div>

          {showActions && (
            <div style={{ display: 'flex', gap: 8 }}>
              {job.status === 'new' && (
                <>
                  <button onClick={() => onApply?.(job.id)}
                    style={{ flex: 1, padding: '9px', background: 'var(--primary)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white' }}>
                    Apply Now
                  </button>
                  <button onClick={() => onMarkApplied?.(job.id)}
                    style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                    Mark Applied
                  </button>
                  <button onClick={() => setDismissOpen?.(!dismissOpen)}
                    style={{ padding: '9px 14px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#ef4444' }}>
                    Dismiss
                  </button>
                </>
              )}
              {job.status === 'applied' && <div style={{ padding: '9px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 7, fontSize: 13, fontWeight: 600, color: '#10b981' }}>✓ Applied</div>}
              {job.status === 'dismissed' && <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, fontSize: 13, color: '#ef4444' }}>Dismissed · {job.dismissReason}</div>}
            </div>
          )}

          {dismissOpen && setDismissReason && setDismissOpen && (
            <div style={{ marginTop: 10, padding: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7 }}>
              <textarea rows={2} placeholder="Reason for dismissal (required)…" value={dismissReason} onChange={e => setDismissReason(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 12, resize: 'none', outline: 'none', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { if (dismissReason.trim()) { onDismiss?.(job.id, dismissReason); setDismissOpen(false) } }}
                  disabled={!dismissReason.trim()}
                  style={{ padding: '6px 14px', background: dismissReason.trim() ? '#ef4444' : 'var(--secondary)', border: 'none', borderRadius: 5, cursor: dismissReason.trim() ? 'pointer' : 'default', fontSize: 12, fontWeight: 600, color: dismissReason.trim() ? 'white' : 'var(--muted-fg)' }}>
                  Confirm Dismiss
                </button>
                <button onClick={() => setDismissOpen(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: 'var(--muted-fg)' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {/* Resume Match */}
          {allProfiles.map(p => <ResumeMatch key={p.id} profile={p} job={job} />)}

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Company Size', value: job.companySize },
              { label: 'Industry', value: job.companyIndustry },
              { label: 'Experience', value: job.experienceLevel },
            ].map(m => (
              <div key={m.label} style={{ padding: '10px 12px', background: 'var(--muted)', borderRadius: 7, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted-fg)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'JetBrains Mono, monospace' }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 10 }}>About the Role</div>
            <p style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.7, margin: 0 }}>{job.description}</p>
          </div>

          {/* Requirements */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 10 }}>Requirements</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {job.requirements.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.5 }}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {job.niceToHave.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 10 }}>Nice to Have</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {job.niceToHave.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--muted-fg)', marginTop: 5, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--muted-fg)', lineHeight: 1.5 }}>{r}</span>
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
