export type UserRole = "admin" | "lead" | "bd";

export type TabId =
  | "profiles"
  | "discovery"
  | "applied-jobs"
  | "leads"
  | "users"
  | "statistics";

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
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_DONE: LeadStatus = "Closed";

// Brand palette derived from Recurso Labs logo gradient (#1e3a6e navy → #0078d4 bright blue)
// navy (early), sky-blue (mid), teal (progressing), green (positive), slate (closed)
export const LEAD_STATUS_COLOR: Record<string, string> = {
  "Applied":                  "#1e3a6e",  /* Recurso navy — first touch */
  "Assessment Received":      "#1e3a6e",
  "Assessment Submitted":     "#0078d4",  /* Recurso bright blue — action taken */
  "HR Interview":             "#d97706",  /* amber — pending decision */
  "Tech Interview 1":         "#0078d4",
  "Tech Interview 2":         "#0078d4",
  "Client Interview":         "#0369a1",  /* deep sky — final interview */
  "Offer Received":           "#059669",  /* green — positive outcome */
  "Offer Accepted/Rejected":  "#059669",
  "Closed":                   "#64748b",  /* slate — terminal */
};

export const LEAD_STATUS_BG: Record<string, string> = Object.fromEntries(
  Object.entries(LEAD_STATUS_COLOR).map(([status, color]) => [status, `${color}18`]),
);

export const WORK_TYPE_COLOR: Record<string, string> = {
  remote: "#059669",
  onsite: "#0078d4",
  hybrid: "#d97706",
};

export const PARSER_COLOR: Record<string, string> = {
  LinkedIn:   "#0078d4",
  Indeed:     "#1e3a6e",
  Greenhouse: "#24a148",
  Lever:      "#0369a1",
  Workday:    "#d97706",
};

export const ROLE_COLOR: Record<UserRole, string> = {
  admin: "#ef4444",
  lead:  "#d97706",
  bd:    "#0078d4",
};

export const USER_STATUS_COLOR: Record<string, string> = {
  active:   "#059669",
  inactive: "#64748b",
};

export const JOB_STATUS_BG: Record<string, string> = {
  new:       "transparent",
  applied:   "rgba(5,150,105,0.06)",
  dismissed: "rgba(239,68,68,0.04)",
};

export const JOB_STATUS_BORDER: Record<string, string> = {
  new:       "var(--border)",
  applied:   "rgba(5,150,105,0.2)",
  dismissed: "rgba(239,68,68,0.15)",
};
