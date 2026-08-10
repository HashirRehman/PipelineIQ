"use client"

import type { AppUser, Profile } from "@/components/leads/types"
import { ProfileUserFilters } from "@/components/leads/profile-user-filters"

/**
 * Profile + user filter bar for the Leads page. The two filters are COUPLED —
 * picking a profile narrows the user list to its assigned user and vice versa
 * (see ProfileUserFilters). The Pipeline page composes the same selects into
 * its larger filter bar.
 */
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
      <ProfileUserFilters
        profiles={profiles}
        bdUsers={bdUsers}
        profileFilter={profileFilter}
        setProfileFilter={setProfileFilter}
        bdFilter={bdFilter}
        setBdFilter={setBdFilter}
      />
    </div>
  )
}
