import { useState } from 'react'
import type { Profile } from '@/app/page'
import JobDrawer, { type Job } from './JobDrawer'

const now = Date.now()
const JOBS: Job[] = [
  { id: 'j1', title: 'Senior Frontend Engineer', company: 'Vercel', location: 'San Francisco, CA', workType: 'remote', postedAt: new Date(now - 22 * 60000), salary: '$150k – $185k', description: 'Join Vercel\'s product team to build the next generation of developer tooling. You\'ll work on our main dashboard and edge network UI, collaborating with designers and product managers to ship features used by millions of developers worldwide.', requirements: ['5+ years React experience', 'TypeScript proficiency', 'Next.js framework experience', 'Performance optimization knowledge', 'Experience with design systems'], niceToHave: ['GraphQL', 'Figma', 'Edge computing concepts'], parser: 'LinkedIn', status: 'new', applyUrl: '#', companySize: '501–1,000', companyIndustry: 'Cloud Infrastructure', experienceLevel: 'Senior' },
  { id: 'j2', title: 'Staff Software Engineer', company: 'Linear', location: 'Remote', workType: 'remote', postedAt: new Date(now - 2 * 3600000), salary: '$200k – $240k', description: 'Linear is building the new standard for modern software development. We\'re looking for a Staff Engineer to lead key product areas, define architectural decisions, and mentor a growing engineering team. You\'ll have enormous leverage on the product direction.', requirements: ['10+ years software engineering', 'Strong TypeScript or Rust experience', 'Track record of leading technical initiatives', 'Experience with real-time systems', 'Excellent communication skills'], niceToHave: ['CRDTs or OT experience', 'Electron app development', 'Previous staff-level role'], parser: 'Greenhouse', status: 'new', applyUrl: '#', companySize: '51–200', companyIndustry: 'Developer Tools', experienceLevel: 'Staff' },
  { id: 'j3', title: 'Lead Backend Engineer', company: 'Stripe', location: 'New York, NY', workType: 'hybrid', postedAt: new Date(now - 5 * 3600000), salary: '$180k – $220k', description: 'Stripe\'s Payments infrastructure team is hiring a Lead Backend Engineer to help scale systems processing hundreds of billions of dollars annually. You\'ll work on core payment flows, fraud detection systems, and developer-facing APIs used by millions of businesses.', requirements: ['8+ years backend engineering', 'Ruby or Go proficiency', 'Distributed systems expertise', 'Experience with high-throughput financial systems', 'Strong database knowledge (MySQL/Postgres)'], niceToHave: ['Payments domain knowledge', 'Machine learning systems', 'Previous leadership role'], parser: 'LinkedIn', status: 'new', applyUrl: '#', companySize: '5,001–10,000', companyIndustry: 'FinTech', experienceLevel: 'Lead' },
  { id: 'j4', title: 'Senior Full Stack Engineer', company: 'Notion', location: 'Remote', workType: 'remote', postedAt: new Date(now - 8 * 3600000), salary: '$160k – $200k', description: 'Notion is on a mission to give teams a shared space to think and plan together. We\'re looking for engineers to work on our collaborative editor, sync infrastructure, and API platform. You\'ll ship products used by 30M+ people.', requirements: ['5+ years full stack experience', 'React + Node.js or Python', 'Experience with collaborative or real-time features', 'Familiarity with block-based editors'], niceToHave: ['Yjs or similar CRDT libraries', 'Mobile development', 'Data modeling experience'], parser: 'Lever', status: 'applied', applyUrl: '#', companySize: '501–1,000', companyIndustry: 'Productivity SaaS', experienceLevel: 'Senior' },
  { id: 'j5', title: 'Principal Engineer – Platform', company: 'Shopify', location: 'Ottawa, Canada', workType: 'remote', postedAt: new Date(now - 24 * 3600000), salary: 'CAD $220k – $280k', description: 'As Principal Engineer on Shopify\'s Platform team, you\'ll set the technical vision for how Shopify\'s infrastructure serves 2M+ merchants. You\'ll work across infrastructure, data, and product engineering to drive adoption of new platforms.', requirements: ['12+ years engineering experience', 'Platform and infrastructure expertise', 'Experience leading org-wide technical initiatives', 'Ruby, Go or Rust experience'], niceToHave: ['Commerce domain knowledge', 'Open source contributions'], parser: 'Workday', status: 'new', applyUrl: '#', companySize: '10,000+', companyIndustry: 'eCommerce', experienceLevel: 'Principal' },
  { id: 'j6', title: 'Senior React Native Engineer', company: 'Spotify', location: 'Stockholm, Sweden', workType: 'hybrid', postedAt: new Date(now - 36 * 3600000), salary: '€110k – €140k', description: 'Spotify\'s Mobile Platform team is looking for a Senior React Native Engineer to work on features serving 600M+ users. You\'ll bridge native and JavaScript layers, build shared component libraries, and drive performance improvements.', requirements: ['4+ years React Native', 'iOS or Android native experience', 'Strong JavaScript/TypeScript', 'Experience with CI/CD for mobile'], niceToHave: ['Audio streaming knowledge', 'A/B testing at scale'], parser: 'LinkedIn', status: 'dismissed', dismissReason: 'Rate below expectation', applyUrl: '#', companySize: '5,001–10,000', companyIndustry: 'Media & Entertainment', experienceLevel: 'Senior' },
  { id: 'j7', title: 'Engineering Manager – Frontend', company: 'Figma', location: 'San Francisco, CA', workType: 'hybrid', postedAt: new Date(now - 2 * 86400000), salary: '$220k – $270k', description: 'Lead a team of 6-8 senior engineers building Figma\'s editor and design systems. You\'ll balance technical leadership with people management, driving roadmap planning and cross-functional collaboration while maintaining a high engineering bar.', requirements: ['3+ years engineering management', '7+ years software engineering', 'Experience managing senior ICs', 'Strong frontend background'], niceToHave: ['Design tools experience', 'WebGL or Canvas API'], parser: 'Greenhouse', status: 'new', applyUrl: '#', companySize: '1,001–5,000', companyIndustry: 'Design Tooling', experienceLevel: 'Manager' },
  { id: 'j8', title: 'Senior Backend Engineer – AI', company: 'Anthropic', location: 'San Francisco, CA', workType: 'onsite', postedAt: new Date(now - 3 * 86400000), salary: '$200k – $250k', description: 'Anthropic is hiring backend engineers to work on Claude\'s API infrastructure, tool use capabilities, and developer platform. You\'ll work alongside ML researchers and product teams to ship AI products used by millions.', requirements: ['6+ years backend engineering', 'Python or Go proficiency', 'Experience with high-scale API systems', 'Understanding of LLM inference'], niceToHave: ['ML systems experience', 'Knowledge of transformers', 'Safety-critical systems'], parser: 'Indeed', status: 'new', applyUrl: '#', companySize: '201–500', companyIndustry: 'AI / ML', experienceLevel: 'Senior' },
]

