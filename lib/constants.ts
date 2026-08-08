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

export const JOB_STATUS_BG: Record<string, string> = {
  new:       "transparent",
  applied:   "color-mix(in srgb, var(--status-green) 6%, transparent)",
  dismissed: "color-mix(in srgb, var(--status-red) 4%, transparent)",
};

export const JOB_STATUS_BORDER: Record<string, string> = {
  new:       "var(--border)",
  applied:   "color-mix(in srgb, var(--status-green) 20%, transparent)",
  dismissed: "color-mix(in srgb, var(--status-red) 15%, transparent)",
};
