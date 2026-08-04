import { useState } from 'react'
import type { AppUser, UserRole } from '@/app/page'
import { APP_USERS } from '@/app/page'

const roleColor: Record<UserRole, string> = { admin: '#ef4444', lead: '#f59e0b', bd: '#6366f1' }
const statusColor: Record<string, string> = { active: '#10b981', inactive: '#64748b' }

function timeFormat(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('')
  const colors = ['#06b6d4,#6366f1', '#10b981,#06b6d4', '#f59e0b,#ef4444', '#6366f1,#ec4899', '#06b6d4,#10b981']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg,${colors[idx]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.3, fontWeight: 700, color: 'white' }}>{initials}</div>
  )
}

interface InviteModalProps { onClose: () => void; onInvite: (u: AppUser) => void }

function InviteModal({ onClose, onInvite }: InviteModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('bd')
  const [sent, setSent] = useState(false)

  const handleSubmit = () => {
    if (!name || !email) return
    const newUser: AppUser = {
      id: Date.now().toString(), name, email, role, status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
    }
    onInvite(newUser)
    setSent(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: 420, background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border-strong)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg)' }}>Invite Team Member</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-fg)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {sent
          ? <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>Invitation sent!</div>
              <div style={{ fontSize: 13, color: 'var(--muted-fg)', marginBottom: 20 }}>An invite email has been sent to {email}</div>
              <button onClick={onClose} style={{ padding: '9px 20px', background: 'var(--primary)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white' }}>Done</button>
            </div>
          : <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 5 }}>Full Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 5 }}>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--secondary)', border: '1px solid var(--border-strong)', borderRadius: 7, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted-fg)', marginBottom: 5 }}>Role</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['bd', 'lead', 'admin'] as UserRole[]).map(r => (
                      <button key={r} onClick={() => setRole(r)}
                        style={{ flex: 1, padding: '9px', background: role === r ? (roleColor[r] + '18') : 'var(--secondary)', border: role === r ? `1px solid ${roleColor[r]}40` : '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: role === r ? 700 : 400, color: role === r ? roleColor[r] : 'var(--fg)', textTransform: 'capitalize', fontFamily: 'JetBrains Mono, monospace' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onClose} style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: 'var(--fg)' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={!name || !email}
                  style={{ flex: 2, padding: '9px', background: (!name || !email) ? 'var(--secondary)' : 'var(--primary)', border: 'none', borderRadius: 7, cursor: (!name || !email) ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: (!name || !email) ? 'var(--muted-fg)' : 'white' }}>
                  Send Invite
                </button>
              </div>
            </div>
        }
      </div>
    </div>
  )
}

interface Props { currentUser: AppUser }

export default function UsersTab({ currentUser }: Props) {
  const [users, setUsers] = useState<AppUser[]>(APP_USERS)
  const [inviting, setInviting] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    const matchStatus = statusFilter === 'all' || u.status === statusFilter
    return matchQ && matchRole && matchStatus
  })

  const handleInvite = (u: AppUser) => setUsers(us => [...us, u])

  const toggleStatus = (id: string) => {
    if (id === currentUser.id) return
    setUsers(us => us.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u))
  }

  return (
    <div style={{ padding: '28px 32px', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Users</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-fg)', margin: '3px 0 0' }}>{users.length} team members</p>
        </div>
        <button onClick={() => setInviting(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--primary)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'white' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite User
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: users.length, color: 'var(--primary)' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: '#ef4444' },
          { label: 'Leads', value: users.filter(u => u.role === 'lead').length, color: '#f59e0b' },
          { label: 'BDs', value: users.filter(u => u.role === 'bd').length, color: '#6366f1' },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, outline: 'none' }} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, minWidth: 130 }}>
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="lead">Lead</option>
          <option value="bd">BD</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', background: 'var(--card)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--fg)', fontSize: 13, minWidth: 130 }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)' }}>
              {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'JetBrains Mono, monospace' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={u.name} size={34} />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{u.name}</div>
                      {u.id === currentUser.id && <div style={{ fontSize: 10, color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace' }}>You</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '13px 16px', color: 'var(--muted-fg)' }}>{u.email}</td>
                <td style={{ padding: '13px 16px' }}>
                  <span className="mono" style={{ padding: '3px 8px', background: roleColor[u.role] + '18', border: `1px solid ${roleColor[u.role]}35`, borderRadius: 4, fontSize: 11, fontWeight: 600, color: roleColor[u.role] }}>{u.role}</span>
                </td>
                <td style={{ padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor[u.status] }} />
                    <span style={{ fontSize: 13, color: statusColor[u.status] }}>{u.status}</span>
                  </div>
                </td>
                <td style={{ padding: '13px 16px' }} className="mono"><span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{timeFormat(u.joinedAt)}</span></td>
                <td style={{ padding: '13px 16px' }}>
                  {u.id !== currentUser.id && (
                    <button onClick={() => toggleStatus(u.id)}
                      style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${u.status === 'active' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, color: u.status === 'active' ? '#ef4444' : '#10b981' }}>
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-fg)', fontSize: 14 }}>No users match your search</div>}
      </div>

      {inviting && <InviteModal onClose={() => setInviting(false)} onInvite={handleInvite} />}
    </div>
  )
}
