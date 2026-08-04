import { useState } from 'react'
import type { AppUser, Profile } from '@/app/page'
import JobDrawer, { type Job } from './JobDrawer'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
        className={`bg-[var(--card)] border border-[var(--border)] rounded-[9px] p-3 cursor-grab transition-all duration-150 ${dragItem === lead.id ? 'opacity-50' : 'opacity-100'} hover:border-[var(--border-strong)]`}
      >
        <div className="text-xs font-semibold text-[var(--fg)] mb-0.5">{lead.jobTitle}</div>
        <div className="text-xs text-[var(--muted-fg)] mb-2">{lead.company} · {lead.jobLocation}</div>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="px-1.75 py-0.5 rounded text-[10px] font-semibold font-mono" style={{ background: workTypeColor[lead.workType] + '18', border: `1px solid ${workTypeColor[lead.workType]}30`, color: workTypeColor[lead.workType] }}>
            {lead.workType}
          </Badge>
          <span className="font-mono text-[10px] text-[var(--muted-fg)]">{timeAgo(lead.appliedAt)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.25">
            <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-[8px] font-bold text-white">
              {lead.profileName.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="text-[11px] text-[var(--muted-fg)]">{lead.profileName.split(' ')[0]}</span>
          </div>
          {bd && <span className="text-[10px] text-[var(--muted-fg)]">→ {bd.name.split(' ')[0]}</span>}
        </div>
        {lead.bdNotes && (
          <div className="mt-2 p-1.5 px-2 bg-[var(--muted)] rounded text-[11px] text-[var(--muted-fg)] leading-relaxed border-l-2 border-[var(--primary)]">
            {lead.bdNotes}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedJob(lead) }}
          className="mt-2 w-full h-7 border border-[var(--border)] rounded text-[11px] text-[var(--muted-fg)] hover:text-[var(--fg)] hover:border-[var(--border-strong)] shadow-none">
          View Details
        </Button>
      </div>
    )
  }

  return (
    <div className="p-7 px-8 flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--fg)] m-0">Leads</h1>
          <p className="text-xs text-[var(--muted-fg)] mt-0.5 mb-0">{filtered.length} active leads</p>
        </div>
        <div className="flex gap-2">
          {(['list', 'board'] as const).map(v => (
            <Button key={v} onClick={() => setView(v)}
              className={`h-auto px-3.5 py-1.75 rounded-md cursor-pointer text-xs transition-colors shadow-none hover:bg-transparent ${
                view === v
                  ? 'bg-cyan-500/12 border border-cyan-500/30 font-semibold text-[var(--primary)]'
                  : 'bg-transparent border border-[var(--border-strong)] font-normal text-[var(--fg)] hover:border-gray-500'
              }`}>
              {v === 'list'
                ? <span className="flex items-center gap-1.25"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> List</span>
                : <span className="flex items-center gap-1.25"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Board</span>
              }
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-5 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <Input placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full py-2 pl-7.5 pr-2.5 bg-[var(--card)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={profileFilter} onValueChange={v => setProfileFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Profiles</SelectItem>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={bdFilter} onValueChange={v => setBdFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All BDs</SelectItem>
            {bdUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="flex-1 overflow-auto">
          <Table className="w-full border-collapse text-xs">
            <TableHeader>
              <TableRow className="border-b border-[var(--border)] hover:bg-transparent">
                {['Profile', 'Job Title', 'Company', 'Type', 'Status', 'Applied', 'Assigned BD', 'BD Notes', ''].map(h => (
                  <TableHead key={h} className="p-2 px-3 text-left text-[11px] font-semibold text-[var(--muted-fg)] uppercase tracking-[0.5px] font-mono whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => {
                const bd = users.find(u => u.id === l.assignedTo)
                return (
                  <TableRow key={l.id} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]">
                    <TableCell className="p-3 px-3">
                      <div className="flex items-center gap-1.75">
                        <div className="w-6.5 h-6.5 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {l.profileName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-medium text-[var(--fg)] whitespace-nowrap">{l.profileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 px-3 text-[var(--fg)] font-medium">{l.jobTitle}</TableCell>
                    <TableCell className="p-3 px-3 text-[var(--muted-fg)]">{l.company}</TableCell>
                    <TableCell className="p-3 px-3">
                      <span className="px-1.75 py-0.5 rounded text-[10px] font-semibold font-mono" style={{ background: workTypeColor[l.workType] + '18', border: `1px solid ${workTypeColor[l.workType]}30`, color: workTypeColor[l.workType] }}>{l.workType}</span>
                    </TableCell>
                    <TableCell className="p-3 px-3">
                      <Select value={l.status} onValueChange={s => updateStatus(l.id, s ?? 'Applied')}>
                        <SelectTrigger size="sm" className="h-auto px-2 py-0.75 rounded-md text-[11px] font-semibold cursor-pointer font-mono border"
                          style={{ background: statusBg[l.status], borderColor: statusColor[l.status] + '40', color: statusColor[l.status] }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-3 px-3 font-mono"><span className="text-[11px] text-[var(--muted-fg)]">{timeAgo(l.appliedAt)}</span></TableCell>
                    <TableCell className="p-3 px-3 text-[var(--muted-fg)] whitespace-nowrap">{bd?.name.split(' ')[0] ?? '—'}</TableCell>
                    <TableCell className="p-3 px-3 max-w-[200px] whitespace-normal">
                      {editingNote === l.id
                        ? <div className="flex gap-1.25">
                            <Input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNote(l.id); if (e.key === 'Escape') setEditingNote(null) }}
                              className="flex-1 h-auto p-1 px-1.75 bg-[var(--secondary)] border-[var(--primary)] rounded text-[var(--fg)] text-xs outline-none" />
                            <Button onClick={() => saveNote(l.id)} className="h-auto p-1 px-2 bg-[var(--primary)] border-none rounded cursor-pointer text-white text-[11px] shadow-none">✓</Button>
                          </div>
                        : <div onClick={() => { setEditingNote(l.id); setNoteText(l.bdNotes) }} className={`cursor-text text-xs leading-normal max-h-10 overflow-hidden ${l.bdNotes ? 'text-[var(--fg)]' : 'text-[var(--muted-fg)]'}`}>
                            {l.bdNotes || <span className="italic text-[11px]">Add note…</span>}
                          </div>
                      }
                    </TableCell>
                    <TableCell className="p-3 px-3">
                      <Button onClick={() => setSelectedJob(l)}
                        className="h-auto p-1 px-2.5 bg-transparent border border-[var(--border-strong)] rounded-md cursor-pointer text-[11px] text-[var(--primary)] hover:bg-transparent hover:underline shadow-none">View</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && <div className="text-center py-10 text-[var(--muted-fg)] text-sm">No leads match your filters</div>}
        </div>
      )}

      {/* Board View */}
      {view === 'board' && (
        <div className="flex-1 overflow-auto">
          <div className="flex gap-3.5 min-w-max h-full">
            {STATUSES.map(status => {
              const columnLeads = filtered.filter(l => l.status === status)
              return (
                <div key={status}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, status)}
                  className="w-[240px] flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                    <div className="flex items-center gap-1.75">
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor[status] }} />
                      <span className="text-xs font-semibold text-[var(--fg)]">{status}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--muted-fg)] bg-[var(--secondary)] px-1.75 py-0.25 rounded-full">{columnLeads.length}</span>
                  </div>
                  <div
                    className="flex-1 min-h-[200px] p-2 bg-[var(--muted)] rounded-lg border border-[var(--border)] flex flex-col gap-2 overflow-y-auto transition-all duration-150"
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = statusColor[status] }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    onDrop={e => { e.currentTarget.style.borderColor = 'var(--border)'; handleDrop(e, status) }}
                  >
                    {columnLeads.map(l => <LeadCard key={l.id} lead={l} />)}
                    {columnLeads.length === 0 && (
                      <div className="py-5 text-center text-[var(--muted-fg)] text-xs">Drop here</div>
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
