import { useState } from 'react'
import type { AppUser, Profile } from '@/app/page'
import JobDrawer, { type Job } from './JobDrawer'

const STATUSES = ['Applied', 'Screening', 'Interview', 'Technical', 'Offer', 'Closed']
const statusColor: Record<string, string> = {
  Applied: '#6366f1', Screening: '#f59e0b', Interview: '#06b6d4',
  Technical: '#ec4899', Offer: '#10b981', Closed: '#64748b',
}
const statusBg: Record<string, string> = {
  Applied: 'rgba(99,102,241,0.1)', Screening: 'rgba(245,158,11,0.1)',
  Interview: 'rgba(6,182,212,0.1)', Technical: 'rgba(236,72,153,0.1)',
  Offer: 'rgba(16,185,129,0.1)', Closed: 'rgba(100,116,139,0.1)',
}

export interface Lead {
  id: string
  profileId: string
  profileName: string
  jobTitle: string
  company: string
  jobLocation: string
  workType: 'remote' | 'onsite' | 'hybrid'
  appliedAt: string
  status: string
  assignedTo: string
  bdNotes: string
  salary: string
  parser: string
}

const MOCK_LEADS: Lead[] = [
  { id: 'l1', profileId: 'p1', profileName: 'Sarah Chen', jobTitle: 'Senior Frontend Engineer', company: 'Vercel', jobLocation: 'Remote', workType: 'remote', appliedAt: '2026-07-28', status: 'Interview', assignedTo: 'u2', bdNotes: 'Strong interest from hiring manager. Technical round scheduled for next week.', salary: '$150k – $185k', parser: 'LinkedIn' },
  { id: 'l2', profileId: 'p2', profileName: 'Marcus Webb', jobTitle: 'Staff Software Engineer', company: 'Linear', jobLocation: 'Remote', workType: 'remote', appliedAt: '2026-07-25', status: 'Screening', assignedTo: 'u3', bdNotes: 'Initial call went well. Waiting on recruiter response.', salary: '$200k – $240k', parser: 'Greenhouse' },
  { id: 'l3', profileId: 'p3', profileName: 'Priya Nair', jobTitle: 'Senior Backend Engineer', company: 'Stripe', jobLocation: 'New York, NY', workType: 'hybrid', appliedAt: '2026-07-20', status: 'Technical', assignedTo: 'u2', bdNotes: 'Completed phone screen. Technical challenge submitted.', salary: '$160k – $200k', parser: 'LinkedIn' },
  { id: 'l4', profileId: 'p5', profileName: 'Nia Okonkwo', jobTitle: 'Senior React Native Engineer', company: 'Spotify', jobLocation: 'Stockholm', workType: 'hybrid', appliedAt: '2026-07-18', status: 'Offer', assignedTo: 'u2', bdNotes: 'Offer received! €125k + equity. Negotiation in progress.', salary: '€110k – €140k', parser: 'LinkedIn' },
  { id: 'l5', profileId: 'p1', profileName: 'Sarah Chen', jobTitle: 'Engineering Manager – Frontend', company: 'Figma', jobLocation: 'San Francisco', workType: 'hybrid', appliedAt: '2026-07-15', status: 'Applied', assignedTo: 'u3', bdNotes: '', salary: '$220k – $270k', parser: 'Greenhouse' },
  { id: 'l6', profileId: 'p2', profileName: 'Marcus Webb', jobTitle: 'Principal Engineer – Platform', company: 'Shopify', jobLocation: 'Remote', workType: 'remote', appliedAt: '2026-07-10', status: 'Closed', assignedTo: 'u2', bdNotes: 'Position filled internally.', salary: 'CAD $220k – $280k', parser: 'Workday' },
  { id: 'l7', profileId: 'p4', profileName: 'Jordan Kim', jobTitle: 'Principal Infrastructure Engineer', company: 'Cloudflare', jobLocation: 'Remote', workType: 'remote', appliedAt: '2026-08-01', status: 'Screening', assignedTo: 'u3', bdNotes: 'Very strong match on Rust + distributed systems.', salary: '$210k – $260k', parser: 'Lever' },
  { id: 'l8', profileId: 'p3', profileName: 'Priya Nair', jobTitle: 'ML Infrastructure Engineer', company: 'Anthropic', jobLocation: 'San Francisco', workType: 'onsite', appliedAt: '2026-08-02', status: 'Applied', assignedTo: 'u3', bdNotes: '', salary: '$180k – $220k', parser: 'Indeed' },
]

