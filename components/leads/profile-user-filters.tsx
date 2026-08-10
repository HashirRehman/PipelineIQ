"use client"

import type { AppUser, Profile } from "@/components/leads/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

/**
 * Coupled Profile + User filter selects. The two filters can never contradict
 * each other:
 *   * picking a profile narrows the user dropdown to that profile's current
 *     assigned user (and vice versa)
 *   * selecting a user narrows the profile dropdown to that user's currently
 *     assigned profiles
 * If a selection in one dropdown becomes invalid because of a change in the
 * other, it resets to "All".
 *
 * Layout: `stacked` renders the selects full-width in a column (right-hand
 * filter sidebar); the default is an inline row (the Leads filter bar).
 */
export function ProfileUserFilters({
  profiles,
  bdUsers,
  profileFilter,
  setProfileFilter,
  bdFilter,
  setBdFilter,
  stacked = false,
  triggerClassName,
}: {
  profiles: Profile[]
  bdUsers: AppUser[]
  profileFilter: string
  setProfileFilter: (value: string) => void
  bdFilter: string
  setBdFilter: (value: string) => void
  stacked?: boolean
  triggerClassName?: string
}) {
  const selectedProfile = profiles.find((p) => p.id === profileFilter) ?? null

  // Users the user dropdown may offer: everything, or just the selected
  // profile's assigned user.
  const visibleUsers = selectedProfile
    ? bdUsers.filter((u) => u.id === selectedProfile.userId)
    : bdUsers

  // Profiles the profile dropdown may offer: everything, or just the ones
  // assigned to the selected user.
  const visibleProfiles =
    bdFilter === "all"
      ? profiles
      : profiles.filter((p) => p.userId === bdFilter)

  const handleProfileChange = (v: string) => {
    setProfileFilter(v)
    if (v !== "all") {
      const owner = profiles.find((p) => p.id === v)?.userId ?? null
      // The user filter must be empty or this profile's owner.
      if (bdFilter !== "all" && bdFilter !== owner) setBdFilter("all")
    }
  }

  const handleUserChange = (v: string) => {
    setBdFilter(v)
    if (v !== "all") {
      const owned = profiles.filter((p) => p.userId === v).map((p) => p.id)
      // The profile filter must be empty or owned by this user.
      if (profileFilter !== "all" && !owned.includes(profileFilter)) setProfileFilter("all")
    }
  }

  const baseTrigger = cn(
    "h-7 rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0",
    stacked ? "w-full" : "w-auto min-w-[150px]",
    triggerClassName,
  )

  return (
    <div className={cn("flex", stacked ? "w-full flex-col gap-2" : "items-center gap-2")}>
      <Select value={profileFilter} onValueChange={v => handleProfileChange(v ?? "all")}>
        <SelectTrigger size="sm" className={baseTrigger}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Profiles</SelectItem>
          {visibleProfiles.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={bdFilter} onValueChange={v => handleUserChange(v ?? "all")}>
        <SelectTrigger size="sm" className={cn(baseTrigger, !stacked && "min-w-[140px]")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          {visibleUsers.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
