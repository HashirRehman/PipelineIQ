import { useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import { FileText, MapPin, Plus, Upload, Users, X } from 'lucide-react'
import type { Profile, AppUser, Resume } from '@/app/page'
import { Avatar } from "@/components/avatar"
import { TintedBadge } from "@/components/tinted-badge"
import { SearchInput } from "@/components/search-input"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer"
import { PROFILE_STATUS_COLOR } from "@/lib/constants"

const SENIORITY = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Staff']
const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD']
const STATUSES: Profile['status'][] = ['active', 'inactive', 'archived']

const emptyProfile: Omit<Profile, 'id' | 'createdAt' | 'resumes' | 'assignedBDs'> = {
  name: '', email: '', phone: '', location: '', seniority: 'Mid', yearsExp: 0,
  rate: 0, rateCurrency: 'USD', summary: '', skills: [], status: 'active',
}

const MOCK_PARSED = {
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
  experience: ['2022–Present: Senior Engineer, Stripe', '2019–2022: Frontend Engineer, Airbnb', '2017–2019: Software Engineer, Startup'],
  education: ['B.S. Computer Science, Stanford University (2017)'],
  summary: 'Full-stack engineer with 7+ years building high-scale web products in fintech and travel.',
}

interface FormData extends Omit<Profile, 'id' | 'createdAt' | 'resumes'> {
  skillInput: string
}

interface DetailDrawerProps {
  profile: Profile
  onClose: () => void
  onUpdate: (p: Profile) => void
  users: AppUser[]
}

function DetailDrawer({ profile, onClose, onUpdate, users }: DetailDrawerProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormData>({ ...profile, assignedBDs: profile.assignedBDs ?? [], skillInput: '' })
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewResume, setPreviewResume] = useState<Resume | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const bdUsers = users.filter(u => u.role === 'bd' || u.role === 'lead')

  const handleSave = () => {
    const { skillInput, ...rest } = form
    onUpdate({ ...profile, ...rest })
    setEditing(false)
  }

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && form.skillInput.trim()) {
      setForm(f => ({ ...f, skills: [...f.skills, f.skillInput.trim()], skillInput: '' }))
    }
  }

  const simulateUpload = (filename: string, size: string) => {
    setUploading(true)
    setTimeout(() => {
      const resume: Resume = {
        id: Date.now().toString(), filename, size,
        uploadedAt: new Date().toISOString(),
        parsed: MOCK_PARSED,
      }
      onUpdate({ ...profile, resumes: [...profile.resumes, resume] })
      setPreviewResume(resume)
      setUploading(false)
    }, 1400)
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const f = files[0]
    const kb = (f.size / 1024).toFixed(0)
    simulateUpload(f.name, `${kb} KB`)
  }

  const toggleBD = (userId: string) => {
    const current = form.assignedBDs || []
    const updated = current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId]
    setForm(f => ({ ...f, assignedBDs: updated }))
    onUpdate({ ...profile, assignedBDs: updated })
  }

  const inp = (label: string, key: keyof FormData, type = 'text') => (
    <div>
      <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">{label}</div>
      {editing
        ? <Input type={type} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
            className="w-full p-1.75 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
        : <div className="text-xs text-[var(--fg)] py-1">{String(form[key] ?? '—')}</div>
      }
    </div>
  )

  return (
    <Drawer open swipeDirection="right" showSwipeHandle onOpenChange={(open) => { if (!open) onClose() }}>
      <DrawerContent
        style={{ "--drawer-content-width": "560px" } as CSSProperties}
        className="rounded-none! border-[var(--border)] bg-[var(--card)] text-[var(--fg)]"
      >
          {/* Header */}
          <div className="p-4.5 px-6 border-b border-[var(--border)] flex items-center gap-3.5 shrink-0">
            <Avatar name={profile.name} size={44} />
            <div className="flex-1 min-w-0">
              <div className="text-5xl font-semibold text-[var(--fg)] text-[17px]">{profile.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <TintedBadge color={PROFILE_STATUS_COLOR[profile.status]}>{profile.status}</TintedBadge>
                <TintedBadge color="#6366f1">{profile.seniority}</TintedBadge>
                <span className="font-mono text-[11px] text-[var(--muted-fg)]">{profile.rateCurrency}{profile.rate}/hr</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => editing ? handleSave() : setEditing(true)}
                className={`h-auto p-1.75 px-3.5 border-none rounded-md cursor-pointer text-xs font-semibold shadow-none ${editing ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]' : 'bg-[var(--secondary)] text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'}`}>
                {editing ? 'Save' : 'Edit'}
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-[var(--muted-fg)] hover:text-[var(--fg)]">
                <X size={14} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5 px-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-3.5 mb-5">
              {inp('Full Name', 'name')}
              {inp('Email', 'email', 'email')}
              {inp('Phone', 'phone')}
              {inp('Location', 'location')}
              <div>
                <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Seniority Level</div>
                {editing
                  ? <Select value={form.seniority} onValueChange={v => setForm(f => ({ ...f, seniority: v ?? 'Mid' }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SENIORITY.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  : <div className="text-xs text-[var(--fg)] py-1">{form.seniority}</div>
                }
              </div>
              {inp('Years of Experience', 'yearsExp', 'number')}
              <div>
                <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Rate ({form.rateCurrency})</div>
                {editing
                  ? <div className="flex gap-1.5">
                      <Select value={form.rateCurrency} onValueChange={v => setForm(f => ({ ...f, rateCurrency: v ?? 'USD' }))}>
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: Number(e.target.value) }))}
                        className="flex-1 p-1.75 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs" />
                    </div>
                  : <div className="text-xs text-[var(--fg)] py-1">{form.rateCurrency}{form.rate}/hr</div>
                }
              </div>
              <div>
                <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Status</div>
                {editing
                  ? <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: (v ?? 'active') as Profile['status'] }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  : <TintedBadge color={PROFILE_STATUS_COLOR[form.status]}>{form.status}</TintedBadge>
                }
              </div>
            </div>

            {/* Summary */}
            <div className="mb-5">
              <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Summary</div>
              {editing
                ? <Textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                    className="w-full p-2 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-y" />
                : <p className="text-xs text-[var(--fg)] leading-relaxed m-0">{form.summary}</p>
              }
            </div>

            {/* Skills */}
            <div className="mb-5">
              <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-2">Skills</div>
              <div className={`flex flex-wrap gap-1.5 ${editing ? 'mb-2' : 'mb-0'}`}>
                {form.skills.map((s, i) => (
                  <TintedBadge key={i} color="#06b6d4" className="inline-flex items-center gap-1.25">
                    {s}
                    {editing && <Button onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))}
                      className="h-auto p-0 bg-transparent border-none cursor-pointer text-[var(--muted-fg)] leading-none text-xs hover:text-[var(--fg)] shadow-none">×</Button>}
                  </TintedBadge>
                ))}
              </div>
              {editing && (
                <Input placeholder="Add skill (press Enter)" value={form.skillInput} onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))} onKeyDown={handleAddSkill}
                  className="p-1.5 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none w-full" />
              )}
            </div>

            {/* BD Assignment */}
            <div className="mb-5 p-3.5 px-4 bg-[var(--muted)] rounded-lg border border-[var(--border)]">
              <div className="text-xs font-semibold text-[var(--fg)] mb-3">Assigned Business Developers</div>
              <div className="flex flex-col gap-2">
                {bdUsers.map(u => {
                  const assigned = (form.assignedBDs || []).includes(u.id)
                  return (
                    <div key={u.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {assigned
                          ? <Avatar name={u.name} size={28} />
                          : <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[var(--secondary)] text-[var(--muted-fg)]">
                              {u.name.split(' ').map(n => n[0]).join('')}
                            </div>
                        }
                        <div>
                          <div className="text-xs font-medium text-[var(--fg)]">{u.name}</div>
                          <div className="font-mono text-[10px] text-[var(--muted-fg)]">{u.role} · {u.email}</div>
                        </div>
                      </div>
                      <Button onClick={() => toggleBD(u.id)}
                        className={`h-auto p-1 px-2.5 rounded-md cursor-pointer text-[11px] font-semibold border shadow-none ${assigned ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/10' : 'bg-cyan-500/10 border-cyan-500/30 text-[var(--primary)] hover:bg-cyan-500/10'}`}>
                        {assigned ? 'Remove' : 'Assign'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resume Upload */}
            <div className="mb-5">
              <div className="text-xs font-semibold text-[var(--fg)] mb-2.5">Resumes</div>
              <div
                className={`border-1.5 border-dashed border-[var(--border-strong)] rounded-lg p-5 text-center cursor-pointer transition-all duration-150 ${dragOver ? 'bg-cyan-500/5' : 'bg-[var(--muted)]'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => handleFiles(e.target.files)} />
                {uploading
                  ? <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-[var(--muted-fg)]">Parsing resume…</span>
                    </div>
                  : <>
                      <Upload size={24} strokeWidth={1.5} className="mx-auto mb-2 text-[var(--muted-fg)]" />
                      <div className="text-xs text-[var(--muted-fg)]">Drop PDF or Word resume · <span className="text-[var(--primary)]">browse</span></div>
                    </>
                }
              </div>

              {/* Existing resumes */}
              {profile.resumes.map(r => (
                <div key={r.id} className="mt-2.5 border border-[var(--border)] rounded-lg overflow-hidden">
                  <div className="p-2.5 px-3.5 flex items-center justify-between bg-[var(--muted)]">
                    <div className="flex items-center gap-2">
                      <FileText size={16} strokeWidth={1.8} className="text-[var(--muted-fg)]" />
                      <span className="text-xs font-medium text-[var(--fg)]">{r.filename}</span>
                      <span className="font-mono text-[10px] text-[var(--muted-fg)]">{r.size}</span>
                    </div>
                    <Button onClick={() => setPreviewResume(previewResume?.id === r.id ? null : r)}
                      className="h-auto p-0.75 px-2.5 bg-transparent border border-[var(--border-strong)] rounded text-[11px] text-[var(--primary)] hover:bg-transparent hover:underline shadow-none">
                      {previewResume?.id === r.id ? 'Hide' : 'View Parsed'}
                    </Button>
                  </div>
                  {previewResume?.id === r.id && (
                    <div className="p-3 px-3.5 bg-[var(--card)]">
                      <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-1.5 uppercase tracking-wider">Parsed Summary</div>
                      <p className="text-xs text-[var(--fg)] leading-relaxed m-0 mb-2.5">{r.parsed.summary}</p>
                      <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-1.5 uppercase tracking-wider">Skills Detected</div>
                      <div className="flex flex-wrap gap-1.25 mb-2.5">
                        {r.parsed.skills.map(s => <TintedBadge key={s} color="#06b6d4" className="text-[11px]">{s}</TintedBadge>)}
                      </div>
                      <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-1.5 uppercase tracking-wider">Experience</div>
                      {r.parsed.experience.map((e, i) => <div key={i} className="text-xs text-[var(--fg)] mb-0.75">· {e}</div>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
      </DrawerContent>
    </Drawer>
  )
}

interface CreateModalProps {
  onClose: () => void
  onCreate: (p: Profile) => void
}

function CreateModal({ onClose, onCreate }: CreateModalProps) {
  const [form, setForm] = useState<FormData>({ ...emptyProfile, assignedBDs: [], skillInput: '' })

  const handleSubmit = () => {
    if (!form.name || !form.email) return
    const { skillInput, ...rest } = form
    onCreate({ ...rest, id: Date.now().toString(), createdAt: new Date().toISOString().split('T')[0], assignedBDs: [], resumes: [] })
    onClose()
  }

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && form.skillInput.trim()) {
      setForm(f => ({ ...f, skills: [...f.skills, f.skillInput.trim()], skillInput: '' }))
    }
  }

  const field = (label: string, key: keyof FormData, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">{label}</label>
      <Input type={type} value={String(form[key] ?? '')} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full p-2 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/60 backdrop-blur-[3px]"
        className="w-[540px] max-w-[540px] sm:max-w-[540px] bg-[var(--card)] text-[var(--fg)] rounded-xl border border-[var(--border-strong)] overflow-hidden shadow-2xl p-0 gap-0 ring-0"
      >
        <div className="p-5 px-6 border-b border-[var(--border)] flex items-center justify-between">
          <DialogTitle className="text-base font-semibold text-[var(--fg)] m-0">New Profile</DialogTitle>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-[var(--muted-fg)] hover:text-[var(--fg)]">
            <X size={16} />
          </Button>
        </div>
        <div className="p-5 px-6 max-h-[500px] overflow-auto">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {field('Full Name *', 'name', 'text', 'Jane Smith')}
            {field('Email *', 'email', 'email', 'jane@example.com')}
            {field('Phone', 'phone', 'text', '+1 (555) 000-0000')}
            {field('Location', 'location', 'text', 'New York, NY')}
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">Seniority Level</label>
              <Select value={form.seniority} onValueChange={v => setForm(f => ({ ...f, seniority: v ?? 'Mid' }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SENIORITY.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field('Years of Experience', 'yearsExp', 'number', '0')}
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">Rate Currency</label>
              <Select value={form.rateCurrency} onValueChange={v => setForm(f => ({ ...f, rateCurrency: v ?? 'USD' }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field('Rate Expectation (/hr)', 'rate', 'number', '0')}
          </div>
          <div className="mb-3">
            <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">Summary</label>
            <Textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief professional summary..."
              className="w-full p-2 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-y" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.5">Skills</label>
            <div className="flex flex-wrap gap-1.25 mb-1.5">
              {form.skills.map((s, i) => (
                <TintedBadge key={i} color="#06b6d4" className="inline-flex items-center gap-1">
                  {s} <Button onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))} className="h-auto p-0 bg-transparent border-none cursor-pointer text-[var(--muted-fg)] leading-none text-xs hover:text-[var(--fg)] shadow-none">×</Button>
                </TintedBadge>
              ))}
            </div>
            <Input placeholder="Add skill (press Enter)" value={form.skillInput} onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))} onKeyDown={handleAddSkill}
              className="w-full p-1.75 px-2.5 bg-[var(--secondary)] border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <div className="p-3.5 px-6 border-t border-[var(--border)] flex justify-end gap-2.5">
          <Button variant="outline" onClick={onClose} className="h-auto p-2 px-4 border-[var(--border-strong)] rounded-md cursor-pointer text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 shadow-none">Cancel</Button>
          <Button onClick={handleSubmit} className="h-auto p-2 px-4.5 bg-[var(--primary)] border-none rounded-md cursor-pointer text-xs font-semibold text-white hover:opacity-90 shadow-none">Create Profile</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface Props {
  profiles: Profile[]
  setProfiles: (p: Profile[]) => void
  activeProfile: Profile
  users: AppUser[]
}

export default function ProfilesTab({ profiles, setProfiles, users }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.skills.some(s => s.toLowerCase().includes(q)) || p.location.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleUpdate = (updated: Profile) => {
    setProfiles(profiles.map(p => p.id === updated.id ? updated : p))
    setSelected(updated)
  }

  const handleCreate = (p: Profile) => setProfiles([...profiles, p])

  return (
    <div className="p-7 px-8 flex-1">
      {/* Header */}
      <PageHeader
        title="Profiles"
        subtitle={`${profiles.length} candidate profiles`}
        className="mb-6"
        actions={
          <Button onClick={() => setCreating(true)}
            className="h-auto flex items-center gap-1.75 p-2.25 px-4 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90 shadow-none">
            <Plus size={14} strokeWidth={2.5} />
            New Profile
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex gap-2.5 mb-5.5">
        <SearchInput
          placeholder="Search by name, skill, location…"
          value={search}
          onChange={setSearch}
          className="flex-1"
          inputClassName="py-2.25 pl-8 rounded-[7px]"
        />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
        {filtered.map(p => {
          const assignedNames = p.assignedBDs.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).filter(Boolean)
          return (
            <div key={p.id} className="card-hover bg-[var(--card)] border border-[var(--border)] rounded-lg p-4.5 cursor-pointer transition-all duration-150 hover:border-gray-400"
              onClick={() => setSelected(p)}>
              <div className="flex items-start gap-3 mb-3">
                <Avatar name={p.name} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--fg)] mb-1">{p.name}</div>
                  <div className="flex gap-1.25 flex-wrap">
                    <TintedBadge color={PROFILE_STATUS_COLOR[p.status]}>{p.status}</TintedBadge>
                    <TintedBadge color="#6366f1">{p.seniority}</TintedBadge>
                  </div>
                </div>
              </div>
              <div className="text-xs text-[var(--muted-fg)] mb-2.5 flex items-center gap-1.25">
                <MapPin size={11} />
                {p.location}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {p.skills.slice(0, 4).map(s => (
                  <span key={s} className="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[11px] text-[var(--secondary-fg)]">{s}</span>
                ))}
                {p.skills.length > 4 && <span className="px-1.5 py-0.5 bg-[var(--secondary)] rounded text-[11px] text-[var(--muted-fg)]">+{p.skills.length - 4}</span>}
              </div>
              <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)]">
                <span className="font-mono text-xs font-semibold text-[var(--primary)]">{p.rateCurrency}{p.rate}/hr</span>
                <div className="flex items-center gap-1.25">
                  {assignedNames.length > 0
                    ? <span className="text-[11px] text-[var(--muted-fg)]">→ {assignedNames.join(', ')}</span>
                    : <span className="text-[11px] text-[var(--muted-fg)]">Unassigned</span>
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-15 text-[var(--muted-fg)]">
          <Users size={40} strokeWidth={1} className="mx-auto mb-3 block text-[var(--muted-fg)]" />
          <div className="text-sm">No profiles match your search</div>
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={handleCreate} />}
      {selected && <DetailDrawer profile={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} users={users} />}
    </div>
  )
}
