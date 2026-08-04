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
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 4,
      fontSize: 10, fontWeight: 600, background: color + '22', color, letterSpacing: '0.3px',
    }}>{label}</span>
  )
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('')
  const colors = ['#06b6d4,#6366f1', '#10b981,#06b6d4', '#f59e0b,#ef4444', '#6366f1,#ec4899', '#06b6d4,#10b981']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${colors[idx]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 700, color: 'white',
    }}>{initials}</div>
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
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>{label}</div>
      {editing
        ? <input type={type} value={String(form[key] ?? '')} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
            style={{ width: '100%', padding: '7px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
        : <div style={{ fontSize: 13, color: 'var(--fg)', padding: '4px 0' }}>{String(form[key] ?? '—')}</div>
      }
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'stretch',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ marginLeft: 'auto', width: 560, background: 'var(--card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <Avatar name={profile.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--fg)' }}>{profile.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Badge label={profile.status} color={statusColor[profile.status]} />
              <Badge label={profile.seniority} color="#6366f1" />
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{profile.rateCurrency}{profile.rate}/hr</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => editing ? handleSave() : setEditing(true)}
              style={{ padding: '7px 14px', background: editing ? 'var(--primary)' : 'var(--secondary)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: editing ? 'white' : 'var(--fg)' }}>
              {editing ? 'Save' : 'Edit'}
            </button>
            <button onClick={onClose} style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted-fg)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {/* Basic Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            {inp('Full Name', 'name')}
            {inp('Email', 'email', 'email')}
            {inp('Phone', 'phone')}
            {inp('Location', 'location')}
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Seniority Level</div>
              {editing
                ? <select value={form.seniority} onChange={e => setForm(f => ({ ...f, seniority: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 13 }}>
                    {SENIORITY.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : <div style={{ fontSize: 13, color: 'var(--fg)', padding: '4px 0' }}>{form.seniority}</div>
              }
            </div>
            {inp('Years of Experience', 'yearsExp', 'number')}
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Rate ({form.rateCurrency})</div>
              {editing
                ? <div style={{ display: 'flex', gap: 6 }}>
                    <select value={form.rateCurrency} onChange={e => setForm(f => ({ ...f, rateCurrency: e.target.value }))}
                      style={{ width: 80, padding: '7px 8px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 13 }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: Number(e.target.value) }))}
                      style={{ flex: 1, padding: '7px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 13 }} />
                  </div>
                : <div style={{ fontSize: 13, color: 'var(--fg)', padding: '4px 0' }}>{form.rateCurrency}{form.rate}/hr</div>
              }
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Status</div>
              {editing
                ? <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Profile['status'] }))}
                    style={{ width: '100%', padding: '7px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 13 }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : <Badge label={form.status} color={statusColor[form.status]} />
              }
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Summary</div>
            {editing
              ? <textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 13, resize: 'vertical' }} />
              : <p style={{ fontSize: 13, color: 'var(--fg)', lineHeight: 1.6, margin: 0 }}>{form.summary}</p>
            }
          </div>

          {/* Skills */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 8 }}>Skills</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editing ? 8 : 0 }}>
              {form.skills.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 4, fontSize: 12, color: 'var(--primary)' }}>
                  {s}
                  {editing && <button onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-fg)', padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>}
                </span>
              ))}
            </div>
            {editing && (
              <input placeholder="Add skill (press Enter)" value={form.skillInput} onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))} onKeyDown={handleAddSkill}
                style={{ padding: '6px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 5, color: 'var(--fg)', fontSize: 12, outline: 'none', width: '100%' }} />
            )}
          </div>

          {/* BD Assignment */}
          <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--muted)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 12 }}>Assigned Business Developers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bdUsers.map(u => {
                const assigned = (form.assignedBDs || []).includes(u.id)
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: assigned ? 'linear-gradient(135deg,#06b6d4,#6366f1)' : 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: assigned ? 'white' : 'var(--muted-fg)' }}>
                        {u.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{u.name}</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--muted-fg)' }}>{u.role} · {u.email}</div>
                      </div>
                    </div>
                    <button onClick={() => toggleBD(u.id)}
                      style={{ padding: '4px 10px', background: assigned ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.1)', border: `1px solid ${assigned ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.3)'}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: assigned ? '#ef4444' : 'var(--primary)' }}>
                      {assigned ? 'Remove' : 'Assign'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Resume Upload */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 10 }}>Resumes</div>
            <div
              className={dragOver ? 'drag-over' : ''}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: '1.5px dashed var(--border-strong)', borderRadius: 8, padding: '20px',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
                background: dragOver ? 'rgba(6,182,212,0.05)' : 'var(--muted)',
              }}
            >
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
              {uploading
                ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <div style={{ width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>Parsing resume…</span>
                  </div>
                : <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style={{ fontSize: 13, color: 'var(--muted-fg)' }}>Drop PDF or Word resume · <span style={{ color: 'var(--primary)' }}>browse</span></div>
                  </>
              }
            </div>

            {/* Existing resumes */}
            {profile.resumes.map(r => (
              <div key={r.id} style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)' }}>{r.filename}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--muted-fg)' }}>{r.size}</span>
                  </div>
                  <button onClick={() => setPreviewResume(previewResume?.id === r.id ? null : r)}
                    style={{ padding: '3px 10px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: 11, color: 'var(--primary)' }}>
                    {previewResume?.id === r.id ? 'Hide' : 'View Parsed'}
                  </button>
                </div>
                {previewResume?.id === r.id && (
                  <div style={{ padding: '12px 14px', background: 'var(--card)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parsed Summary</div>
                    <p style={{ fontSize: 12, color: 'var(--fg)', lineHeight: 1.6, margin: '0 0 10px' }}>{r.parsed.summary}</p>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skills Detected</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                      {r.parsed.skills.map(s => <span key={s} style={{ padding: '2px 7px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 4, fontSize: 11, color: 'var(--primary)' }}>{s}</span>)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Experience</div>
                    {r.parsed.experience.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--fg)', marginBottom: 3 }}>· {e}</div>)}
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
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>{label}</label>
      <input type={type} value={String(form[key] ?? '')} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        style={{ width: '100%', padding: '8px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 540, background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border-strong)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>New Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-fg)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px 24px', maxHeight: 500, overflow: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {field('Full Name *', 'name', 'text', 'Jane Smith')}
            {field('Email *', 'email', 'email', 'jane@example.com')}
            {field('Phone', 'phone', 'text', '+1 (555) 000-0000')}
            {field('Location', 'location', 'text', 'New York, NY')}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Seniority Level</label>
              <select value={form.seniority} onChange={e => setForm(f => ({ ...f, seniority: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13 }}>
                {SENIORITY.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {field('Years of Experience', 'yearsExp', 'number', '0')}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Rate Currency</label>
              <select value={form.rateCurrency} onChange={e => setForm(f => ({ ...f, rateCurrency: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13 }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {field('Rate Expectation (/hr)', 'rate', 'number', '0')}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 4 }}>Summary</label>
            <textarea rows={3} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief professional summary..."
              style={{ width: '100%', padding: '8px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 6 }}>Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
              {form.skills.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 4, fontSize: 12, color: 'var(--primary)' }}>
                  {s} <button onClick={() => setForm(f => ({ ...f, skills: f.skills.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <input placeholder="Add skill (press Enter)" value={form.skillInput} onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))} onKeyDown={handleAddSkill}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 12, outline: 'none' }} />
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--fg)' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '8px 18px', background: 'var(--primary)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white' }}>Create Profile</button>
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
    <div style={{ padding: '28px 32px', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Profiles</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-fg)', margin: '3px 0 0' }}>{profiles.length} candidate profiles</p>
        </div>
        <button onClick={() => setCreating(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--primary)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Profile
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search by name, skill, location…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 10px 9px 32px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--fg)', fontSize: 13, minWidth: 130 }}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map(p => {
          const assignedNames = p.assignedBDs.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).filter(Boolean)
          return (
            <div key={p.id} className="card-hover"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => setSelected(p)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <Avatar name={p.name} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <Badge label={p.status} color={statusColor[p.status]} />
                    <Badge label={p.seniority} color="#6366f1" />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {p.location}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                {p.skills.slice(0, 4).map(s => (
                  <span key={s} style={{ padding: '2px 6px', background: 'var(--secondary)', borderRadius: 3, fontSize: 11, color: 'var(--secondary-fg)' }}>{s}</span>
                ))}
                {p.skills.length > 4 && <span style={{ padding: '2px 6px', background: 'var(--secondary)', borderRadius: 3, fontSize: 11, color: 'var(--muted-fg)' }}>+{p.skills.length - 4}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{p.rateCurrency}{p.rate}/hr</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {assignedNames.length > 0
                    ? <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>→ {assignedNames.join(', ')}</span>
                    : <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>Unassigned</span>
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted-fg)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <div style={{ fontSize: 14 }}>No profiles match your search</div>
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={handleCreate} />}
      {selected && <DetailDrawer profile={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} users={users} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
