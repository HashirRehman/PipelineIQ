"use client";

import { useState, useEffect } from "react";
import { Check, Plus, X, Loader2 } from "lucide-react";
import { inviteUser, setUserActiveStatus } from "@/lib/actions/users";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { SearchInput } from "@/components/search-input";
import { TintedBadge } from "@/components/tinted-badge";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USER_STATUS_COLOR } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export interface UserItem {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  role_name: string;
  role_id?: string;
}

export interface RoleItem {
  id: string;
  name: string;
}

interface InviteModalProps {
  roles: RoleItem[];
  onClose: () => void;
}

const ROLE_COLOR_MAP: Record<string, string> = {
  admin: "#ef4444",
  bd_executive: "#6366f1",
  bd: "#6366f1",
  lead: "#f59e0b",
};

function getRoleColor(roleName: string): string {
  const normalized = roleName.toLowerCase().replace(/[\s-]/g, "_");
  return ROLE_COLOR_MAP[normalized] || "#3b82f6";
}

function InviteModal({ roles, onClose }: InviteModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>(roles[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !roleId) return;

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("fullName", fullName);
    formData.append("email", email);
    formData.append("roleId", roleId);

    const res = await inviteUser({}, formData);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else if (res.success) {
      setSent(true);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
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
        {sent ? (
          <div className="p-8 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <Check size={22} strokeWidth={2.5} className="text-[#10b981]" />
            </div>
            <div className="text-[15px] font-semibold text-[var(--fg)] mb-1.5">Invitation sent!</div>
            <div className="text-xs text-[var(--muted-fg)] mb-5">An invite email has been sent to {email}</div>
            <Button onClick={onClose} className="bg-[var(--primary)] text-white hover:opacity-90 text-xs font-semibold px-5 shadow-none">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 px-6">
            <div className="flex flex-col gap-3.5 mb-5">
              <div>
                <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Full Name *</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="w-full bg-[var(--secondary)] border-[var(--border-strong)] text-[var(--fg)] text-xs h-9"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Email *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  required
                  className="w-full bg-[var(--secondary)] border-[var(--border-strong)] text-[var(--fg)] text-xs h-9"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--muted-fg)] mb-1.25">Role *</label>
                <div className="flex gap-2">
                  {roles.map((r) => {
                    const color = getRoleColor(r.name);
                    const selected = roleId === r.id;
                    return (
                      <Button
                        key={r.id}
                        type="button"
                        variant="ghost"
                        onClick={() => setRoleId(r.id)}
                        className="flex-1 h-9 rounded-md text-xs capitalize font-mono shadow-none"
                        style={{
                          background: selected ? `${color}18` : "var(--secondary)",
                          border: selected ? `1px solid ${color}40` : "1px solid var(--border-strong)",
                          fontWeight: selected ? 700 : 400,
                          color: selected ? color : "var(--fg)",
                        }}
                      >
                        {r.name}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
                  {error}
                </div>
              )}
            </div>
            <div className="flex gap-2.5">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-[var(--border-strong)] text-[var(--fg)] text-xs h-9 shadow-none">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!fullName || !email || !roleId || isSubmitting}
                className={`flex-[2] text-xs font-semibold h-9 shadow-none flex items-center justify-center gap-2 ${
                  !fullName || !email || !roleId || isSubmitting
                    ? "bg-[var(--secondary)] text-[var(--muted-fg)]"
                    : "bg-[var(--primary)] text-white hover:opacity-90"
                }`}
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting ? "Sending Invite…" : "Send Invite"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface UsersPageClientProps {
  initialUsers: UserItem[];
  roles: RoleItem[];
  currentUserId: string;
}

export function UsersPageClient({ initialUsers, roles, currentUserId }: UsersPageClientProps) {
  const [prevInitialUsers, setPrevInitialUsers] = useState(initialUsers);
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (prevInitialUsers !== initialUsers) {
    setPrevInitialUsers(initialUsers);
    setUsers(initialUsers);
  }

  const handleToggleStatus = async (userItem: UserItem) => {
    if (userItem.id === currentUserId || togglingId) return;
    const nextStatus = !userItem.is_active;
    setTogglingId(userItem.id);
    setActionError(null);

    // Optimistic UI update
    setUsers((prev) =>
      prev.map((u) => (u.id === userItem.id ? { ...u, is_active: nextStatus } : u))
    );

    const res = await setUserActiveStatus(userItem.id, nextStatus);
    setTogglingId(null);

    if (res.error) {
      setActionError(res.error);
      // Revert on error
      setUsers((prev) =>
        prev.map((u) => (u.id === userItem.id ? { ...u, is_active: userItem.is_active } : u))
      );
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchRole =
      roleFilter === "all" ||
      u.role_name.toLowerCase() === roleFilter.toLowerCase();
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? u.is_active : !u.is_active);
    return matchQ && matchRole && matchStatus;
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role_name.toLowerCase() === "admin").length;
  const bdCount = users.filter(
    (u) =>
      u.role_name.toLowerCase() === "bd_executive" ||
      u.role_name.toLowerCase() === "bd"
  ).length;
  const unassignedCount = users.filter((u) => u.role_name === "Unassigned").length;

  return (
    <div className="p-7 px-8 flex-1">
      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => setActionError(null)} className="text-red-500 hover:bg-red-500/10">
            <X size={14} />
          </Button>
        </div>
      )}

      <PageHeader
        title="Users"
        subtitle={`${totalUsers} team member${totalUsers === 1 ? "" : "s"}`}
        className="mb-6"
        actions={
          <Button
            onClick={() => setInviting(true)}
            className="h-auto flex items-center gap-1.75 p-2.25 px-4 bg-[var(--primary)] border-none rounded-[7px] cursor-pointer text-xs font-semibold text-white hover:opacity-90 shadow-none"
          >
            <Plus size={14} strokeWidth={2.5} />
            Invite User
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Users"
          value={totalUsers}
          color="var(--primary)"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
        <StatCard
          label="Admins"
          value={adminCount}
          color="#ef4444"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
        <StatCard
          label="BD Executives"
          value={bdCount}
          color="#6366f1"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
        <StatCard
          label="Unassigned"
          value={unassignedCount}
          color="#f59e0b"
          className="py-3.5 px-4"
          valueClassName="text-[22px]"
          labelClassName="text-[var(--muted-fg)]"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 mb-4.5">
        <SearchInput
          placeholder="Search users…"
          value={search}
          onChange={setSearch}
          className="flex-1"
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? "all")}>
          <SelectTrigger className="min-w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="bd_executive">BD Executive</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
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
              {["User", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                <TableHead
                  key={h}
                  className="p-2.5 px-4 text-left text-[11px] font-semibold text-[var(--muted-fg)] uppercase tracking-[0.5px] font-mono"
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => {
              const roleColor = getRoleColor(u.role_name);
              const statusStr = u.is_active ? "active" : "inactive";
              const statusColor = USER_STATUS_COLOR[statusStr] || "#64748b";

              return (
                <TableRow
                  key={u.id}
                  className="border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]"
                >
                  <TableCell className="p-3.25 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={u.full_name || u.email} size={34} />
                      <div>
                        <div className="font-semibold text-[var(--fg)]">
                          {u.full_name || "—"}
                        </div>
                        {u.id === currentUserId && (
                          <div className="text-[10px] text-[var(--primary)] font-mono">You</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="p-3.25 px-4 text-[var(--muted-fg)]">{u.email}</TableCell>
                  <TableCell className="p-3.25 px-4">
                    <TintedBadge color={roleColor}>{u.role_name}</TintedBadge>
                  </TableCell>
                  <TableCell className="p-3.25 px-4">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: statusColor }}
                      />
                      <span className="text-xs capitalize" style={{ color: statusColor }}>
                        {statusStr}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-3.25 px-4 font-mono">
                    <span className="text-xs text-[var(--muted-fg)]">
                      {formatDate(u.created_at)}
                    </span>
                  </TableCell>
                  <TableCell className="p-3.25 px-4">
                    {u.id !== currentUserId && (
                      <Button
                        onClick={() => handleToggleStatus(u)}
                        disabled={togglingId === u.id}
                        className={`h-auto p-1 px-2.5 bg-transparent border rounded-md cursor-pointer text-[11px] transition-colors shadow-none ${
                          u.is_active
                            ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
                            : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-[var(--muted-fg)] text-sm">
            No users match your search
          </div>
        )}
      </div>

      {inviting && <InviteModal roles={roles} onClose={() => setInviting(false)} />}
    </div>
  );
}
