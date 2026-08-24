"use client"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Plus, X, Loader2, Pencil, Trash2, Users2, UserCheck, ShieldCheck } from "lucide-react"
import type { ApiAppUser, UsersApiResponse } from "@/app/api/users/route"
import { ApiError, apiGet, apiPost, apiRequest } from "@/lib/api/client"
import { queryKeys } from "@/lib/api/query-keys"
import { Avatar } from "@/components/avatar"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { GooeyInput } from "@/components/ui/gooey-input"
import { Skeleton } from "@/components/ui/skeleton"
import { ResultsCount } from "@/components/results-count"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ROLE_COLOR, USER_STATUS_COLOR } from "@/lib/constants"
import { formatDate } from "@/lib/format"

interface RoleOption { id: string; name: string; description: string | null }

const labelClass = "block text-meta font-medium text-muted-foreground mb-1.5"
const inputClass = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-all focus:border-ring focus:ring-2 focus:ring-ring/50"

/* ─── User Modal (shared by Invite + Edit) ─── */
type UserModalMode = "invite" | "edit"

interface UserModalProps {
  mode: UserModalMode
  roles: RoleOption[]
  user?: ApiAppUser // edit only
  isSelf?: boolean // edit only
  allowedDomain?: string | null
  onClose: () => void
  onSubmit: (values: { name: string; email: string; roleId: string }) => Promise<void>
}

