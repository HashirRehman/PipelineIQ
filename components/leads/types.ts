import type { LeadStatus } from "@/lib/constants"

export interface Lead {
  id: string
  profileId: string
  profileName: string
  jobTitle: string
  company: string
  jobLocation: string
  workType: "remote" | "onsite" | "hybrid"
  appliedAt: string
  status: LeadStatus
  assignedTo: string
  bdNotes: string
  salary: string
  parser: string
}

// Structural stand-ins for the people/profiles referenced by the lead mock
// data. They mirror the AppUser/Profile shapes the old app/page.tsx used to
// export (removed in the sidebar restructure), pinned to just the fields the
// lead views actually render (id/name/role).
export interface AppUser {
  id: string
  name: string
  role: "admin" | "lead" | "bd"
}

export interface Profile {
  id: string
  name: string
}
