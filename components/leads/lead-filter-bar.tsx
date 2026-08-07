"use client"

import type { AppUser, Profile } from "@/components/leads/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function LeadFilterBar({
  profiles,
  bdUsers,
  profileFilter,
  setProfileFilter,
  bdFilter,
  setBdFilter,
}: {
  profiles: Profile[]
  bdUsers: AppUser[]
  profileFilter: string
  setProfileFilter: (value: string) => void
  bdFilter: string
  setBdFilter: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-2 border-b border-border bg-background shrink-0 flex-wrap">
      <Select value={profileFilter} onValueChange={v => setProfileFilter(v ?? "all")}>
        <SelectTrigger size="sm" className="h-7 w-auto min-w-[150px] rounded-md text-[12px] text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
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
        <SelectTrigger size="sm" className="h-7 w-auto min-w-[140px] rounded-md text-[12px] text-muted-foreground bg-card border border-border shadow-none focus:ring-0">
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
