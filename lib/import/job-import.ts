import * as XLSX from "xlsx";

/**
 * Client-side engine for the bulk job import (Pipeline → Import). All of this
 * runs in the browser against the file the user picked; the server re-checks
 * everything at submit time. Split from the dialog so the matching and
 * validation rules can be unit-tested on their own.
 */

// ---------------------------------------------------------------------------
// Target fields — the columns a spreadsheet column can be mapped to.
// ---------------------------------------------------------------------------

/** Applied jobs or Leads — decided once at the top of the flow. */
export type ImportKind = "applied" | "lead";

export type ImportFieldKey =
  | "title"
  | "company"
  | "location"
  | "skills"
  | "profile"
  | "source"
  | "developer"
  | "stage"
  | "comment"
  | "date"
  | "budget"
  | "expCompensation"
  | "url";

export type ImportFieldDef = {
  key: ImportFieldKey;
  label: string;
  /** Must be non-empty on every imported row. */
  required: boolean;
  /** Only shown when the import is for Leads (chosen at the top). */
  leadOnly?: boolean;
};

export const IMPORT_FIELDS: readonly ImportFieldDef[] = [
  { key: "title", label: "Title", required: true },
  { key: "company", label: "Company", required: true },
  { key: "location", label: "Location", required: false },
  { key: "skills", label: "Skills", required: false },
  { key: "profile", label: "Profile", required: true },
  { key: "source", label: "Source", required: false },
  { key: "developer", label: "Developer", required: false, leadOnly: true },
  { key: "stage", label: "Stage", required: false, leadOnly: true },
  { key: "comment", label: "Notes", required: false, leadOnly: true },
  { key: "date", label: "Date applied", required: false },
  { key: "budget", label: "Budget", required: false },
  { key: "expCompensation", label: "Exp. Compensation", required: false },
  { key: "url", label: "URL", required: false },
];

export type FieldMapping = Partial<Record<ImportFieldKey, string>>;

// ---------------------------------------------------------------------------
// Sheet parsing
// ---------------------------------------------------------------------------

export type ParsedSheet = {
  sheetName: string;
  /** Unique header labels, in order (duplicates get " (2)" etc.). */
  headers: string[];
  /** One record per data row, keyed by header label. Values are raw cells. */
  rows: Record<string, unknown>[];
};

export const MAX_IMPORT_ROWS = 500;

/**
 * Every sheet of a workbook that has content (a header row + at least one
 * data row), keyed by sheet name, in workbook order. Tabs that are blank or
 * contain only headers are skipped — nothing to import from them.
 */
export type ParsedWorkbook = {
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
};

export function parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetNames: string[] = [];
  const sheets: Record<string, ParsedSheet> = {};
  for (const name of workbook.SheetNames) {
    const parsed = parseSheet(workbook, name);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) continue;
    sheets[name] = parsed;
    sheetNames.push(name);
  }
  return { sheetNames, sheets };
}

