export type UserRole = "admin" | "lead" | "bd";

/** Top-level sections of the dashboard shell (mirrors the sidebar NAV). */
export type TabId =
  | "profiles"
  | "discovery"
  | "applied-jobs"
  | "leads"
  | "users"
  | "statistics";

// Mirrors the pipeline_stages seed in
// supabase/migrations/20260724120000_module4_lead_management.sql, in
// order_index order, so this UI doesn't need re-labelling when it's wired
// to real data. Stage tracking itself is Module 5 and not built yet.
export const LEAD_STATUSES = [
  "Applied",
  "Assessment Received",
  "Assessment Submitted",
  "HR Interview",
  "Tech Interview 1",
  "Tech Interview 2",
  "Client Interview",
  "Offer Received",
  "Offer Accepted/Rejected",
  "Closed",
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

// The terminal stage a lead moves to when its list-view checkbox is ticked.
export const LEAD_STATUS_DONE: LeadStatus = "Closed"

export const LEAD_STATUS_COLOR: Record<string, string> = {
  Applied: "#6366f1",
  "Assessment Received": "#8b5cf6",
  "Assessment Submitted": "#a855f7",
  "HR Interview": "#f59e0b",
  "Tech Interview 1": "#06b6d4",
  "Tech Interview 2": "#0ea5e9",
  "Client Interview": "#ec4899",
  "Offer Received": "#10b981",
  "Offer Accepted/Rejected": "#14b8a6",
  Closed: "#64748b",
}

// Derived rather than hand-maintained — a second literal map was one more
// place to forget when the stage list changes.
export const LEAD_STATUS_BG: Record<string, string> = Object.fromEntries(
  Object.entries(LEAD_STATUS_COLOR).map(([status, color]) => [status, `${color}1a`]),
)

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
