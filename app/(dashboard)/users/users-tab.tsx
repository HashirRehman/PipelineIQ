"use client"
import { useState, useEffect } from "react"
import { Check, Plus, X, Loader2, Pencil } from "lucide-react"
import type { ApiAppUser } from "@/app/api/users/route"
import { apiPost, apiRequest } from "@/lib/api/client"
import { Avatar } from "@/components/avatar"
import { StatCard } from "@/components/stat-card"
import { GooeyInput } from "@/components/ui/gooey-input"
import { PageHeader } from "@/components/page-header"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ROLE_COLOR, USER_STATUS_COLOR } from "@/lib/constants"
import { formatDate } from "@/lib/format"

interface RoleOption { id: string; name: string }

// Map role name strings to typed UserRole keys
function mapRoleName(name: string): "admin" | "lead" | "bd" {
  const n = name.toLowerCase()
  if (n === "admin") return "admin"
  if (n === "lead") return "lead"
  return "bd"
}

const labelClass = "block text-meta font-medium text-muted-foreground mb-1.5"
const inputClass = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/50"

/* ─── User Modal (shared by Invite + Edit) ─── */
type UserModalMode = "invite" | "edit"

interface UserModalProps {
  mode: UserModalMode
  roles: RoleOption[]
  user?: ApiAppUser // edit only
  isSelf?: boolean // edit only
  onClose: () => void
  onSubmit: (values: { name: string; email: string; roleId: string | null }) => Promise<void>
}

