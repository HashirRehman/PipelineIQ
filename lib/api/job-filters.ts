import type { DateRange, SortOption } from "@/lib/constants";

// Shared server-side parsing for the date-range / sort filters used by both
// the leads and discovery APIs. The UI components live in
// components/jobs/date-range-filter.tsx and sort-filter.tsx; keep the option
// lists in lib/constants.ts (DATE_RANGES / SORT_OPTIONS) so UI and API never
// drift.

const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RANGE_DAYS: Record<DateRange, number | null> = {
  all: null,
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

const DATE_RANGE_VALUES = new Set<string>(["all", "day", "week", "month", "year"]);

export function parseDateRange(value: string | null | undefined): DateRange {
  return DATE_RANGE_VALUES.has(value ?? "") ? (value as DateRange) : "all";
}

/** ISO timestamp to filter "since" (inclusive), or null for "All time". */
export function dateRangeCutoff(range: DateRange, now = Date.now()): string | null {
  const days = DATE_RANGE_DAYS[range];
  if (days === null) return null;
  return new Date(now - days * DAY_MS).toISOString();
}

export function parseSort(
  value: string | null | undefined,
  allowed: readonly SortOption[],
  fallback: SortOption,
): SortOption {
  return allowed.includes(value as SortOption) ? (value as SortOption) : fallback;
}
