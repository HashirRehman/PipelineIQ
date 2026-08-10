// The parsed-CV contract — v1 of what lands in profile_cvs.parsed_data.
//
// This schema is the boundary between "what an LLM felt like returning" and
// "what the rest of the app can rely on". The model is prompted for this
// shape, but nothing about an LLM guarantees it, so every field is coerced
// here and the whole parse is rejected if the result still isn't usable.
//
// Design rule: top-level keys are the public contract. `parsed.skills` is a
// flat string array you can read directly, without walking `experience` and
// flattening. Richer structure hangs below it.
//
// Leniency is deliberate and one-directional: a MISSING field is normal (real
// CVs are sparse, so absent → null / []), but a field of the wrong SHAPE is
// still coerced rather than fatal, because losing an entire CV's parse over
// one malformed date would be a worse outcome than losing that date. What is
// NOT lenient: the top-level object must be an object, and `skills` must
// survive as an array — a parse with neither is not worth storing.
//
// Lives here rather than in lib/validation/schemas.ts (which validates HTTP
// request input) because this validates an AI response and is the storage
// format's definition — it belongs with the module that owns CV parsing.
import { z } from "zod";

/** Bump when the shape below changes; drives targeted re-parses. */
export const PARSED_CV_SCHEMA_VERSION = 1;

const NULLISH_TEXT = new Set(["", "n/a", "na", "none", "null", "unknown", "not specified", "-"]);

/**
 * Wraps a coercion function as a schema for one field.
 *
 * The `.optional()` is load-bearing, not decoration: in zod 4 a transform on a
 * required schema rejects a missing key *before* the transform can run, so
 * every absent field would throw instead of coercing to null — which for
 * sparse real-world CVs would fail nearly every parse. Verified against zod
 * 4.4: without it, `{ company: "X" }` throws on the six sibling keys it
 * didn't set. These functions never return undefined, so the output stays
 * fully defined despite the optional input.
 */
function coerce<T>(fn: (value: unknown) => T) {
  return z.unknown().optional().transform(fn);
}

/** Absent or non-object → {}, so nested shapes coerce instead of throwing. */
function toObject(value: unknown): object {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

/** "" / "N/A" / "unknown" from the model all mean "absent", not a value. */
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
 * Normalizes a CV date to `"YYYY-MM"`, or `"YYYY"` when only a year is known.
 *
 * Year-only is a first-class value rather than being padded to `"YYYY-01"`:
 * CVs routinely give just a year, and inventing January would be a fact the
 * document never stated. "Present"/"Current"/"Ongoing" and anything
 * unparseable both become null — for an end_date that correctly reads as
 * "still there", which `is_current` then carries explicitly.
 */
function toMonthString(value: unknown): string | null {
  if (typeof value === "number" && value >= 1900 && value <= 2100) return String(value);
  if (typeof value !== "string") return null;

  const raw = value.trim().toLowerCase();
  if (raw.length === 0 || /^(present|current|now|ongoing|to date|till date)$/.test(raw)) return null;

  // Already ISO-ish: 2021-03, 2021/03, or 2021-03-15 (day dropped — the
  // format is month-granular, and a CV's day is noise even when present).
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

/** Keeps strings, drops everything else, trims, drops blanks. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !NULLISH_TEXT.has(item.toLowerCase()));
}

/**
 * Dedupes case-insensitively while keeping the first spelling seen.
 *
 * Stored as written ("Node.js", not "nodejs") — matching-time normalization
 * already exists in groq-client's normalizeForMatch(), and baking a lossy
 * form into storage would make `skills` worse for display and for the UI.
 */
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

/** Tolerates a non-array (or absent) list of objects without failing the parse. */
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
  // A reverse-chronological CV signals "still here" by leaving the end date
  // off, which the model often reflects without also setting is_current. The
  // two shouldn't disagree, so an absent end date settles it.
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

/**
 * Drops entries the model emitted as empty shells (every field null/empty).
 *
 * Booleans never count as evidence of content: `is_current` is *derived* from
 * a missing end date, so an otherwise-empty experience entry would arrive
 * here carrying `is_current: true` and survive on the strength of a flag
 * nothing in the CV actually stated.
 */
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
  // Always this app's constant, never the model's — the model has no idea
  // which version of our format it was prompted for.
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

  // Hints, not authority: profiles.years_of_experience and
  // profiles.seniority_level_id stay canonical because a human set them.
  // These exist to flag a discrepancy and to give an un-filled profile
  // something to score against.
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

/**
 * The one hard requirement: a parse that found no skills AND no experience
 * extracted nothing worth storing. Everything else can legitimately be empty
 * on a real CV, but this combination means the model returned a well-formed
 * shell — treat it as a failure rather than persisting an empty success.
 */
export function isUsableParse(parsed: ParsedCv): boolean {
  return parsed.skills.length > 0 || parsed.experience.length > 0;
}