function timeAgo(date: string): string {
  const diff = (Date.now() - new Date(date).getTime()) / 1000
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const d = Math.floor(diff / 86400)
  return d === 1 ? '1 day ago' : `${d} days ago`
}

const workTypeColor: Record<string, string> = { remote: '#10b981', onsite: '#6366f1', hybrid: '#f59e0b' }

interface Props {
  users: AppUser[]
  currentUser: AppUser
  profiles: Profile[]
}

export default function LeadsTab({ users, profiles }: Props) {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [profileFilter, setProfileFilter] = useState('all')
  const [bdFilter, setBdFilter] = useState('all')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [dragItem, setDragItem] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<Lead | null>(null)

  const bdUsers = users.filter(u => u.role === 'bd' || u.role === 'lead')

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchQ = !q || l.jobTitle.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || l.profileName.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const matchProfile = profileFilter === 'all' || l.profileId === profileFilter
    const matchBD = bdFilter === 'all' || l.assignedTo === bdFilter
    return matchQ && matchStatus && matchProfile && matchBD
  })

  const updateStatus = (id: string, status: string) => setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l))
  const saveNote = (id: string) => { setLeads(ls => ls.map(l => l.id === id ? { ...l, bdNotes: noteText } : l)); setEditingNote(null) }

  const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('leadId', id); setDragItem(id) }
  const handleDrop = (e: React.DragEvent, status: string) => { e.preventDefault(); const id = e.dataTransfer.getData('leadId'); updateStatus(id, status); setDragItem(null) }
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const mockJobForLead = (l: Lead): Job => ({
    id: l.id, title: l.jobTitle, company: l.company, location: l.jobLocation,
    workType: l.workType, postedAt: new Date(l.appliedAt), salary: l.salary,
    description: `${l.company} is looking for a ${l.jobTitle} to join their team.`,
    requirements: ['Relevant experience', 'Strong communication skills'],
    niceToHave: [], parser: l.parser, status: 'applied', applyUrl: '#',
    companySize: '1,001–5,000', companyIndustry: 'Technology', experienceLevel: l.jobTitle.split(' ')[0],
  })

  const activeProfile = profiles[0]

  const LeadCard = ({ lead }: { lead: Lead }) => {
    const bd = users.find(u => u.id === lead.assignedTo)
    return (
      <div
        draggable
        onDragStart={e => handleDragStart(e, lead.id)}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 9,
          padding: '12px 14px', cursor: 'grab', opacity: dragItem === lead.id ? 0.5 : 1,
          transition: 'all 0.12s ease',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', marginBottom: 2 }}>{lead.jobTitle}</div>
        <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginBottom: 8 }}>{lead.company} · {lead.jobLocation}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ padding: '2px 7px', background: workTypeColor[lead.workType] + '18', border: `1px solid ${workTypeColor[lead.workType]}30`, borderRadius: 4, fontSize: 10, fontWeight: 600, color: workTypeColor[lead.workType], fontFamily: 'JetBrains Mono, monospace' }}>{lead.workType}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--muted-fg)' }}>{timeAgo(lead.appliedAt)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white' }}>
              {lead.profileName.split(' ').map(n => n[0]).join('')}
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{lead.profileName.split(' ')[0]}</span>
          </div>
          {bd && <span style={{ fontSize: 10, color: 'var(--muted-fg)' }}>→ {bd.name.split(' ')[0]}</span>}
        </div>
        {lead.bdNotes && (
          <div style={{ marginTop: 8, padding: '6px 8px', background: 'var(--muted)', borderRadius: 5, fontSize: 11, color: 'var(--muted-fg)', lineHeight: 1.5, borderLeft: '2px solid var(--primary)' }}>
            {lead.bdNotes}
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); setSelectedJob(lead) }}
          style={{ marginTop: 8, width: '100%', padding: '5px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: 'var(--muted-fg)' }}>
          View Details
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-fg)', margin: '3px 0 0' }}>{filtered.length} active leads</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['list', 'board'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '7px 14px', background: view === v ? 'rgba(6,182,212,0.12)' : 'transparent', border: view === v ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: view === v ? 600 : 400, color: view === v ? 'var(--primary)' : 'var(--fg)' }}>
              {v === 'list'
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> List</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Board</span>
              }
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, minWidth: 140 }}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={profileFilter} onChange={e => setProfileFilter(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, minWidth: 150 }}>
          <option value="all">All Profiles</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={bdFilter} onChange={e => setBdFilter(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, minWidth: 140 }}>
          <option value="all">All BDs</option>
          {bdUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Profile', 'Job Title', 'Company', 'Type', 'Status', 'Applied', 'Assigned BD', 'BD Notes', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const bd = users.find(u => u.id === l.assignedTo)
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {l.profileName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span style={{ fontWeight: 500, color: 'var(--fg)', whiteSpace: 'nowrap' }}>{l.profileName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--fg)', fontWeight: 500 }}>{l.jobTitle}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--muted-fg)' }}>{l.company}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ padding: '2px 7px', background: workTypeColor[l.workType] + '18', border: `1px solid ${workTypeColor[l.workType]}30`, borderRadius: 4, fontSize: 10, fontWeight: 600, color: workTypeColor[l.workType], fontFamily: 'JetBrains Mono, monospace' }}>{l.workType}</span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <select value={l.status} onChange={e => updateStatus(l.id, e.target.value)}
                        style={{ padding: '3px 8px', background: statusBg[l.status], border: `1px solid ${statusColor[l.status]}40`, borderRadius: 5, fontSize: 11, fontWeight: 600, color: statusColor[l.status], cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '12px 12px' }} className="mono"><span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{timeAgo(l.appliedAt)}</span></td>
                    <td style={{ padding: '12px 12px', color: 'var(--muted-fg)', whiteSpace: 'nowrap' }}>{bd?.name.split(' ')[0] ?? '—'}</td>
                    <td style={{ padding: '12px 12px', maxWidth: 200 }}>
                      {editingNote === l.id
                        ? <div style={{ display: 'flex', gap: 5 }}>
                            <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNote(l.id); if (e.key === 'Escape') setEditingNote(null) }}
                              style={{ flex: 1, padding: '4px 7px', background: 'var(--secondary)', border: '1px solid var(--primary)', borderRadius: 4, color: 'var(--fg)', fontSize: 12, outline: 'none' }} />
                            <button onClick={() => saveNote(l.id)} style={{ padding: '4px 8px', background: 'var(--primary)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'white', fontSize: 11 }}>✓</button>
                          </div>
                        : <div onClick={() => { setEditingNote(l.id); setNoteText(l.bdNotes) }} style={{ cursor: 'text', color: l.bdNotes ? 'var(--fg)' : 'var(--muted-fg)', fontSize: 12, lineHeight: 1.4, maxHeight: 40, overflow: 'hidden' }}>
                            {l.bdNotes || <span style={{ fontStyle: 'italic', fontSize: 11 }}>Add note…</span>}
                          </div>
                      }
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <button onClick={() => setSelectedJob(l)}
                        style={{ padding: '4px 10px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: 'var(--primary)' }}>View</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted-fg)', fontSize: 14 }}>No leads match your filters</div>}
        </div>
      )}

      {/* Board View */}
      {view === 'board' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ display: 'flex', gap: 14, minWidth: 'max-content', height: '100%' }}>
            {STATUSES.map(status => {
              const columnLeads = filtered.filter(l => l.status === status)
              return (
                <div key={status}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, status)}
                  style={{ width: 240, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[status] }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{status}</span>
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted-fg)', background: 'var(--secondary)', padding: '1px 7px', borderRadius: 10 }}>{columnLeads.length}</span>
                  </div>
                  <div
                    style={{
                      flex: 1, minHeight: 200, padding: '8px', background: 'var(--muted)', borderRadius: 10,
                      border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8,
                      overflowY: 'auto', transition: 'all 0.15s ease',
                    }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = statusColor[status] }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    onDrop={e => { e.currentTarget.style.borderColor = 'var(--border)'; handleDrop(e, status) }}
                  >
                    {columnLeads.map(l => <LeadCard key={l.id} lead={l} />)}
                    {columnLeads.length === 0 && (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--muted-fg)', fontSize: 12 }}>Drop here</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedJob && (
        <JobDrawer
          job={mockJobForLead(selectedJob)}
          onClose={() => setSelectedJob(null)}
          activeProfile={activeProfile}
          profiles={profiles}
          showActions={false}
        />
      )}
    </div>
  )
}