const PARSERS = ['All Sources', 'LinkedIn', 'Indeed', 'Greenhouse', 'Lever', 'Workday']
const WORK_TYPES = ['All Types', 'remote', 'hybrid', 'onsite']
const EXPERIENCE = ['All Levels', 'Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Principal', 'Manager']

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const workTypeColor: Record<string, string> = { remote: '#10b981', onsite: '#6366f1', hybrid: '#f59e0b' }
const parserColor: Record<string, string> = { LinkedIn: '#0a66c2', Indeed: '#003a9b', Greenhouse: '#24a148', Lever: '#7c3aed', Workday: '#f59e0b' }
const statusBg: Record<string, string> = { new: 'transparent', applied: 'rgba(16,185,129,0.06)', dismissed: 'rgba(239,68,68,0.04)' }
const statusBorder: Record<string, string> = { new: 'var(--border)', applied: 'rgba(16,185,129,0.2)', dismissed: 'rgba(239,68,68,0.15)' }

interface Props {
  activeProfile: Profile
  profiles: Profile[]
}

const PAGE_SIZE = 5

export default function DiscoveryTab({ activeProfile, profiles }: Props) {
  const [jobs, setJobs] = useState<Job[]>(JOBS)
  const [search, setSearch] = useState('')
  const [parserFilter, setParserFilter] = useState('All Sources')
  const [workTypeFilter, setWorkTypeFilter] = useState('All Types')
  const [expFilter, setExpFilter] = useState('All Levels')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [dismissOpen, setDismissOpen] = useState(false)
  const [dismissReason, setDismissReason] = useState('')
  const [pendingDismissId, setPendingDismissId] = useState<string | null>(null)

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    const matchQ = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.location.toLowerCase().includes(q)
    const matchParser = parserFilter === 'All Sources' || j.parser === parserFilter
    const matchType = workTypeFilter === 'All Types' || j.workType === workTypeFilter
    const matchExp = expFilter === 'All Levels' || j.experienceLevel === expFilter
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchQ && matchParser && matchType && matchExp && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleApply = (id: string) => {
    setJobs(j => j.map(job => job.id === id ? { ...job, status: 'applied' } : job))
    setSelectedJob(prev => prev && prev.id === id ? { ...prev, status: 'applied' } : prev)
  }

  const handleMarkApplied = (id: string) => {
    setJobs(j => j.map(job => job.id === id ? { ...job, status: 'applied' } : job))
    setSelectedJob(prev => prev && prev.id === id ? { ...prev, status: 'applied' } : prev)
  }

  const handleDismiss = (id: string, reason: string) => {
    setJobs(j => j.map(job => job.id === id ? { ...job, status: 'dismissed', dismissReason: reason } : job))
    setSelectedJob(null)
    setDismissReason('')
  }

  const startDismiss = (id: string) => {
    setPendingDismissId(id)
    setDismissOpen(true)
    setDismissReason('')
  }

  const confirmDismiss = () => {
    if (pendingDismissId && dismissReason.trim()) {
      handleDismiss(pendingDismissId, dismissReason)
      setDismissOpen(false)
      setPendingDismissId(null)
    }
  }

  const filterBtn = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} className="tab-btn"
      style={{ padding: '5px 12px', background: active ? 'rgba(6,182,212,0.12)' : 'transparent', border: active ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--primary)' : 'var(--fg)', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* Filters Panel */}
      <div style={{ width: 230, borderRight: '1px solid var(--border)', padding: '24px 16px', overflowY: 'auto', flexShrink: 0, background: 'var(--muted)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Filters
          <button onClick={() => { setSearch(''); setParserFilter('All Sources'); setWorkTypeFilter('All Types'); setExpFilter('All Levels'); setStatusFilter('all') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--primary)' }}>Clear all</button>
        </div>

        {/* Status */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[['all', 'All Jobs'], ['new', 'New'], ['applied', 'Applied'], ['dismissed', 'Dismissed']].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                style={{ padding: '6px 10px', background: statusFilter === v ? 'rgba(6,182,212,0.1)' : 'transparent', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: statusFilter === v ? 'var(--primary)' : 'var(--fg)', textAlign: 'left', fontWeight: statusFilter === v ? 600 : 400 }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Work Type */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Work Type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {WORK_TYPES.map(t => (
              <button key={t} onClick={() => setWorkTypeFilter(t)}
                style={{ padding: '6px 10px', background: workTypeFilter === t ? 'rgba(6,182,212,0.1)' : 'transparent', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: workTypeFilter === t ? 'var(--primary)' : 'var(--fg)', textAlign: 'left', fontWeight: workTypeFilter === t ? 600 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t !== 'All Types' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: workTypeColor[t], flexShrink: 0 }} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Parser Source */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Source Parser</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PARSERS.map(p => (
              <button key={p} onClick={() => setParserFilter(p)}
                style={{ padding: '6px 10px', background: parserFilter === p ? 'rgba(6,182,212,0.1)' : 'transparent', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: parserFilter === p ? 'var(--primary)' : 'var(--fg)', textAlign: 'left', fontWeight: parserFilter === p ? 600 : 400 }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Experience Level</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {EXPERIENCE.map(e => (
              <button key={e} onClick={() => setExpFilter(e)}
                style={{ padding: '6px 10px', background: expFilter === e ? 'rgba(6,182,212,0.1)' : 'transparent', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: expFilter === e ? 'var(--primary)' : 'var(--fg)', textAlign: 'left', fontWeight: expFilter === e ? 600 : 400 }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Job List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Discovery</h1>
              <p style={{ fontSize: 13, color: 'var(--muted-fg)', margin: '3px 0 0' }}>{filtered.length} jobs found</p>
            </div>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding: '9px 10px 9px 32px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--fg)', fontSize: 13, outline: 'none', width: 220 }} />
            </div>
          </div>

          {/* Quick filter pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 14 }}>
            {filterBtn('All', statusFilter === 'all', () => setStatusFilter('all'))}
            {filterBtn('Remote', workTypeFilter === 'remote', () => setWorkTypeFilter(workTypeFilter === 'remote' ? 'All Types' : 'remote'))}
            {filterBtn('Hybrid', workTypeFilter === 'hybrid', () => setWorkTypeFilter(workTypeFilter === 'hybrid' ? 'All Types' : 'hybrid'))}
            {filterBtn('Onsite', workTypeFilter === 'onsite', () => setWorkTypeFilter(workTypeFilter === 'onsite' ? 'All Types' : 'onsite'))}
            {filterBtn('Applied', statusFilter === 'applied', () => setStatusFilter(statusFilter === 'applied' ? 'all' : 'applied'))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {paginated.map(job => {
              const matchSkills = activeProfile.skills.filter(s => job.requirements.some(r => r.toLowerCase().includes(s.toLowerCase())))
              const matchScore = Math.min(100, Math.round((matchSkills.length / Math.max(job.requirements.length, 1)) * 100) + 15)

              return (
                <div key={job.id} className="job-card"
                  style={{ background: statusBg[job.status] || 'var(--card)', border: `1px solid ${statusBorder[job.status] || 'var(--border)'}`, borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onClick={() => setSelectedJob(job)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)' }}>{job.title}</span>
                        {job.status === 'applied' && <span style={{ padding: '1px 7px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, fontSize: 10, fontWeight: 700, color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>APPLIED</span>}
                        {job.status === 'dismissed' && <span style={{ padding: '1px 7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 10, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>DISMISSED</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-fg)' }}>
                        <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{job.company}</span>
                        <span>·</span>
                        <span>{job.location}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {/* Match score */}
                      <div style={{ textAlign: 'center' }}>
                        <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: matchScore >= 70 ? '#10b981' : matchScore >= 40 ? '#f59e0b' : '#ef4444' }}>{matchScore}%</div>
                        <div style={{ fontSize: 9, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: 'JetBrains Mono, monospace' }}>match</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: workTypeColor[job.workType] + '18', border: `1px solid ${workTypeColor[job.workType]}30`, borderRadius: 4, fontSize: 11, fontWeight: 600, color: workTypeColor[job.workType], fontFamily: 'JetBrains Mono, monospace' }}>{job.workType}</span>
                      <span style={{ padding: '2px 8px', background: (parserColor[job.parser] || '#64748b') + '18', borderRadius: 4, fontSize: 11, fontWeight: 500, color: parserColor[job.parser] || '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>via {job.parser}</span>
                      {job.salary && <span style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.1)', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>{job.salary}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{timeAgo(job.postedAt)}</span>
                      {job.status === 'new' && (
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleApply(job.id)}
                            style={{ padding: '5px 12px', background: 'var(--primary)', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'white' }}>Apply</button>
                          <button onClick={() => handleMarkApplied(job.id)}
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: 'var(--fg)' }}>Mark Applied</button>
                          <button onClick={() => startDismiss(job.id)}
                            style={{ padding: '5px 10px', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: '#ef4444' }}>Dismiss</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-fg)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <div style={{ fontSize: 14 }}>No jobs match your filters</div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: page === 1 ? 'default' : 'pointer', fontSize: 12, color: page === 1 ? 'var(--muted-fg)' : 'var(--fg)', opacity: page === 1 ? 0.5 : 1 }}>
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, background: p === page ? 'var(--primary)' : 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: p === page ? 700 : 400, color: p === page ? 'white' : 'var(--fg)' }}>{p}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: page === totalPages ? 'default' : 'pointer', fontSize: 12, color: page === totalPages ? 'var(--muted-fg)' : 'var(--fg)', opacity: page === totalPages ? 0.5 : 1 }}>
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline dismiss modal */}
      {dismissOpen && !selectedJob && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.target === e.currentTarget && setDismissOpen(false)}>
          <div style={{ width: 380, background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 12 }}>Dismiss Job</div>
            <textarea rows={3} placeholder="Reason for dismissal (required)…" value={dismissReason} onChange={e => setDismissReason(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, resize: 'none', outline: 'none', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmDismiss} disabled={!dismissReason.trim()}
                style={{ flex: 1, padding: '9px', background: dismissReason.trim() ? '#ef4444' : 'var(--secondary)', border: 'none', borderRadius: 6, cursor: dismissReason.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, color: dismissReason.trim() ? 'white' : 'var(--muted-fg)' }}>
                Confirm Dismiss
              </button>
              <button onClick={() => { setDismissOpen(false); setPendingDismissId(null) }}
                style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--fg)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          activeProfile={activeProfile}
          profiles={profiles}
          onApply={handleApply}
          onMarkApplied={handleMarkApplied}
          onDismiss={handleDismiss}
          showActions={true}
          dismissOpen={dismissOpen}
          setDismissOpen={setDismissOpen}
          dismissReason={dismissReason}
          setDismissReason={setDismissReason}
        />
      )}
    </div>
  )
}
