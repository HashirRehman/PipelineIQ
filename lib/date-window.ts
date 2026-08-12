import { DATE_RANGES, type DateRange } from "@/lib/constants";

/**
 * Exact inclusive [from, to] window for a date-range filter, computed in the
 * USER's local time (the browser passes these to the API as ISO timestamps).
 *
 * Weeks are the business week: Friday morning → Thursday night. Months and
 * years are actual calendar periods — not rolling "last 30 days".
 *
 * `to` is the end of the period (e.g. Thursday 23:59:59.999 for this week, or
 * the last day of the month) — it may be in the future relative to "now" for
 * the current period, which is fine: nothing is dated in the future.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DateWindow {
  from: string;
  /** End of the period (inclusive), ISO. */
  to: string;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The Friday (00:00 local) that starts the business week containing `d` —
 * weeks run Friday morning → Thursday night everywhere in the app (filters,
 * date labels, and the statistics weekly buckets all anchor here). */
export function businessWeekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun … 5=Fri
  const daysSinceFriday = (day + 2) % 7; // Fri→0, Sat→1, …, Thu→6
  const start = startOfDay(d);
  start.setDate(start.getDate() - daysSinceFriday);
  return start;
}

/** Most recent Friday at 00:00 local (today is Friday when it is Friday). */
function startOfThisWeek(now: Date): Date {
  return businessWeekStart(now);
}

export function getDateWindow(range: DateRange, now: Date = new Date()): DateWindow | null {
  switch (range) {
    case "all":
      return null;
    case "this_week": {
      const from = startOfThisWeek(now);
      return { from: from.toISOString(), to: new Date(from.getTime() + 7 * MS_PER_DAY - 1).toISOString() };
    }
    case "last_week": {
      const end = startOfThisWeek(now); // this week's Friday midnight
      return { from: new Date(end.getTime() - 7 * MS_PER_DAY).toISOString(), to: new Date(end.getTime() - 1).toISOString() };
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
      return { from: from.toISOString(), to: new Date(to).toISOString() };
    }
    case "this_year": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear() + 1, 0, 1).getTime() - 1;
      return { from: from.toISOString(), to: new Date(to).toISOString() };
    }
  }
}

/** Window for a specific calendar month (0–11) of a given year. */
export function getMonthWindow(month: number, year: number): DateWindow {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1).getTime() - 1;
  return { from: from.toISOString(), to: new Date(to).toISOString() };
}

/** Window for a whole calendar year. */
export function getYearWindow(year: number): DateWindow {
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1).getTime() - 1;
  return { from: from.toISOString(), to: new Date(to).toISOString() };
}

/** e.g. "August" for a month of the current year (with year when not).
 * Ranges are omitted — a calendar month's bounds are obvious. */
export function monthWindowLabel(month: number, year: number, now: Date = new Date()): string {
  const name = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long" });
  return year === now.getFullYear() ? name : `${name} ${year}`;
}

/** e.g. "2026" — a calendar year's bounds are obvious. */
export function yearWindowLabel(year: number): string {
  return String(year);
}

function formatDateWindow(window: DateWindow): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const from = fmt(window.from);
  const to = fmt(window.to);
  const fromYear = new Date(window.from).getFullYear();
  const toYear = new Date(window.to).getFullYear();
  if (fromYear !== toYear) {
    return `${from}, ${fromYear} – ${to}, ${toYear}`;
  }
  return `${from} – ${to}`;
}

/** e.g. "Aug 7 – Aug 13" for the selected range, or null for "All time". */
export function formatDateRange(range: DateRange, now: Date = new Date()): string | null {
  const window = getDateWindow(range, now);
  return window ? formatDateWindow(window) : null;
}

/** The trigger label for a date range, e.g. "This week · Aug 7 – Aug 13". */
export function dateRangeLabel(range: DateRange, now: Date = new Date()): string {
  const base = DATE_RANGES.find((r) => r.value === range)?.label ?? range;
  const rangeText = formatDateRange(range, now);
  return rangeText ? `${base} · ${rangeText}` : base;
}
