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
    <button
      onClick={onClick}
      className={`px-3 py-1.2 rounded-md cursor-pointer text-xs whitespace-nowrap transition-colors ${
        active
          ? 'bg-cyan-500/10 border border-cyan-500/30 font-semibold text-[var(--primary)]'
          : 'bg-transparent border border-[var(--border-strong)] font-normal text-[var(--fg)] hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Filters Panel */}
      <div className="w-[230px] border-r border-[var(--border)] p-6 overflow-y-auto shrink-0 bg-[var(--muted)]">
        <div className="text-xs font-bold text-[var(--fg)] mb-4 flex items-center justify-between">
          Filters
          <button
            onClick={() => {
              setSearch('')
              setParserFilter('All Sources')
              setWorkTypeFilter('All Types')
              setExpFilter('All Levels')
              setStatusFilter('all')
            }}
            className="bg-transparent border-none cursor-pointer text-[11px] text-[var(--primary)] hover:underline"
          >
            Clear all
          </button>
        </div>

        {/* Status */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Status
          </div>
          <div className="flex flex-col gap-1">
            {[
              ['all', 'All Jobs'],
              ['new', 'New'],
              ['applied', 'Applied'],
              ['dismissed', 'Dismissed'],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`px-2.5 py-1.5 border-none rounded cursor-pointer text-xs text-left ${
                  statusFilter === v
                    ? 'bg-cyan-500/10 font-semibold text-[var(--primary)]'
                    : 'bg-transparent font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Work Type */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Work Type
          </div>
          <div className="flex flex-col gap-1">
            {WORK_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setWorkTypeFilter(t)}
                className={`px-2.5 py-1.5 border-none rounded cursor-pointer text-xs text-left flex items-center gap-1.5 ${
                  workTypeFilter === t
                    ? 'bg-cyan-500/10 font-semibold text-[var(--primary)]'
                    : 'bg-transparent font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {t !== 'All Types' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: workTypeColor[t] }}
                  />
                )}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Parser Source */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Source Parser
          </div>
          <div className="flex flex-col gap-1">
            {PARSERS.map(p => (
              <button
                key={p}
                onClick={() => setParserFilter(p)}
                className={`px-2.5 py-1.5 border-none rounded cursor-pointer text-xs text-left ${
                  parserFilter === p
                    ? 'bg-cyan-500/10 font-semibold text-[var(--primary)]'
                    : 'bg-transparent font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-2 uppercase tracking-[0.6px]">
            Experience Level
          </div>
          <div className="flex flex-col gap-1">
            {EXPERIENCE.map(e => (
              <button
                key={e}
                onClick={() => setExpFilter(e)}
                className={`px-2.5 py-1.5 border-none rounded cursor-pointer text-xs text-left ${
                  expFilter === e
                    ? 'bg-cyan-500/10 font-semibold text-[var(--primary)]'
                    : 'bg-transparent font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Job List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-7 pt-6 pb-0 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-[22px] font-bold text-[var(--fg)] m-0">Discovery</h1>
              <p className="text-xs text-[var(--muted-fg)] mt-0.5 mb-0">{filtered.length} jobs found</p>
            </div>
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--muted-fg)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                placeholder="Search jobs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="py-2.25 pl-8 pr-2.5 bg-[var(--card)] border border-[var(--border-strong)] rounded-[7px] text-[var(--fg)] text-xs outline-none w-[220px] focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {/* Quick filter pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-3.5">
            {filterBtn('All', statusFilter === 'all', () => setStatusFilter('all'))}
            {filterBtn('Remote', workTypeFilter === 'remote', () =>
              setWorkTypeFilter(workTypeFilter === 'remote' ? 'All Types' : 'remote')
            )}
            {filterBtn('Hybrid', workTypeFilter === 'hybrid', () =>
              setWorkTypeFilter(workTypeFilter === 'hybrid' ? 'All Types' : 'hybrid')
            )}
            {filterBtn('Onsite', workTypeFilter === 'onsite', () =>
              setWorkTypeFilter(workTypeFilter === 'onsite' ? 'All Types' : 'onsite')
            )}
            {filterBtn('Applied', statusFilter === 'applied', () =>
              setStatusFilter(statusFilter === 'applied' ? 'all' : 'applied')
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-7 pb-6">
          <div className="flex flex-col gap-2.5">
            {paginated.map(job => {
              const matchSkills = activeProfile.skills.filter(s =>
                job.requirements.some(r => r.toLowerCase().includes(s.toLowerCase()))
              )
              const matchScore = Math.min(
                100,
                Math.round((matchSkills.length / Math.max(job.requirements.length, 1)) * 100) + 15
              )

              return (
                <div
                  key={job.id}
                  className="job-card rounded-[10px] px-4.5 py-4 cursor-pointer transition-all duration-150 ease-in-out"
                  style={{
                    background: statusBg[job.status] || 'var(--card)',
                    border: `1px solid ${statusBorder[job.status] || 'var(--border)'}`,
                  }}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[15px] font-semibold text-[var(--fg)]">{job.title}</span>
                        {job.status === 'applied' && (
                          <span className="px-1.75 py-0.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-[10px] font-bold text-emerald-500 font-mono">
                            APPLIED
                          </span>
                        )}
                        {job.status === 'dismissed' && (
                          <span className="px-1.75 py-0.5 bg-red-500/10 border border-red-500/25 rounded-full text-[10px] font-bold text-red-500 font-mono">
                            DISMISSED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-fg)]">
                        <span className="font-medium text-[var(--fg)]">{job.company}</span>
                        <span>·</span>
                        <span>{job.location}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Match score */}
                      <div className="text-center">
                        <div
                          className={`font-mono text-[15px] font-bold ${
                            matchScore >= 70
                              ? 'text-emerald-500'
                              : matchScore >= 40
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {matchScore}%
                        </div>
                        <div className="text-[9px] text-[var(--muted-fg)] uppercase tracking-[0.4px] font-mono">
                          match
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono"
                        style={{
                          background: workTypeColor[job.workType] + '18',
                          border: `1px solid ${workTypeColor[job.workType]}30`,
                          color: workTypeColor[job.workType],
                        }}
                      >
                        {job.workType}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-medium font-mono"
                        style={{
                          background: (parserColor[job.parser] || '#64748b') + '18',
                          color: parserColor[job.parser] || '#64748b',
                        }}
                      >
                        via {job.parser}
                      </span>
                      {job.salary && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 rounded text-[11px] font-semibold text-emerald-500 font-mono">
                          {job.salary}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-[var(--muted-fg)]">
                        {timeAgo(job.postedAt)}
                      </span>
                      {job.status === 'new' && (
                        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleApply(job.id)}
                            className="px-3 py-1.25 bg-[var(--primary)] border-none rounded-md cursor-pointer text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => handleMarkApplied(job.id)}
                            className="px-2.5 py-1.25 bg-transparent border border-[var(--border-strong)] rounded-md cursor-pointer text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          >
                            Mark Applied
                          </button>
                          <button
                            onClick={() => startDismiss(job.id)}
                            className="px-2.5 py-1.25 bg-transparent border border-red-500/30 rounded-md cursor-pointer text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-15 text-[var(--muted-fg)]">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto mb-3 block"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <div className="text-sm">No jobs match your filters</div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1.5 bg-[var(--card)] border border-[var(--border-strong)] rounded-md text-xs transition-opacity ${
                  page === 1
                    ? 'cursor-default text-[var(--muted-fg)] opacity-50'
                    : 'cursor-pointer text-[var(--fg)] opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 border border-[var(--border-strong)] rounded-md cursor-pointer text-xs transition-colors ${
                    p === page
                      ? 'bg-[var(--primary)] font-bold text-white border-[var(--primary)]'
                      : 'bg-[var(--card)] font-normal text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1.5 bg-[var(--card)] border border-[var(--border-strong)] rounded-md text-xs transition-opacity ${
                  page === totalPages
                    ? 'cursor-default text-[var(--muted-fg)] opacity-50'
                    : 'cursor-pointer text-[var(--fg)] opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline dismiss modal */}
      {dismissOpen && !selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={e => e.target === e.currentTarget && setDismissOpen(false)}
        >
          <div className="w-[380px] bg-[var(--card)] border border-[var(--border-strong)] rounded-lg p-5 shadow-2xl">
            <div className="text-[15px] font-semibold text-[var(--fg)] mb-3">Dismiss Job</div>
            <textarea
              rows={3}
              placeholder="Reason for dismissal (required)…"
              value={dismissReason}
              onChange={e => setDismissReason(e.target.value)}
              className="w-full p-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-none outline-none mb-3 focus:border-[var(--primary)]"
            />
            <div className="flex gap-2.5">
              <button
                onClick={confirmDismiss}
                disabled={!dismissReason.trim()}
                className={`flex-1 p-2.25 border-none rounded-md text-xs font-semibold transition-colors ${
                  dismissReason.trim()
                    ? 'bg-red-500 text-white cursor-pointer hover:bg-red-600'
                    : 'bg-[var(--secondary)] text-[var(--muted-fg)] cursor-default'
                }`}
              >
                Confirm Dismiss
              </button>
              <button
                onClick={() => {
                  setDismissOpen(false)
                  setPendingDismissId(null)
                }}
                className="flex-1 p-2.25 bg-transparent border border-[var(--border-strong)] rounded-md cursor-pointer text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
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