function parseSheet(workbook: XLSX.WorkBook, sheetName: string): ParsedSheet {
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  // First row that has any content is the header row.
  let headerIndex = -1;
  for (let i = 0; i < matrix.length; i++) {
    if ((matrix[i] ?? []).some((cell) => cell !== null && cell !== "")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) {
    return { sheetName, headers: [], rows: [] };
  }

  // Unique header labels (duplicate names get suffixed so each column chip
  // and every row record key stays unambiguous).
  const used = new Map<string, number>();
  const headers = (matrix[headerIndex] ?? []).map((cell) => {
    const base = cellToText(cell) || `Column ${(used.size + 1)}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const rawRow = matrix[i] ?? [];
    if (rawRow.every((cell) => cell === null || cell === "")) continue; // skip blank rows
    const record: Record<string, unknown> = {};
    headers.forEach((header, col) => {
      record[header] = rawRow[col] ?? null;
    });
    rows.push(record);
  }

  return { sheetName, headers, rows };
}

/** Excel cells → display text. "-" / "--" are the file's "no value" markers. */
export function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  const text = String(value).trim();
  if (text === "" || text === "-" || text === "--" || text === "—") return "";
  return text;
}

// ---------------------------------------------------------------------------
// Header auto-mapping
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  title: ["title", "job title", "position", "role", "job"],
  company: ["company", "company name", "employer", "client"],
  location: ["location", "city", "work location"],
  skills: ["skills", "stack", "stacks", "tech stack", "technologies", "tech"],
  profile: ["profile", "candidate", "candidate profile", "person", "resource"],
  source: ["source", "job source", "platform"],
  developer: ["developer", "dev", "assigned to", "assigned", "owner", "recruiter", "bd"],
  stage: ["stage", "pipeline stage", "lead stage", "round", "interview stage"],
  comment: ["comment", "comments", "notes", "remarks", "lead notes"],
  date: ["date", "applied", "applied on", "applied date", "date applied", "posted", "posted date"],
  budget: ["budget", "monthly budget"],
  expCompensation: [
    "exp. compensation", "exp compensation", "compensation", "exp comp",
    "expcomp", "comp", "expected compensation", "salary", "salary range", "rate",
  ],
  url: ["url", "link", "job url", "apply url", "job link", "posting url", "apply link"],
};

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function autoMapHeaders(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const taken = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const aliases = HEADER_ALIASES[field.key].map(normalizeHeader);
    const hit = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return !taken.has(header) && aliases.includes(normalized);
    });
    if (hit) {
      mapping[field.key] = hit;
      taken.add(hit);
    }
  }
  return mapping;
}

// ---------------------------------------------------------------------------
// Profile matching
// ---------------------------------------------------------------------------

export type ImportProfile = {
  id: string;
  name: string;
  location?: string | null;
};

export type ProfileMatch = {
  profile: ImportProfile;
  confidence: "exact" | "strong" | "weak";
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isSubsequence(needle: string[], haystack: string[]): boolean {
  let i = 0;
  for (const token of haystack) {
    if (i < needle.length && token === needle[i]) i++;
  }
  return i === needle.length;
}

/**
 * Best-effort match of a spreadsheet cell ("Abubakr Shahid", "Abubakr Shahid
 * - USA") against the org's profiles. Returns null when nothing plausible
 * matches — the dialog then flags the row and the user picks a profile by
 * hand (or drops the row). Single-token cells are deliberately NOT
 * auto-matched (too ambiguous: "Ali" could be any of several profiles).
 */
export function matchProfileName(
  value: string,
  profiles: readonly ImportProfile[],
): ProfileMatch | null {
  const cell = normalizeText(value);
  if (!cell) return null;

  for (const profile of profiles) {
    if (normalizeText(profile.name) === cell) {
      return { profile, confidence: "exact" };
    }
  }

  // "Name - Location" cells: match the part before the first " - " against
  // the profile name, or the whole cell against "name - location".
  const base = cell.split(/\s+-\s+/)[0].trim();
  if (base && base !== cell) {
    for (const profile of profiles) {
      if (normalizeText(profile.name) === base) {
        return { profile, confidence: "strong" };
      }
    }
    for (const profile of profiles) {
      if (
        profile.location &&
        normalizeText(`${profile.name} - ${profile.location}`) === cell
      ) {
        return { profile, confidence: "strong" };
      }
    }
  }

  // All profile-name tokens appear in the cell, in order (2+ tokens).
  let best: ProfileMatch | null = null;
  const cellTokens = cell.split(" ").filter(Boolean);
  for (const profile of profiles) {
    const nameTokens = normalizeText(profile.name).split(" ").filter(Boolean);
    if (nameTokens.length >= 2 && isSubsequence(nameTokens, cellTokens)) {
      if (!best || nameTokens.length > best.profile.name.split(" ").length) {
        best = { profile, confidence: "strong" };
      }
    }
  }
  if (best) return best;

  // Cell tokens appear inside the profile name (2+ cell tokens, unambiguous).
  if (cellTokens.length >= 2) {
    for (const profile of profiles) {
      const nameTokens = normalizeText(profile.name).split(" ").filter(Boolean);
      if (isSubsequence(cellTokens, nameTokens)) {
        if (!best || nameTokens.length > best.profile.name.split(" ").length) {
          best = { profile, confidence: "weak" };
        }
      }
    }
    if (best) return best;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Stage / state matching
// ---------------------------------------------------------------------------

export type ImportStage = { id: string; name: string };

export function matchStage(
  value: string,
  stages: readonly ImportStage[],
): ImportStage | null {
  const cell = normalizeText(value);
  if (!cell) return null;
  const exact = stages.find((stage) => normalizeText(stage.name) === cell);
  if (exact) return exact;
  const folded = stages.find((stage) =>
    normalizeText(stage.name).replace(/[^a-z0-9]+/g, "") ===
    cell.replace(/[^a-z0-9]+/g, ""),
  );
  return folded ?? null;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function formatLocalYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function localToday(): string {
  return formatLocalYmd(new Date());
}

/** Cell value → "YYYY-MM-DD", or null when it can't be read as a date. */
export function parseCellDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalYmd(value);
  }
  const text = cellToText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (parts) {
    const year = Number(parts[3]);
    const first = Number(parts[1]);
    const second = Number(parts[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const fullYear = year < 100 ? 2000 + year : year;
    const date = new Date(fullYear, month - 1, day);
    if (!Number.isNaN(date.getTime())) return formatLocalYmd(date);
    return null;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return formatLocalYmd(parsed);
  return null;
}

/** Split a skills cell into a clean list ("-", "" → []). */
export function parseSkills(value: unknown): string[] {
  return cellToText(value)
    .split(/[,\n]+/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Per-row validation
// ---------------------------------------------------------------------------

export type ImportRowIssues = {
  title?: string;
  company?: string;
  profile?: string;
  stage?: string;
  date?: string;
};

/** Resolved, validated values for one imported row (as shown in Review). */
export type ImportRowValues = {
  title: string;
  company: string;
  location: string;
  skills: string;
  profileCell: string;
  profileId: string;
  source: string;
  developer: string;
  state: string;
  stageId: string;
  comment: string;
  date: string;
  budget: string;
  expCompensation: string;
  url: string;
};

export function validateRow(
  record: Record<string, unknown>,
  mapping: FieldMapping,
  profiles: readonly ImportProfile[],
  stages: readonly ImportStage[],
  kind: ImportKind,
): { issues: ImportRowIssues; values: ImportRowValues } {
  const issues: ImportRowIssues = {};

  const cellOf = (key: ImportFieldKey) => {
    const header = mapping[key];
    return header ? cellToText(record[header] ?? null) : "";
  };
  const rawCellOf = (key: ImportFieldKey) => {
    const header = mapping[key];
    return header ? (record[header] ?? null) : null;
  };

  const values: ImportRowValues = {
    title: cellOf("title"),
    company: cellOf("company"),
    location: cellOf("location"),
    skills: cellOf("skills"),
    profileCell: cellOf("profile"),
    profileId: "",
    source: cellOf("source"),
    developer: cellOf("developer"),
    state: "",
    stageId: "",
    comment: cellOf("comment"),
    date: "",
    budget: cellOf("budget"),
    expCompensation: cellOf("expCompensation"),
    url: cellOf("url"),
  };

  if (!values.title) issues.title = "Title is required.";
  if (!values.company) issues.company = "Company is required.";

  // Profile — the column must resolve to a real profile.
  if (!values.profileCell) {
    issues.profile = "Map a Profile column.";
  } else {
    const match = matchProfileName(values.profileCell, profiles);
    if (!match) {
      issues.profile = `No profile matches "${values.profileCell}". Pick one manually.`;
    } else {
      values.profileId = match.profile.id;
    }
  }

  // State is never imported from the spreadsheet — every row is the kind
  // chosen at the top of the flow. Leads must resolve a stage per row.
  values.state = kind;
  if (kind === "lead") {
    const stageCell = cellOf("stage");
    if (!stageCell) {
      issues.stage = "Lead has no stage in this row. Pick one.";
    } else {
      const stageMatch = matchStage(stageCell, stages);
      if (!stageMatch) {
        issues.stage = `Stage "${stageCell}" isn't a known stage. Pick one.`;
      } else {
        values.stageId = stageMatch.id;
      }
    }
  }

  // Date — optional; blanks default to today at submit time.
  const dateValue = parseCellDate(rawCellOf("date"));
  if (dateValue === null && cellToText(rawCellOf("date"))) {
    issues.date = `"${cellToText(rawCellOf("date"))}" isn't a valid date.`;
  }
  values.date = dateValue ?? localToday();

  return { issues, values };
}

/**
 * Re-validates an already-resolved row — used by the Review step after the
 * user edits a cell (profile select, stage select, state, dates, text).
 * Reuses exactly the same rules as the column-mapping pass.
 */
export function validateValues(
  values: ImportRowValues,
  profiles: readonly ImportProfile[],
  stages: readonly ImportStage[],
  kind: ImportKind,
): ImportRowIssues {
  const issues: ImportRowIssues = {};

  if (!values.title.trim()) issues.title = "Title is required.";
  if (!values.company.trim()) issues.company = "Company is required.";

  if (!values.profileId) {
    issues.profile = "Pick a profile for this row.";
  } else if (!profiles.some((profile) => profile.id === values.profileId)) {
    issues.profile = "Pick a profile for this row.";
  }

  if (kind === "lead") {
    if (!values.stageId) {
      issues.stage = "Pick a stage for the lead.";
    } else if (!stages.some((stage) => stage.id === values.stageId)) {
      issues.stage = "Pick a stage for the lead.";
    }
  }

  if (values.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    issues.date = "Date must be YYYY-MM-DD.";
  }

  return issues;
}
