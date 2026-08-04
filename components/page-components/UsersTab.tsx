import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import type { AppUser, UserRole } from '@/app/page'
import { APP_USERS } from '@/app/page'
import { Avatar } from "@/components/avatar"
import { StatCard } from "@/components/stat-card"
import { SearchInput } from "@/components/search-input"
import { TintedBadge } from "@/components/tinted-badge"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ROLE_COLOR, USER_STATUS_COLOR } from "@/lib/constants"
import { formatDate } from "@/lib/format"

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/60 backdrop-blur-[3px]"
        className="w-[420px] max-w-[420px] sm:max-w-[420px] bg-[var(--card)] text-[var(--fg)] rounded-xl border border-[var(--border-strong)] overflow-hidden shadow-2xl p-0 gap-0 ring-0"
      >
        <div className="p-5 px-6 border-b border-[var(--border)] flex items-center justify-between">
          <DialogTitle className="text-base font-semibold text-[var(--fg)] m-0">Invite Team Member</DialogTitle>
          <Button variant="ghost" size="icon-xs" onClick={onClose} className="text-[var(--muted-fg)] hover:text-[var(--fg)]">
            <X size={16} />
          </Button>
        </div>
        {sent
          ? <div className="p-8 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <Check size={22} strokeWidth={2.5} className="text-[#10b981]" />
              </div>
              <div className="text-[15px] font-semibold text-[var(--fg)] mb-1.5">Invitation sent!</div>
              <div className="text-xs text-[var(--muted-fg)] mb-5">An invite email has been sent to {email}</div>
              <Button onClick={onClose} className="bg-[var(--primary)] text-white hover:opacity-90 text-xs font-semibold px-5 shadow-none">Done</Button>
            </div>
          : <div className="p-5 px-6">
              <div className="flex flex-col gap-3.5 mb-5">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Full Name *</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith"
                    className="w-full bg-[var(--secondary)] border-[var(--border-strong)] text-[var(--fg)] text-xs h-9" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Email *</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com"
                    className="w-full bg-[var(--secondary)] border-[var(--border-strong)] text-[var(--fg)] text-xs h-9" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Role</label>
                  <div className="flex gap-2">
                    {(['bd', 'lead', 'admin'] as UserRole[]).map(r => (
                      <Button key={r} variant="ghost" onClick={() => setRole(r)}
                        className="flex-1 h-9 rounded-md text-xs capitalize font-mono shadow-none"
                        style={{
                          background: role === r ? (ROLE_COLOR[r] + '18') : 'var(--secondary)',
                          border: role === r ? `1px solid ${ROLE_COLOR[r]}40` : '1px solid var(--border-strong)',
                          fontWeight: role === r ? 700 : 400,
                          color: role === r ? ROLE_COLOR[r] : 'var(--fg)',
                        }}>
                        {r}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2.5">
                <Button variant="outline" onClick={onClose} className="flex-1 border-[var(--border-strong)] text-[var(--fg)] text-xs h-9 shadow-none">Cancel</Button>
                <Button onClick={handleSubmit} disabled={!name || !email}
                  className={`flex-[2] text-xs font-semibold h-9 shadow-none ${
                    (!name || !email)
                      ? 'bg-[var(--secondary)] text-[var(--muted-fg)]'
                      : 'bg-[var(--primary)] text-white hover:opacity-90'
                  }`}>
                  Send Invite
                </Button>
              </div>
            </div>
        }
      </DialogContent>
    </Dialog>
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
      <PageHeader
        title="Users"
        subtitle={`${users.length} team members`}
        className="mb-6"
        actions={
          <Button onClick={() => setInviting(true)}
            className="h-auto flex items-center gap-1.75 p-2.25 px-4 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90 shadow-none">
            <Plus size={14} strokeWidth={2.5} />
            Invite User
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Users" value={users.length} color="var(--primary)" className="py-3.5 px-4" valueClassName="text-[22px]" labelClassName="text-[var(--muted-fg)]" />
        <StatCard label="Admins" value={users.filter(u => u.role === 'admin').length} color="#ef4444" className="py-3.5 px-4" valueClassName="text-[22px]" labelClassName="text-[var(--muted-fg)]" />
        <StatCard label="Leads" value={users.filter(u => u.role === 'lead').length} color="#f59e0b" className="py-3.5 px-4" valueClassName="text-[22px]" labelClassName="text-[var(--muted-fg)]" />
        <StatCard label="BDs" value={users.filter(u => u.role === 'bd').length} color="#6366f1" className="py-3.5 px-4" valueClassName="text-[22px]" labelClassName="text-[var(--muted-fg)]" />
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4.5">
        <SearchInput
          placeholder="Search users…"
          value={search}
          onChange={setSearch}
          className="flex-1"
        />
        <Select value={roleFilter} onValueChange={v => setRoleFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="bd">BD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <Table className="w-full border-collapse text-xs">
          <TableHeader>
            <TableRow className="border-b border-[var(--border)] bg-[var(--muted)] hover:bg-[var(--muted)]">
              {['User', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                <TableHead key={h} className="p-2.5 px-4 text-left text-[11px] font-semibold text-[var(--muted-fg)] uppercase tracking-[0.5px] font-mono">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.id} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]">
                <TableCell className="p-3.25 px-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size={34} />
                    <div>
                      <div className="font-semibold text-[var(--fg)]">{u.name}</div>
                      {u.id === currentUser.id && <div className="text-[10px] text-[var(--primary)] font-mono">You</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-3.25 px-4 text-[var(--muted-fg)]">{u.email}</TableCell>
                <TableCell className="p-3.25 px-4">
                  <TintedBadge color={ROLE_COLOR[u.role]}>{u.role}</TintedBadge>
                </TableCell>
                <TableCell className="p-3.25 px-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: USER_STATUS_COLOR[u.status] }} />
                    <span className="text-xs" style={{ color: USER_STATUS_COLOR[u.status] }}>{u.status}</span>
                  </div>
                </TableCell>
                <TableCell className="p-3.25 px-4 font-mono"><span className="text-xs text-[var(--muted-fg)]">{formatDate(u.joinedAt)}</span></TableCell>
                <TableCell className="p-3.25 px-4">
                  {u.id !== currentUser.id && (
                    <Button onClick={() => toggleStatus(u.id)}
                      className={`h-auto p-1 px-2.5 bg-transparent border rounded-md cursor-pointer text-[11px] transition-colors shadow-none ${
                        u.status === 'active'
                          ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                          : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                      }`}>
                      {u.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <div className="text-center py-8 text-[var(--muted-fg)] text-sm">No users match your search</div>}
      </div>

      {inviting && <InviteModal onClose={() => setInviting(false)} onInvite={handleInvite} />}
    </div>
  )
}
