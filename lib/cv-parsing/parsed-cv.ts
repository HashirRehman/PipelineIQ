// v1 of what lands in profile_cvs.parsed_data, and the boundary that makes an
// LLM response safe to rely on.
//
// Everything is coerced rather than rejected — real CVs are sparse, and losing
// a whole parse over one bad date would be worse than losing the date.
import { z } from "zod";

/** Bump on any shape change; drives targeted re-parses. */
export const PARSED_CV_SCHEMA_VERSION = 1;

const NULLISH_TEXT = new Set(["", "n/a", "na", "none", "null", "unknown", "not specified", "-"]);

// Don't drop the .optional(): in zod 4 a transform on a required schema
// rejects a missing key before the transform runs, so every absent field
// would throw instead of coercing to null.
function coerce<T>(fn: (value: unknown) => T) {
  return z.unknown().optional().transform(fn);
}

function toObject(value: unknown): object {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

// "" / "N/A" / "unknown" all mean absent
function toNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return NULLISH_TEXT.has(trimmed.toLowerCase()) ? null : trimmed;
}

const nullableText = coerce(toNullableText);

function toNullableNumber(value: unknown): number | null {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^0-9.]/g, ""))
        : Number.NaN;
  return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

const nullableNumber = coerce(toNullableNumber);

const boolish = coerce((value) => value === true || value === "true");

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/**
 * To "YYYY-MM", or "YYYY" when that's all the CV gives — never padded to
 * "YYYY-01", which would state a month the document didn't. "Present" and
 * anything unparseable become null.
 */
function toMonthString(value: unknown): string | null {
  if (typeof value === "number" && value >= 1900 && value <= 2100) return String(value);
  if (typeof value !== "string") return null;

  const raw = value.trim().toLowerCase();
  if (raw.length === 0 || /^(present|current|now|ongoing|to date|till date)$/.test(raw)) return null;

  // 2021-03, 2021/03, 2021-03-15 (day dropped — the format is month-granular)
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) return `${iso[1]}-${String(month).padStart(2, "0")}`;
    return iso[1];
  }

  // "March 2021", "Mar 2021", "mar. 2021"
  const named = raw.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (named) {
    const month = MONTH_NAMES[named[1]];
    if (month) return `${named[2]}-${String(month).padStart(2, "0")}`;
    return named[2];
  }

  // "03/2021" or "3-2021"
  const monthFirst = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthFirst) {
    const month = Number(monthFirst[1]);
    if (month >= 1 && month <= 12) return `${monthFirst[2]}-${String(month).padStart(2, "0")}`;
    return monthFirst[2];
  }

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return yearOnly[1];

  return null;
}

const monthString = coerce(toMonthString);

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !NULLISH_TEXT.has(item.toLowerCase()));
}

/** Dedupes case-insensitively but stores the spelling as written. */
function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of skills) {
    const key = skill.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

const skillArray = coerce((value) => dedupeSkills(toStringArray(value)));

function objectArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "object" && item !== null);
}

const experienceEntrySchema = z
  .object({
    company: nullableText,
    title: nullableText,
    location: nullableText,
    start_date: monthString,
    end_date: monthString,
    is_current: boolish,
    highlights: coerce(toStringArray),
    skills: skillArray,
  })
  // no end date means "still there", whatever is_current says
  .transform((entry) => ({
    ...entry,
    is_current: entry.is_current || entry.end_date === null,
  }));

const educationEntrySchema = z.object({
  institution: nullableText,
  degree: nullableText,
  field_of_study: nullableText,
  start_date: monthString,
  end_date: monthString,
});

const certificationEntrySchema = z.object({
  name: nullableText,
  issuer: nullableText,
  issued_date: monthString,
  expires_date: monthString,
});

const languageEntrySchema = z.object({
  name: nullableText,
  proficiency: nullableText,
});

const projectEntrySchema = z.object({
  name: nullableText,
  description: nullableText,
  url: nullableText,
  skills: skillArray,
});

const skillGroupSchema = z.object({
  category: nullableText,
  skills: skillArray,
});

// Drops empty shells. Booleans don't count as content — is_current is derived
// above, so an otherwise-empty entry would survive on it.
function dropEmpty<T extends object>(entries: T[]): T[] {
  return entries.filter((entry) =>
    Object.values(entry).some((value) =>
      Array.isArray(value) ? value.length > 0 : typeof value !== "boolean" && value !== null,
    ),
  );
}

function listOf<T extends z.ZodType<object>>(entry: T) {
  return coerce(objectArray).transform((items) =>
    dropEmpty(items.map((item) => entry.parse(item) as z.output<T>)),
  );
}

export const parsedCvSchema = z.object({
  // always ours, never the model's
  schema_version: coerce(() => PARSED_CV_SCHEMA_VERSION),

  candidate: coerce(toObject).pipe(
    z.object({
      full_name: nullableText,
      email: nullableText,
      phone: nullableText,
      location: nullableText,
      links: coerce(toObject).pipe(
        z.object({
          linkedin: nullableText,
          github: nullableText,
          portfolio: nullableText,
        }),
      ),
    }),
  ),

  headline: nullableText,
  summary: nullableText,

  // Hints only — the profiles columns a human filled in stay canonical.
  total_years_experience: nullableNumber,
  seniority_hint: nullableText,

  skills: skillArray,
  skill_groups: listOf(skillGroupSchema),

  titles: coerce(toStringArray),
  industries: coerce(toStringArray),

  experience: listOf(experienceEntrySchema),
  education: listOf(educationEntrySchema),
  certifications: listOf(certificationEntrySchema),
  languages: listOf(languageEntrySchema),
  projects: listOf(projectEntrySchema),
});

export type ParsedCv = z.output<typeof parsedCvSchema>;

/** No skills and no experience means the model returned an empty shell. */
export function isUsableParse(parsed: ParsedCv): boolean {
  return parsed.skills.length > 0 || parsed.experience.length > 0;
}
