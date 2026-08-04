import type { ProfileStatus, UserRole } from "@/app/page"

export const LEAD_STATUSES = [
  "Applied",
  "Screening",
  "Interview",
  "Technical",
  "Offer",
  "Closed",
] as const

export const LEAD_STATUS_COLOR: Record<string, string> = {
  Applied: "#6366f1",
  Screening: "#f59e0b",
  Interview: "#06b6d4",
  Technical: "#ec4899",
  Offer: "#10b981",
  Closed: "#64748b",
}

export const LEAD_STATUS_BG: Record<string, string> = {
  Applied: "rgba(99,102,241,0.1)",
  Screening: "rgba(245,158,11,0.1)",
  Interview: "rgba(6,182,212,0.1)",
  Technical: "rgba(236,72,153,0.1)",
  Offer: "rgba(16,185,129,0.1)",
  Closed: "rgba(100,116,139,0.1)",
}

export const WORK_TYPE_COLOR: Record<string, string> = {
  remote: "#10b981",
  onsite: "#6366f1",
  hybrid: "#f59e0b",
}

export const PARSER_COLOR: Record<string, string> = {
  LinkedIn: "#0a66c2",
  Indeed: "#003a9b",
  Greenhouse: "#24a148",
  Lever: "#7c3aed",
  Workday: "#f59e0b",
}

export const PROFILE_STATUS_COLOR: Record<ProfileStatus, string> = {
  active: "#10b981",
  inactive: "#f59e0b",
  archived: "#64748b",
}

export const ROLE_COLOR: Record<UserRole, string> = {
  admin: "#ef4444",
  lead: "#f59e0b",
  bd: "#6366f1",
}

export const USER_STATUS_COLOR: Record<string, string> = {
  active: "#10b981",
  inactive: "#64748b",
}

export const JOB_STATUS_BG: Record<string, string> = {
  new: "transparent",
  applied: "rgba(16,185,129,0.06)",
  dismissed: "rgba(239,68,68,0.04)",
}

export const JOB_STATUS_BORDER: Record<string, string> = {
  new: "var(--border)",
  applied: "rgba(16,185,129,0.2)",
  dismissed: "rgba(239,68,68,0.15)",
}
