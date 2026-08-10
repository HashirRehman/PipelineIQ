export type UserRole = "admin" | "lead" | "bd";

export type TabId =
  | "profiles"
  | "discovery"
  | "applied-jobs"
  | "leads"
  | "users"
  | "statistics"
  | "settings";

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

/* Filter vocabulary shared by the job list pages (Discovery, Pipeline) */
export const WORK_TYPES = ["All Types", "remote", "onsite"] as const;

export const PARSERS = ["All Sources", "LinkedIn", "Indeed", "Greenhouse", "Lever", "Workday"] as const;

/* Date-range and sort filters — shared by the Pipeline, Leads, and Discovery
   pages. The UI components (components/jobs/date-range-filter.tsx,
   sort-filter.tsx) and the server-side parsing (lib/api/job-filters.ts) read
   from these, so a new option lands everywhere with one edit.

   Weeks are Friday-morning → Thursday-night (the business week, not
   Monday–Sunday); months and years are actual calendar periods — NOT rolling
   "last 30 days / 12 months". The exact window for the selected range is
   computed client-side in the user's local time (lib/date-window.ts) and sent
   to the API as explicit from/to, so the UI can also display the precise
   range (e.g. "This week · Aug 7 – Aug 13").

   The Pipeline page adds two more exclusive date controls on top of these:
   a months-of-this-year dropdown and a This/Last year dropdown — picking one
   clears the others (they'd otherwise conflict). */
export const DATE_RANGES = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
] as const;

export type DateRange = (typeof DATE_RANGES)[number]["value"];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "relevance", label: "Relevance" },
  { value: "company_asc", label: "Company A–Z" },
  { value: "company_desc", label: "Company Z–A" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/* ════════════════════════════════════════════════════════════════════
   COLOR TOKENS
   ────────────────────────────────────────────────────────────────────
   Every color value below is a CSS variable defined in ONE place:
   `app/globals.css` (the theme's single source of truth). Change a
   color there and every badge, status, score and chart in the app
   updates automatically. Alpha variants are built with color-mix()
   so they follow the same variables.
   ════════════════════════════════════════════════════════════════════ */

/** Recurso Labs brand palette (navy → bright blue → deep sky) */
export const BRAND = {
  navy: "var(--brand-navy)",
  blue: "var(--brand-blue)",
  sky: "var(--brand-sky)",
  greenhouse: "var(--source-greenhouse)",
} as const;

/** Semantic status colors — same in light & dark mode */
export const STATUS = {
  green: "var(--status-green)",
  emerald: "var(--status-emerald)",
  amber: "var(--status-amber)",
  red: "var(--status-red)",
  slate: "var(--status-slate)",
} as const;

/** Relevance score → color (0–100) */
export function scoreColor(score: number): string {
  return score >= 70 ? STATUS.green : score >= 40 ? STATUS.amber : STATUS.red;
}

// Lead pipeline: navy (early), blue (action taken), sky (final interview),
// amber (pending), green (positive), slate (closed)
export const LEAD_STATUS_COLOR: Record<string, string> = {
  "Applied":                 BRAND.navy,  /* first touch */
  "Assessment Received":     BRAND.navy,
  "Assessment Submitted":    BRAND.blue,  /* action taken */
  "HR Interview":            STATUS.amber, /* pending decision */
  "Tech Interview 1":        BRAND.blue,
  "Tech Interview 2":        BRAND.blue,
  "Client Interview":        BRAND.sky,  /* final interview */
  "Offer Received":          STATUS.green, /* positive outcome */
  "Offer Accepted/Rejected": STATUS.green,
  "Closed":                  STATUS.slate, /* terminal */
};

export const LEAD_STATUS_BG: Record<string, string> = Object.fromEntries(
  Object.entries(LEAD_STATUS_COLOR).map(([status, color]) => [
    status,
    `color-mix(in srgb, ${color} 10%, transparent)`,
  ]),
);

export const WORK_TYPE_COLOR: Record<string, string> = {
  remote: STATUS.green,
  onsite: BRAND.blue,
  hybrid: STATUS.amber,
};

export const PARSER_COLOR: Record<string, string> = {
  LinkedIn:   BRAND.blue,
  Indeed:     BRAND.navy,
  Greenhouse: BRAND.greenhouse,
  Lever:      BRAND.sky,
  Workday:    STATUS.amber,
};

export const ROLE_COLOR: Record<UserRole, string> = {
  admin: STATUS.red,
  lead:  STATUS.amber,
  bd:    BRAND.blue,
};

export const USER_STATUS_COLOR: Record<string, string> = {
  active:   STATUS.green,
  inactive: STATUS.slate,
};

