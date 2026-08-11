import type { DateRange, SortOption } from "@/lib/constants";

// Shared server-side parsing for the date-range / sort filters used by the
// leads and discovery APIs. The UI components (DateRangeSection / SortSection
// in components/jobs/filter-sections.tsx) render the same option lists; keep
// them in lib/constants.ts (DATE_RANGES / SORT_OPTIONS) so UI and API never
// drift.
//
// The exact date window (Friday–Thursday weeks, calendar months/years) is
// computed client-side in the user's local time (lib/date-window.ts) and sent
// as explicit `from` / `to` ISO params — the server just filters within the
// window, so the client and server can never disagree about a boundary.

export interface DateWindow {
  from: string;
  to: string | null;
}

const DATE_RANGE_VALUES = new Set<string>([
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "all",
]);

export function parseDateRange(value: string | null | undefined): DateRange {
  return DATE_RANGE_VALUES.has(value ?? "") ? (value as DateRange) : "all";
}

/** Read the explicit from/to window from query params, or null for all time. */
export function parseDateWindow(params: {
  get(name: string): string | null;
}): DateWindow | null {
  const from = params.get("from");
  if (!from) return null;
  return { from, to: params.get("to") || null };
}

/** True when the ISO timestamp falls inside the window (no window = all). */
export function isWithinWindow(ts: string | null | undefined, window: DateWindow | null): boolean {
  if (!window) return true;
  if (!ts) return false;
  if (ts < window.from) return false;
  return window.to === null || ts <= window.to;
}

export function parseSort(
  value: string | null | undefined,
  allowed: readonly SortOption[],
  fallback: SortOption,
): SortOption {
  return allowed.includes(value as SortOption) ? (value as SortOption) : fallback;
}
