/** The single source of truth for the org's display name — every UI string,
 *  org-lookup query, and seed value should reference this instead of
 *  hardcoding "Recurso Labs". */
export const organizationName = "Recurso Labs";

export type UserRole = "admin" | "lead" | "bd";

export type TabId =
  | "dashboard"
  | "statistics"
  | "profiles"
  | "discovery"
  | "applied-jobs"
  | "leads"
  | "lead-stages"
  | "users"
  | "settings";

/* Filter vocabulary shared by the job list pages (Discovery, Pipeline) */
export const WORK_TYPES = ["All Types", "remote", "onsite"] as const;

/* Date-range and sort filters — shared by the Pipeline, Leads, and Discovery
   pages. The UI components (components/jobs/filter-sections.tsx's
   DateRangeSection / SortSection) and the server-side parsing
   (lib/api/job-filters.ts) read from these, so a new option lands everywhere
   with one edit.

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

/* How a job reached us — mirrors the jobs.engagement_type enum
   (migration 20260814090000). Optional on every write: an unset value is
   null, which is where every scraped job stays until someone classifies it.
   One list feeds the create form, the import mapper, and the filters. */
export const ENGAGEMENT_TYPES = [
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
] as const;

export type EngagementType = (typeof ENGAGEMENT_TYPES)[number]["value"];

export const ENGAGEMENT_TYPE_VALUES = ENGAGEMENT_TYPES.map((t) => t.value) as readonly EngagementType[];

/** "INBOUND", " inbound " → "inbound"; anything unrecognised → null. */
export function parseEngagementType(input: string | null | undefined): EngagementType | null {
  const normalized = (input ?? "").trim().toLowerCase();
  return ENGAGEMENT_TYPE_VALUES.find((value) => value === normalized) ?? null;
}

/* ════════════════════════════════════════════════════════════════════
   COLOR TOKENS
   ────────────────────────────────────────────────────────────────────
   Every color value below is a CSS variable defined in ONE place:
   `app/globals.css` (the theme's single source of truth). Change a
   color there and every badge, status, score and chart in the app
   updates automatically. Alpha variants are built with color-mix()
   so they follow the same variables.
   ════════════════════════════════════════════════════════════════════ */

/** {@link organizationName} brand palette (navy → bright blue → deep sky) */
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

/* Lead-pipeline stage colors — stages come from the database
   (pipeline_stages), so a stage's color is derived from its position in the
   ordered list rather than its name. The palette walks navy (early) → blue
   (action taken) → sky (final interview) → amber (pending) → green
   (positive) → slate (terminal), then cycles. */
export const STAGE_PALETTE = [
  BRAND.navy,
  BRAND.blue,
  STATUS.amber,
  BRAND.sky,
  STATUS.green,
  STATUS.slate,
] as const;

export function stageColor(index: number): string {
  return STAGE_PALETTE[index % STAGE_PALETTE.length] ?? STATUS.slate;
}

/** Professional categorical palette for per-user / per-profile chart series.
 * Distinct, muted-professional hues (blue, emerald, amber, red, sky, teal,
 * navy, slate) that stay readable on both light and dark surfaces. */
export const SERIES_PALETTE = [
  BRAND.blue,
  STATUS.emerald,
  STATUS.amber,
  STATUS.red,
  BRAND.sky,
  STATUS.green,
  BRAND.navy,
  STATUS.slate,
] as const;

export const WORK_TYPE_COLOR: Record<string, string> = {
  remote: STATUS.green,
  onsite: BRAND.blue,
  hybrid: STATUS.amber,
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

/** Lead Stages state → color. Admin-controlled per stage (Lead Stages page);
 * drives Leads board/list grouping (active shown normally, paused shown in
 * its own section, closed shown struck-through). */
export const PIPELINE_STAGE_STATE_COLOR: Record<string, string> = {
  active: STATUS.green,
  paused: STATUS.amber,
  closed: STATUS.slate,
};

