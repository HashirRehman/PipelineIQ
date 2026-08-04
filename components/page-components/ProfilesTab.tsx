import { useState, useRef } from 'react'
import type { Profile, AppUser, Resume } from '@/app/page'

const SENIORITY = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Staff']
const CURRENCIES = ['USD', 'GBP', 'EUR', 'CAD', 'AUD']
const STATUSES: Profile['status'][] = ['active', 'inactive', 'archived']

const statusColor: Record<string, string> = {
  active: '#10b981', inactive: '#f59e0b', archived: '#64748b',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="font-mono inline-flex items-center px-1.75 py-0.5 rounded text-[10px] font-semibold tracking-wider" style={{ background: color + '22', color }}>
      {label}
    </span>
  )
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('')
  const colors = ['#06b6d4,#6366f1', '#10b981,#06b6d4', '#f59e0b,#ef4444', '#6366f1,#ec4899', '#06b6d4,#10b981']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${colors[idx]})`,
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}

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
        ? <input type={type} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
            className="w-full p-1.75 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
        : <div className="text-xs text-[var(--fg)] py-1">{String(form[key] ?? '—')}</div>
      }
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/55 backdrop-blur-[2px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ml-auto w-[560px] bg-[var(--card)] border-l border-[var(--border)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4.5 px-6 border-b border-[var(--border)] flex items-center gap-3.5 shrink-0">
          <Avatar name={profile.name} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-5xl font-semibold text-[var(--fg)] text-[17px]">{profile.name}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge label={profile.status} color={statusColor[profile.status]} />
              <Badge label={profile.seniority} color="#6366f1" />
              <span className="font-mono text-[11px] text-[var(--muted-fg)]">{profile.rateCurrency}{profile.rate}/hr</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => editing ? handleSave() : setEditing(true)}
              className={`p-1.75 px-3.5 border-none rounded-md cursor-pointer text-xs font-semibold ${editing ? 'bg-[var(--primary)] text-white' : 'bg-[var(--secondary)] text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5'}`}>
              {editing ? 'Save' : 'Edit'}
            </button>
            <button onClick={onClose} className="p-1.75 px-2.5 bg-transparent border border-[var(--border-strong)] rounded-md cursor-pointer text-[var(--muted-fg)] hover:text-[var(--fg)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
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
                ? <select value={form.seniority} onChange={e => setForm(f => ({ ...f, seniority: e.target.value }))}
                    className="w-full p-1.75 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs">
                    {SENIORITY.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : <div className="text-xs text-[var(--fg)] py-1">{form.seniority}</div>
              }
            </div>
            {inp('Years of Experience', 'yearsExp', 'number')}
            <div>
              <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Rate ({form.rateCurrency})</div>
              {editing
                ? <div className="flex gap-1.5">
                    <select value={form.rateCurrency} onChange={e => setForm(f => ({ ...f, rateCurrency: e.target.value }))}
                      className="w-[80px] p-1.75 px-2 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs">
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: Number(e.target.value) }))}
                      className="flex-1 p-1.75 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs" />
                  </div>
                : <div className="text-xs text-[var(--fg)] py-1">{form.rateCurrency}{form.rate}/hr</div>
              }
            </div>
            <div>
              <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Status</div>
              {editing
                ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Profile['status'] }))}
                    className="w-full p-1.75 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : <Badge label={form.status} color={statusColor[form.status]} />
              }
            </div>
          </div>

          {/* Summary */}
          <div className="mb-5">
            <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-1">Summary</div>
            {editing
              ? <textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  className="w-full p-2 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-y" />
              : <p className="text-xs text-[var(--fg)] leading-relaxed m-0">{form.summary}</p>
            }
          </div>

          {/* Skills */}
          <div className="mb-5">
            <div className="text-[11px] font-medium text-[var(--muted-fg)] mb-2">Skills</div>
            <div className={`flex flex-wrap gap-1.5 ${editing ? 'mb-2' : 'mb-0'}`}>
              {form.skills.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1.25 px-2 py-0.75 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-[var(--primary)]">
                  {s}
                  {editing && <button onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))}
                    className="bg-transparent border-none cursor-pointer text-[var(--muted-fg)] p-0 leading-none text-xs hover:text-[var(--fg)]">×</button>}
                </span>
              ))}
            </div>
            {editing && (
              <input placeholder="Add skill (press Enter)" value={form.skillInput} onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))} onKeyDown={handleAddSkill}
                className="p-1.5 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none w-full" />
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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${assigned ? 'bg-gradient-to-br from-cyan-500 to-indigo-500 text-white' : 'bg-[var(--secondary)] text-[var(--muted-fg)]'}`}>
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-[var(--fg)]">{u.name}</div>
                        <div className="font-mono text-[10px] text-[var(--muted-fg)]">{u.role} · {u.email}</div>
                      </div>
                    </div>
                    <button onClick={() => toggleBD(u.id)}
                      className={`p-1 px-2.5 rounded-md cursor-pointer text-[11px] font-semibold border ${assigned ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-cyan-500/10 border-cyan-500/30 text-[var(--primary)]'}`}>
                      {assigned ? 'Remove' : 'Assign'}
                    </button>
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div className="text-xs text-[var(--muted-fg)]">Drop PDF or Word resume · <span className="text-[var(--primary)]">browse</span></div>
                  </>
              }
            </div>

            {/* Existing resumes */}
            {profile.resumes.map(r => (
              <div key={r.id} className="mt-2.5 border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="p-2.5 px-3.5 flex items-center justify-between bg-[var(--muted)]">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="text-xs font-medium text-[var(--fg)]">{r.filename}</span>
                    <span className="font-mono text-[10px] text-[var(--muted-fg)]">{r.size}</span>
                  </div>
                  <button onClick={() => setPreviewResume(previewResume?.id === r.id ? null : r)}
                    className="p-0.75 px-2.5 bg-transparent border border-[var(--border-strong)] rounded cursor-pointer text-[11px] text-[var(--primary)] hover:underline">
                    {previewResume?.id === r.id ? 'Hide' : 'View Parsed'}
                  </button>
                </div>
                {previewResume?.id === r.id && (
                  <div className="p-3 px-3.5 bg-[var(--card)]">
                    <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-1.5 uppercase tracking-wider">Parsed Summary</div>
                    <p className="text-xs text-[var(--fg)] leading-relaxed m-0 mb-2.5">{r.parsed.summary}</p>
                    <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-1.5 uppercase tracking-wider">Skills Detected</div>
                    <div className="flex flex-wrap gap-1.25 mb-2.5">
                      {r.parsed.skills.map(s => <span key={s} className="px-1.75 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-[11px] text-[var(--primary)]">{s}</span>)}
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--muted-fg)] mb-1.5 uppercase tracking-wider">Experience</div>
                    {r.parsed.experience.map((e, i) => <div key={i} className="text-xs text-[var(--fg)] mb-0.75">· {e}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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
      <input type={type} value={String(form[key] ?? '')} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full p-2 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-[540px] bg-[var(--card)] rounded-xl border border-[var(--border-strong)] overflow-hidden shadow-2xl">
        <div className="p-5 px-6 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-base font-semibold text-[var(--fg)]">New Profile</div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--muted-fg)] hover:text-[var(--fg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-5 px-6 max-h-[500px] overflow-auto">
          <div className="grid grid-cols-2 gap-3 mb-3">
            {field('Full Name *', 'name', 'text', 'Jane Smith')}
            {field('Email *', 'email', 'email', 'jane@example.com')}
            {field('Phone', 'phone', 'text', '+1 (555) 000-0000')}
            {field('Location', 'location', 'text', 'New York, NY')}
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">Seniority Level</label>
              <select value={form.seniority} onChange={e => setForm(f => ({ ...f, seniority: e.target.value }))}
                className="w-full p-2 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs">
                {SENIORITY.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {field('Years of Experience', 'yearsExp', 'number', '0')}
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">Rate Currency</label>
              <select value={form.rateCurrency} onChange={e => setForm(f => ({ ...f, rateCurrency: e.target.value }))}
                className="w-full p-2 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {field('Rate Expectation (/hr)', 'rate', 'number', '0')}
          </div>
          <div className="mb-3">
            <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1">Summary</label>
            <textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief professional summary..."
              className="w-full p-2 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs resize-y" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.5">Skills</label>
            <div className="flex flex-wrap gap-1.25 mb-1.5">
              {form.skills.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-[var(--primary)]">
                  {s} <button onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))} className="bg-transparent border-none cursor-pointer color-inherit p-0 text-xs leading-none">×</button>
                </span>
              ))}
            </div>
            <input placeholder="Add skill (press Enter)" value={form.skillInput} onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))} onKeyDown={handleAddSkill}
              className="w-full p-1.75 px-2.5 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <div className="p-3.5 px-6 border-t border-[var(--border)] flex justify-end gap-2.5">
          <button onClick={onClose} className="p-2 px-4 bg-transparent border border-[var(--border-strong)] rounded-md cursor-pointer text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5">Cancel</button>
          <button onClick={handleSubmit} className="p-2 px-4.5 bg-[var(--primary)] border-none rounded-md cursor-pointer text-xs font-semibold text-white hover:opacity-90">Create Profile</button>
        </div>
      </div>
    </div>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--fg)] m-0">Profiles</h1>
          <p className="text-xs text-[var(--muted-fg)] mt-0.5 mb-0">{profiles.length} candidate profiles</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1.75 p-2.25 px-4 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Profile
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-5.5">
        <div className="flex-1 relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search by name, skill, location…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full py-2.25 pl-8 pr-2.5 bg-[var(--card)] border border-[var(--border-strong)] rounded-[7px] text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="p-2.25 px-3 bg-[var(--card)] border border-[var(--border-strong)] rounded-[7px] text-[var(--fg)] text-xs min-w-[130px]">
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
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
                    <Badge label={p.status} color={statusColor[p.status]} />
                    <Badge label={p.seniority} color="#6366f1" />
                  </div>
                </div>
              </div>
              <div className="text-xs text-[var(--muted-fg)] mb-2.5 flex items-center gap-1.25">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 block"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <div className="text-sm">No profiles match your search</div>
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={handleCreate} />}
      {selected && <DetailDrawer profile={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} users={users} />}
    </div>
  )
}
