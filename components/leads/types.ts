import type { EngagementType } from "@/lib/constants"

export interface Lead {
  id: string
  jobId: string
  profileId: string
  profileName: string
  jobTitle: string
  company: string
  jobLocation: string
  workType: "remote" | "onsite" | "hybrid"
  appliedAt: string
  /** Stage name — comes from the database's pipeline_stages, not a constant. */
  status: string
  /** The profile's current assigned user — leads follow the profile, so
   * this is who owns the lead now (not the creation-time snapshot). Null
   * when the profile has no assigned user. */
  assignedTo: string | null
  /** Applier's Notes — writable by the profile's current assigned user
   * (assignedTo) plus Admin / BD Manager (canManageLeadNotes). */
  notes: string
  salary: string | null
  parser: string
  applyUrl: string
  /** Raw jobs.parsed_data (jsonb) — carries the manual/imported extras. */
  parsedData: unknown | null
  /** How the originating job reached us; null when unclassified. */
  engagementType: EngagementType | null
}

// Structural stand-ins for the people/profiles referenced by the lead rows.
// They mirror the AppUser/Profile shapes the old app/page.tsx used to export
// (removed in the sidebar restructure), pinned to just the fields the lead
// views actually render (id/name/role). The ownership links (profile.userId,
// user.profileIds) drive the coupled profile/user filters in the sidebar.
export interface AppUser {
  id: string
  name: string
  role: "admin" | "lead" | "bd"
  /** Ids of the profiles currently assigned to this user. */
  profileIds: string[]
}

export interface Profile {
  id: string
  name: string
  /** The user this profile is currently assigned to (null = unassigned). */
  userId: string | null
}
