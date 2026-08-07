"use client"
import { useState } from 'react'
import { LayoutGrid, List } from 'lucide-react'
import JobDrawer, { type Job } from '@/components/job-drawer'
import { Avatar } from "@/components/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchInput } from "@/components/search-input"
import { TintedBadge } from "@/components/tinted-badge"
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
import {
  LEAD_STATUS_BG,
  LEAD_STATUS_COLOR,
  LEAD_STATUSES,
  WORK_TYPE_COLOR,
} from "@/lib/constants"
import { timeAgo } from "@/lib/format"

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

// Minimal mock shapes used only while this tab renders static data (the
// leads API doesn't exist yet). Kept local so the app shell stays clean.
type MockUser = { id: string; name: string; role: 'admin' | 'lead' | 'bd' }
type MockProfile = { id: string; name: string }

const MOCK_USERS: MockUser[] = [
  { id: 'u1', name: 'Alex Rivera', role: 'admin' },
  { id: 'u2', name: 'Jamie Park', role: 'bd' },
  { id: 'u3', name: 'Morgan Lee', role: 'bd' },
  { id: 'u4', name: 'Casey Torres', role: 'lead' },
  { id: 'u5', name: 'Dana Shah', role: 'bd' },
]

const MOCK_PROFILES: MockProfile[] = [
  { id: 'p1', name: 'Sarah Chen' },
  { id: 'p2', name: 'Marcus Webb' },
  { id: 'p3', name: 'Priya Nair' },
  { id: 'p4', name: 'Jordan Kim' },
  { id: 'p5', name: 'Nia Okonkwo' },
]

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

export default function LeadsTab() {
  const users = MOCK_USERS
  const profiles = MOCK_PROFILES
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
    // Job.workType is "remote" | "onsite" — jobs.is_remote is boolean in the DB, no hybrid yet.
    workType: l.workType === 'hybrid' ? 'onsite' : l.workType, postedAt: l.appliedAt,
    description: `${l.company} is looking for a ${l.jobTitle} to join their team.`,
    parser: l.parser, status: 'applied', applyUrl: '#',
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
          <TintedBadge color={WORK_TYPE_COLOR[lead.workType]}>{lead.workType}</TintedBadge>
          <span className="font-mono text-[10px] text-[var(--muted-fg)]">{timeAgo(lead.appliedAt)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-1.25">
            <Avatar name={lead.profileName} size={18} />
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
              <span className="flex items-center gap-1.25">
                {v === 'list' ? <List size={12} /> : <LayoutGrid size={12} />}
                {v === 'list' ? 'List' : 'Board'}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-5 shrink-0 flex-wrap">
        <SearchInput
          placeholder="Search leads…"
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-[180px]"
        />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                        <Avatar name={l.profileName} size={26} />
                        <span className="font-medium text-[var(--fg)] whitespace-nowrap">{l.profileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 px-3 text-[var(--fg)] font-medium">{l.jobTitle}</TableCell>
                    <TableCell className="p-3 px-3 text-[var(--muted-fg)]">{l.company}</TableCell>
                    <TableCell className="p-3 px-3">
                      <TintedBadge color={WORK_TYPE_COLOR[l.workType]}>{l.workType}</TintedBadge>
                    </TableCell>
                    <TableCell className="p-3 px-3">
                      <Select value={l.status} onValueChange={s => updateStatus(l.id, s ?? 'Applied')}>
                        <SelectTrigger size="sm" className="h-auto px-2 py-0.75 rounded-md text-[11px] font-semibold cursor-pointer font-mono border"
                          style={{ background: LEAD_STATUS_BG[l.status], borderColor: LEAD_STATUS_COLOR[l.status] + '40', color: LEAD_STATUS_COLOR[l.status] }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            {LEAD_STATUSES.map(status => {
              const columnLeads = filtered.filter(l => l.status === status)
              return (
                <div key={status}
                  onDragOver={handleDragOver}
                  onDrop={e => handleDrop(e, status)}
                  className="w-[240px] flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-2.5 px-0.5">
                    <div className="flex items-center gap-1.75">
                      <div className="w-2 h-2 rounded-full" style={{ background: LEAD_STATUS_COLOR[status] }} />
                      <span className="text-xs font-semibold text-[var(--fg)]">{status}</span>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--muted-fg)] bg-[var(--secondary)] px-1.75 py-0.25 rounded-full">{columnLeads.length}</span>
                  </div>
                  <div
                    className="flex-1 min-h-[200px] p-2 bg-[var(--muted)] rounded-lg border border-[var(--border)] flex flex-col gap-2 overflow-y-auto transition-all duration-150"
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = LEAD_STATUS_COLOR[status] }}
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
          showActions={false}
        />
      )}
    </div>
  )
}
