"use client"

import type { AppUser, Profile } from "@/components/leads/types"
import { SearchInput } from "@/components/search-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LEAD_STATUSES } from "@/lib/constants"
import type { LeadFilterProps } from "./use-lead-filters"

export function LeadFilterBar({
  profiles,
  bdUsers,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  profileFilter,
  setProfileFilter,
  bdFilter,
  setBdFilter,
}: LeadFilterProps & { profiles: Profile[]; bdUsers: AppUser[] }) {
  return (
    <div className="flex gap-2.5 mb-5 shrink-0 flex-wrap">
      <SearchInput
        placeholder="Search leads…"
        value={search}
        onChange={setSearch}
        className="flex-1 min-w-[180px]"
      />
      <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? "all")}>
        <SelectTrigger className="min-w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stages</SelectItem>
          {LEAD_STATUSES.map(s => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={profileFilter} onValueChange={v => setProfileFilter(v ?? "all")}>
        <SelectTrigger className="min-w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Profiles</SelectItem>
          {profiles.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={bdFilter} onValueChange={v => setBdFilter(v ?? "all")}>
        <SelectTrigger className="min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All BDs</SelectItem>
          {bdUsers.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