function UserModal({ mode, roles, user, isSelf = false, onClose, onSubmit }: UserModalProps) {
  const isInvite = mode === "invite"
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [roleId, setRoleId] = useState<string | null>(isInvite ? (roles[0]?.id ?? null) : (user?.roleId ?? null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const canSubmit = isInvite ? Boolean(name && email && roleId) : Boolean(name.trim())

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    setLoading(true); setError("")
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), roleId })
      if (isInvite) setSent(true)
      else onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const roleButtons = (
    <div className="flex gap-2">
      {roles.map(r => {
        const color = ROLE_COLOR[mapRoleName(r.name)]
        const sel = roleId === r.id
        return (
          <button key={r.id} type="button" onClick={() => setRoleId(r.id)}
            className="flex-1 h-9 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer"
            style={{
              background: sel ? `color-mix(in srgb, ${color} 10%, transparent)` : "var(--muted)",
              border: `1px solid ${sel ? `color-mix(in srgb, ${color} 25%, transparent)` : "var(--border)"}`,
              color: sel ? color : "var(--foreground)",
              fontWeight: sel ? 700 : 400,
            }}>
            {r.name}
          </button>
        )
      })}
    </div>
  )

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            {isInvite ? "Invite Team Member" : isSelf ? "Edit Your Profile" : "Edit Team Member"}
          </DialogTitle>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="size-12 rounded-full bg-status-green/10 flex items-center justify-center mx-auto mb-4">
              <Check className="size-5 text-status-green" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Invitation sent!</p>
            <p className="text-xs text-muted-foreground mb-5">An invite email has been sent to {email}</p>
            <button type="button" onClick={onClose} className="h-9 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 cursor-pointer">Done</button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
            <div>
              <label className={labelClass}>Full Name *</label>
              <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder={isInvite ? "Jane Smith" : undefined} />
            </div>
            <div>
              <label className={labelClass}>{isInvite ? "Email *" : "Email"}</label>
              <input
                type="email"
                className={isInvite ? inputClass : `${inputClass} opacity-60 cursor-not-allowed`}
                value={email}
                onChange={isInvite ? e => setEmail(e.target.value) : undefined}
                placeholder={isInvite ? "jane@company.com" : undefined}
                readOnly={!isInvite}
              />
            </div>
            {isSelf && !isInvite ? (
              <p className="text-caption text-muted-foreground">You cannot change your own role.</p>
            ) : (
              <div>
                <label className={labelClass}>Role</label>
                {roleButtons}
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-border text-sm text-foreground hover:bg-accent transition-colors cursor-pointer">Cancel</button>
              <button type="button" onClick={handleSubmit} disabled={!canSubmit || loading}
                className="flex-[2] inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                {isInvite ? "Send Invite" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Tab ─── */
export default function UsersTab() {
  const [users, setUsers] = useState<ApiAppUser[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [activeUser, setActiveUser] = useState<ApiAppUser | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [accessDenied, setAccessDenied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editingUser, setEditingUser] = useState<ApiAppUser | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch("/api/users", { signal: ctrl.signal })
      .then(res => {
        if (res.status === 403) {
          setAccessDenied(true)
          return
        }
        if (!res.ok) throw new Error("Failed to load users")
        return res.json()
      })
      .then(json => {
        if (!json) return
        setUsers(json.users ?? [])
        setRoles(json.roles ?? [])
        setActiveUser(json.currentUser ?? null)
        setIsAdmin(json.isAdmin ?? false)
        setError(null)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError("Unable to load team members.")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [])

  const saveUserEdit = async (userId: string, updates: { name?: string; roleId?: string }) => {
    setActionError("")
    await apiRequest<{ success: boolean }>("/api/users", "PATCH", { userId, ...updates })

    const roleName = updates.roleId ? (roles.find(r => r.id === updates.roleId)?.name ?? "") : ""
    setUsers(us => us.map(u => {
      if (u.id !== userId) return u
      return {
        ...u,
        name: updates.name ?? u.name,
        roleId: updates.roleId ?? u.roleId,
        role: updates.roleId ? mapRoleName(roleName) : u.role,
      }
    }))
    // Modal closes itself on success.
  }

  const toggleStatus = async (id: string) => {
    if (id === activeUser?.id || updatingId) return
    setActionError("")
    setUpdatingId(id)

    const target = users.find(u => u.id === id)
    if (!target) return

    const newStatus = target.status === "active" ? "inactive" : "active"

    // Optimistic UI update
    setUsers(us => us.map(u => u.id === id ? { ...u, status: newStatus } : u))

    try {
      await apiRequest<{ success: boolean }>("/api/users", "PATCH", {
        userId: id,
        status: newStatus,
      })
    } catch (err) {
      // Revert the optimistic update on error.
      setUsers(us => us.map(u => u.id === id ? { ...u, status: target.status } : u))
      setActionError(err instanceof Error ? err.message : "Failed to update user status.")
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = roleFilter === "all" || u.roleId === roleFilter
    const matchStatus = statusFilter === "all" || u.status === statusFilter
    return matchQ && matchRole && matchStatus
  })

  const adminCount = users.filter(u => u.role === "admin").length
  const activeCount = users.filter(u => u.status === "active").length

  if (accessDenied) {
    return (
      <div className="p-8">
        <PageHeader title="Team" description="Admin only" />
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="text-sm font-semibold text-foreground mb-1.5">Access denied</div>
          <div className="text-xs text-muted-foreground">
            Only administrators can view and manage team members.
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading team...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Team"
        description={`${users.length} member${users.length !== 1 ? "s" : ""}`}
        actions={
          isAdmin && (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-1.5 h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Plus className="size-4" />
              Invite Member
            </button>
          )
        }
      />

      {actionError && (
        <div className="mx-6 mb-0 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-destructive/70 hover:text-destructive cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-border bg-background shrink-0">
        <StatCard label="Total Members" value={users.length} color="var(--brand-blue)" />
        <StatCard label="Active" value={activeCount} color="var(--status-green)" />
        <StatCard label="Admins" value={adminCount} color="var(--status-red)" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background shrink-0 flex-wrap">
        <GooeyInput value={search} onValueChange={setSearch} placeholder="Search by name or email..." expandedWidth={384} />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
          aria-label="Filter by role"
        >
          <option value="all">All Roles</option>
          {roles.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No members found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">Member</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Joined</th>
                  {isAdmin && <th className="px-4 py-3 text-right text-caption font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filtered.map(user => {
                  const roleColor = ROLE_COLOR[user.role ?? "bd"]
                  const statusColor = USER_STATUS_COLOR[user.status ?? "inactive"]
                  const isSelf = user.id === activeUser?.id
                  return (
                    <tr key={user.id} className="bg-background transition-colors hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} size={32} />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {user.name}
                              {isSelf && <span className="ml-1.5 text-caption text-muted-foreground">(you)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md px-2 py-0.5 text-meta font-medium capitalize"
                          style={{ background: `color-mix(in srgb, ${roleColor} 9%, transparent)`, color: roleColor }}>
                          {roles.find(r => r.id === user.roleId)?.name ?? user.role ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="rounded-md px-2 py-0.5 text-meta font-medium capitalize"
                          style={{ background: `color-mix(in srgb, ${statusColor} 9%, transparent)`, color: statusColor }}>
                          {user.status ?? "unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {user.joinedAt ? formatDate(user.joinedAt) : "—"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingUser(user)}
                              className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => toggleStatus(user.id)}
                                disabled={updatingId === user.id}
                                className={[
                                  "flex h-7 items-center rounded px-2 text-meta font-medium transition-colors disabled:opacity-50 cursor-pointer",
                                  user.status === "active"
                                    ? "text-status-red hover:bg-status-red/10"
                                    : "text-status-emerald hover:bg-status-emerald/10",
                                ].join(" ")}
                              >
                                {updatingId === user.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : user.status === "active" ? (
                                  "Deactivate"
                                ) : (
                                  "Activate"
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvite && (
        <UserModal
          mode="invite"
          roles={roles}
          onClose={() => setShowInvite(false)}
          onSubmit={async ({ name, email, roleId }) => {
            const data = await apiPost<{ success: boolean; user: ApiAppUser }>("/api/users", { name, email, roleId })
            setUsers(us => [data.user, ...us])
          }}
        />
      )}

      {editingUser && (
        <UserModal
          mode="edit"
          roles={roles}
          user={editingUser}
          isSelf={editingUser.id === activeUser?.id}
          onClose={() => setEditingUser(null)}
          onSubmit={async ({ name, roleId }) => {
            await saveUserEdit(editingUser.id, {
              name,
              roleId: roleId !== editingUser.roleId ? (roleId ?? undefined) : undefined,
            })
          }}
        />
      )}
    </>
  )
}
