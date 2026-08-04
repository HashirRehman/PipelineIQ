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
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-bold text-white"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg,${colors[idx]})`,
        fontSize: size * 0.3,
      }}
    >
      {initials}
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px]"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-[420px] bg-[var(--card)] rounded-xl border border-[var(--border-strong)] overflow-hidden shadow-2xl">
        <div className="p-5 px-6 border-b border-[var(--border)] flex items-center justify-between">
          <div className="text-base font-semibold text-[var(--fg)]">Invite Team Member</div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-[var(--muted-fg)] hover:text-[var(--fg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {sent
          ? <div className="p-8 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="text-[15px] font-semibold text-[var(--fg)] mb-1.5">Invitation sent!</div>
              <div className="text-xs text-[var(--muted-fg)] mb-5">An invite email has been sent to {email}</div>
              <button onClick={onClose} className="p-2.25 px-5 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90">Done</button>
            </div>
          : <div className="p-5 px-6">
              <div className="flex flex-col gap-3.5 mb-5">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Full Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
                    className="w-full p-2.25 px-3 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-[7px] text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com"
                    className="w-full p-2.25 px-3 bg-[var(--secondary)] border border-[var(--border-strong)] rounded-[7px] text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Role</label>
                  <div className="flex gap-2">
                    {(['bd', 'lead', 'admin'] as UserRole[]).map(r => (
                      <button key={r} onClick={() => setRole(r)}
                        className="flex-1 p-2.25 rounded-md cursor-pointer text-xs capitalize font-mono transition-colors"
                        style={{
                          background: role === r ? (roleColor[r] + '18') : 'var(--secondary)',
                          border: role === r ? `1px solid ${roleColor[r]}40` : '1px solid var(--border-strong)',
                          fontWeight: role === r ? 700 : 400,
                          color: role === r ? roleColor[r] : 'var(--fg)',
                        }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button onClick={onClose} className="flex-1 p-2.25 bg-transparent border border-[var(--border-strong)] rounded-[7px] cursor-pointer text-xs text-[var(--fg)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={!name || !email}
                  className={`flex-[2] p-2.25 border-none rounded-[7px] text-xs font-semibold transition-colors ${
                    (!name || !email)
                      ? 'bg-[var(--secondary)] text-[var(--muted-fg)] cursor-default'
                      : 'bg-[var(--primary)] text-white cursor-pointer hover:opacity-90'
                  }`}>
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
    <div className="p-7 px-8 flex-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--fg)] m-0">Users</h1>
          <p className="text-xs text-[var(--muted-fg)] mt-0.5 mb-0">{users.length} team members</p>
        </div>
        <button onClick={() => setInviting(true)}
          className="flex items-center gap-1.75 p-2.25 px-4 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite User
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Users', value: users.length, color: 'var(--primary)' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: '#ef4444' },
          { label: 'Leads', value: users.filter(u => u.role === 'lead').length, color: '#f59e0b' },
          { label: 'BDs', value: users.filter(u => u.role === 'bd').length, color: '#6366f1' },
        ].map(s => (
          <div key={s.label} className="p-3.5 px-4 bg-[var(--card)] border border-[var(--border)] rounded-lg">
            <div className="font-mono text-[22px] font-bold mb-0.5" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-[var(--muted-fg)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4.5">
        <div className="flex-1 relative">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full py-2 pl-7.5 pr-2.5 bg-[var(--card)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs outline-none focus:border-[var(--primary)]" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="p-2 px-3 bg-[var(--card)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs min-w-[130px]">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="lead">Lead</option>
          <option value="bd">BD</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="p-2 px-3 bg-[var(--card)] border border-[var(--border-strong)] rounded-md text-[var(--fg)] text-xs min-w-[130px]">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
              {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="p-2.5 px-4 text-left text-[11px] font-semibold text-[var(--muted-fg)] uppercase tracking-[0.5px] font-mono">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)] ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                <td className="p-3.25 px-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size={34} />
                    <div>
                      <div className="font-semibold text-[var(--fg)]">{u.name}</div>
                      {u.id === currentUser.id && <div className="text-[10px] text-[var(--primary)] font-mono">You</div>}
                    </div>
                  </div>
                </td>
                <td className="p-3.25 px-4 text-[var(--muted-fg)]">{u.email}</td>
                <td className="p-3.25 px-4">
                  <span className="font-mono p-0.75 px-2 rounded text-[11px] font-semibold" style={{ background: roleColor[u.role] + '18', border: `1px solid ${roleColor[u.role]}35`, color: roleColor[u.role] }}>{u.role}</span>
                </td>
                <td className="p-3.25 px-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor[u.status] }} />
                    <span className="text-xs" style={{ color: statusColor[u.status] }}>{u.status}</span>
                  </div>
                </td>
                <td className="p-3.25 px-4 font-mono"><span className="text-xs text-[var(--muted-fg)]">{timeFormat(u.joinedAt)}</span></td>
                <td className="p-3.25 px-4">
                  {u.id !== currentUser.id && (
                    <button onClick={() => toggleStatus(u.id)}
                      className={`p-1 px-2.5 bg-transparent border rounded-md cursor-pointer text-[11px] transition-colors ${
                        u.status === 'active'
                          ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                          : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                      }`}>
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-[var(--muted-fg)] text-sm">No users match your search</div>}
      </div>

      {inviting && <InviteModal onClose={() => setInviting(false)} onInvite={handleInvite} />}
    </div>
  )
}