function UserModal({ mode, roles, user, isSelf = false, allowedDomain, onClose, onSubmit }: UserModalProps) {
  const isInvite = mode === "invite"
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [roleId, setRoleId] = useState<string>(isInvite ? (roles[0]?.id ?? "") : (user?.roleId ?? ""))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  const domainSuffix = allowedDomain?.trim()
    ? (allowedDomain.trim().startsWith("@") ? allowedDomain.trim() : `@${allowedDomain.trim()}`)
    : null

  const canSubmit = isInvite ? Boolean(name && email && roleId) : Boolean(name.trim())

  const handleSubmit = async () => {
    if (!canSubmit || loading) return
    if (isInvite && domainSuffix && !email.trim().toLowerCase().endsWith(domainSuffix.toLowerCase())) {
      setError(`Only ${domainSuffix} email domain is allowed.`)
      return
    }
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

  const roleSelect = (
    <Select value={roleId} onValueChange={(v) => { if (v) setRoleId(v) }} name="role">
      <SelectTrigger className="h-9 w-full rounded-lg text-sm">
        <SelectValue placeholder="Select a role">
          {() => roles.find(r => r.id === roleId)?.name ?? "Select a role"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {roles.map(r => (
          <SelectItem key={r.id} value={r.id}>
            <div className="flex flex-col">
              <span>{r.name}</span>
              {r.description && (
                <span className="text-xs text-muted-foreground">{r.description}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
            <Button type="button" onClick={onClose} className="h-9 rounded-md px-5 hover:bg-primary/90">Done</Button>
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
                placeholder={isInvite ? (domainSuffix ? `jane${domainSuffix}` : "jane@company.com") : undefined}
                readOnly={!isInvite}
              />
              {isInvite && domainSuffix && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Only <b>{domainSuffix}</b> email domain is allowed.
                </p>
              )}
            </div>
            {isSelf && !isInvite ? (
              <p className="text-caption text-muted-foreground">You cannot change your own role.</p>
            ) : (
              <div>
                <label className={labelClass}>Role</label>
                {roleSelect}
              </div>
            )}
            <div className="flex gap-2.5 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-9 rounded-md hover:bg-accent">Cancel</Button>
              <Button type="button" onClick={handleSubmit} disabled={!canSubmit || loading}
                className="flex-[2] h-9 gap-1.5 rounded-md font-semibold hover:bg-primary/90">
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                {isInvite ? "Send Invite" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Main Tab ─── */
export default function UsersTab() {
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState("")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showInvite, setShowInvite] = useState(false)
  const [editingUser, setEditingUser] = useState<ApiAppUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<ApiAppUser | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const usersKey = queryKeys.users.list()
  const { data, isPending, error: queryErr } = useQuery({
    queryKey: usersKey,
    queryFn: ({ signal }) => apiGet<UsersApiResponse>("/api/users", signal),
  })
  const loading = isPending

  const rawUsers: ApiAppUser[] = data?.users ?? []
  const users = Array.from(new Map(rawUsers.map(u => [u.id, u])).values())

  // Log if deduplication occurred (indicates potential API issue)
  if (users.length < rawUsers.length) {
    console.warn(`User list deduplication: ${rawUsers.length} raw users → ${users.length} unique users`);
  }
  const roles: RoleOption[] = data?.roles ?? []
  const activeUser = data?.currentUser ?? null
  const isAdmin = data?.isAdmin ?? false
  const canInvite = data?.canInvite ?? false
  const allowedDomain = data?.allowedEmailDomain ?? null

  // 403 = role may not see the roster; a real answer, not a failure.
  const accessDenied = queryErr instanceof ApiError && queryErr.status === 403
  const error = queryErr && !accessDenied ? "Unable to load team members." : null

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })

  /** Optimistic write straight into the cache. */
  const patchCachedUsers = (update: (list: ApiAppUser[]) => ApiAppUser[]) => {
    queryClient.setQueryData<UsersApiResponse>(usersKey, (current) =>
      current ? { ...current, users: update(current.users) } : current,
    )
  }

  const saveUserEdit = async (userId: string, updates: { name?: string; roleId?: string }) => {
    setActionError("")
    await apiRequest<{ success: boolean }>("/api/users", "PATCH", { userId, ...updates })
    await refreshUsers()
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
    patchCachedUsers(us => us.map(u => u.id === id ? { ...u, status: newStatus } : u))

    try {
      await apiRequest<{ success: boolean }>("/api/users", "PATCH", {
        userId: id,
        status: newStatus,
      })
    } catch (err) {
      // Revert the optimistic update on error.
      patchCachedUsers(us => us.map(u => u.id === id ? { ...u, status: target.status } : u))
      setActionError(err instanceof Error ? err.message : "Failed to update user status.")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser || deletePending) return
    setDeletePending(true)
    setDeleteError("")
    try {
      await apiRequest<{ success: boolean }>("/api/users", "DELETE", { userId: deletingUser.id })
      await refreshUsers()
      setDeletingUser(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete user.")
    } finally {
      setDeletePending(false)
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

  // Edit / deactivate / delete on any row, including one's own, is Admin-only.
  const showActionsColumn = isAdmin

  if (accessDenied) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="text-sm font-semibold text-foreground mb-1.5">Access denied</div>
          <div className="text-xs text-muted-foreground">
            Only administrators and BD managers can view team members.
          </div>
        </div>
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-8 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Unable to load team members.</div>
      </div>
    )
  }

  return (
    <>
      {actionError && (
        <div className="mx-6 mb-0 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{actionError}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setActionError("")}
            aria-label="Dismiss error"
            className="size-6 text-destructive/70 hover:bg-transparent hover:text-destructive"
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-border bg-background shrink-0">
        <StatCard label="Total Members" value={users.length} icon={Users2} accent="var(--brand-blue)" delay={0} />
        <StatCard label="Active" value={activeCount} icon={UserCheck} accent="var(--status-green)" delay={60} />
        <StatCard label="Admins" value={adminCount} icon={ShieldCheck} accent="var(--status-red)" delay={120} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-background shrink-0 flex-wrap">
        <GooeyInput value={search} onValueChange={setSearch} placeholder="Search by name or email…" expandedWidth={300} />
        <Select value={roleFilter} onValueChange={(v) => { if (v) setRoleFilter(v) }} name="roleFilter">
          <SelectTrigger size="sm" aria-label="Filter by role" className="h-8 rounded-lg bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v) }} name="statusFilter">
          <SelectTrigger size="sm" aria-label="Filter by status" className="h-8 rounded-lg bg-background text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {canInvite && (
          <Button
            type="button"
            onClick={() => setShowInvite(true)}
            className="ml-auto h-9 rounded-md px-3 hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border text-center"
            style={{ animation: "chart-fade-in 0.25s ease-out backwards" }}
          >
            <p className="text-sm font-medium text-foreground">No members found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div
              className="flex items-center pb-3"
              style={{ animation: "chart-fade-in 0.25s ease-out backwards" }}
            >
              <ResultsCount
                count={filtered.length}
                label={filtered.length === 1 ? "member" : "members"}
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">Member</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Status</th>
                  <th className="px-4 py-3 text-left text-caption font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Joined</th>
                  {showActionsColumn && <th className="px-4 py-3 text-right text-caption font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filtered.map((user, idx) => {
                  const roleColor = ROLE_COLOR[user.role ?? "bd"]
                  const statusColor = USER_STATUS_COLOR[user.status ?? "inactive"]
                  const isSelf = user.id === activeUser?.id
                  return (
                    <tr
                      key={`${user.id}-${idx}`}
                      style={{
                        animation: "chart-rise 0.3s ease-out backwards",
                        animationDelay: `${Math.min(idx, 12) * 25}ms`,
                      }}
                      className="group bg-background transition-colors duration-150 hover:bg-accent/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="transition-transform duration-150 group-hover:scale-105">
                            <Avatar name={user.name} size={32} />
                          </div>
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
                          {roles.find(r => r.id === user.roleId)?.name ?? user.role}
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
                          {user.joinedAt ? formatDate(user.joinedAt) : "N/A"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingUser(user)}
                              className="size-7 rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                              title="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            {!isSelf && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStatus(user.id)}
                                disabled={updatingId === user.id}
                                className={[
                                  "h-7 rounded px-2 text-meta font-medium",
                                  user.status === "active"
                                    ? "text-status-red hover:bg-status-red/10 hover:text-status-red"
                                    : "text-status-emerald hover:bg-status-emerald/10 hover:text-status-emerald",
                                ].join(" ")}
                              >
                                {updatingId === user.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : user.status === "active" ? (
                                  "Deactivate"
                                ) : (
                                  "Activate"
                                )}
                              </Button>
                            )}
                            {!isSelf && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => { setDeleteError(""); setDeletingUser(user) }}
                                className="size-7 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="Delete permanently"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
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
          </>
        )}
      </div>

      {showInvite && (
        <UserModal
          mode="invite"
          roles={roles}
          allowedDomain={allowedDomain}
          onClose={() => setShowInvite(false)}
          onSubmit={async ({ name, email, roleId }) => {
            await apiPost<{ success: boolean; user: ApiAppUser }>("/api/users", { name, email, roleId })
            await refreshUsers()
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
              roleId: roleId !== editingUser.roleId ? roleId : undefined,
            })
          }}
        />
      )}

      {deletingUser && (
        <Dialog open onOpenChange={open => { if (!open) setDeletingUser(null) }}>
          <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <DialogTitle className="text-base font-semibold">Delete user</DialogTitle>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {deleteError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {deleteError}
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed">
                Permanently delete <span className="font-semibold">{deletingUser.name}</span>?
                This removes their account and comments, and unassigns them from their
                profiles. Their leads and profile data are kept. This cannot be undone.
              </p>
              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeletingUser(null)}
                  className="flex-1 h-9 rounded-md hover:bg-accent"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={deletePending}
                  className="flex-[2] h-9 gap-1.5 rounded-md bg-destructive font-semibold text-white hover:bg-destructive/90"
                >
                  {deletePending && <Loader2 className="size-3.5 animate-spin" />}
                  Delete Permanently
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
