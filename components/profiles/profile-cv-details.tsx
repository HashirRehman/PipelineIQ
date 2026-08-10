"use client";

// The expanded body of a CV row: what the parse found, or why there's nothing
// to show yet.
//
// Four display states, derived in cvParseState() below. Three come straight
// from parse_status; the fourth ("parsing") is inferred, because the database
// deliberately has no separate in-flight status — see the note on that
// function.
import { AlertTriangle, FileSearch, Loader2, RefreshCw } from "lucide-react";
import type { ProfileCvEntry } from "@/app/api/profiles/[profileId]/route";
import type { ParsedCv } from "@/lib/cv-parsing/parsed-cv";

export type CvParseState = "parsed" | "parsing" | "unparsed" | "failed";

// How long after upload a still-'pending' CV is presented as actively parsing.
// The upload path schedules its parse in after(), which fires as soon as the
// response is sent, so a pending row this young is genuinely mid-parse. Past
// this window it's fair to call it unparsed and offer the button.
const PARSING_WINDOW_MS = 2 * 60 * 1000;

/**
 * Maps a CV to what the user should be told.
 *
 * `parse_status` has three values ('pending' | 'success' | 'failed') and no
 * 'parsing' — nothing sets a status at the moment work begins, so "queued" and
 * "in flight" are the same row state. Rather than add a column for it, a young
 * pending row is treated as parsing (its parse was scheduled moments ago) and
 * an old one as unparsed. `isParsing` overrides both: when this client kicked
 * off a parse, it knows for certain one is running.
 */
export function cvParseState(cv: ProfileCvEntry, isParsing = false): CvParseState {
  if (isParsing) return "parsing";
  if (cv.parseStatus === "success") return "parsed";
  if (cv.parseStatus === "failed") return "failed";
  return Date.now() - new Date(cv.createdAt).getTime() < PARSING_WINDOW_MS
    ? "parsing"
    : "unparsed";
}

function formatMonth(value: string | null): string {
  if (!value) return "";
  // Values are "YYYY-MM" or "YYYY" (see parsed-cv.ts) — a year-only date has
  // no month to name, so it prints as the bare year rather than guessing one.
  const [year, month] = value.split("-");
  if (!month) return year;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function dateRange(start: string | null, end: string | null, isCurrent: boolean): string {
  const from = formatMonth(start);
  const to = isCurrent ? "Present" : formatMonth(end);
  if (!from && !to) return "";
  if (!from) return to;
  if (!to) return from;
  return `${from} – ${to}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-xs text-foreground">{children}</div>
    </div>
  );
}

function SkillChips({ skills }: { skills: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className="rounded border border-border bg-accent/50 px-1.5 py-0.5 text-caption text-foreground"
        >
          {skill}
        </span>
      ))}
    </div>
  );
}

function ParsedCvBody({ parsed }: { parsed: ParsedCv }) {
  const { candidate } = parsed;
  const links = Object.entries(candidate.links).filter(([, url]) => url !== null) as [
    string,
    string,
  ][];

  return (
    <div className="flex flex-col gap-4">
      {(candidate.full_name || candidate.email || candidate.phone || candidate.location) && (
        <Field label="Contact">
          <div className="flex flex-col gap-0.5 text-muted-foreground">
            {candidate.full_name && <span className="text-foreground">{candidate.full_name}</span>}
            {candidate.email && <span>{candidate.email}</span>}
            {candidate.phone && <span>{candidate.phone}</span>}
            {candidate.location && <span>{candidate.location}</span>}
          </div>
        </Field>
      )}

      {links.length > 0 && (
        <Field label="Links">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {links.map(([label, url]) => (
              <a
                key={label}
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {label}
              </a>
            ))}
          </div>
        </Field>
      )}

      {(parsed.headline || parsed.summary) && (
        <Field label="Summary">
          <p className="leading-relaxed text-muted-foreground">
            {parsed.headline && (
              <span className="block font-medium text-foreground">{parsed.headline}</span>
            )}
            {parsed.summary}
          </p>
        </Field>
      )}

      {(parsed.total_years_experience !== null || parsed.seniority_hint) && (
        <Field label="From the CV">
          <span className="text-muted-foreground">
            {[
              parsed.total_years_experience !== null
                ? `${parsed.total_years_experience} years experience`
                : null,
              parsed.seniority_hint,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </Field>
      )}

      {parsed.skills.length > 0 && (
        <Field label={`Skills (${parsed.skills.length})`}>
          <SkillChips skills={parsed.skills} />
        </Field>
      )}

      {parsed.experience.length > 0 && (
        <Field label="Experience">
          <ul className="flex flex-col gap-2.5">
            {parsed.experience.map((role, index) => (
              <li key={`${role.company ?? "role"}-${index}`}>
                <p className="font-medium text-foreground">
                  {[role.title, role.company].filter(Boolean).join(" · ") || "Untitled role"}
                </p>
                <p className="text-caption text-muted-foreground">
                  {[dateRange(role.start_date, role.end_date, role.is_current), role.location]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {role.highlights.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {role.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {parsed.education.length > 0 && (
        <Field label="Education">
          <ul className="flex flex-col gap-1.5">
            {parsed.education.map((entry, index) => (
              <li key={`${entry.institution ?? "school"}-${index}`}>
                <span className="text-foreground">
                  {[entry.degree, entry.field_of_study].filter(Boolean).join(", ") ||
                    "Qualification"}
                </span>
                <span className="text-muted-foreground">
                  {entry.institution ? ` — ${entry.institution}` : ""}
                  {dateRange(entry.start_date, entry.end_date, false)
                    ? ` (${dateRange(entry.start_date, entry.end_date, false)})`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Field>
      )}

      {parsed.certifications.length > 0 && (
        <Field label="Certifications">
          <ul className="flex flex-col gap-1">
            {parsed.certifications.map((cert, index) => (
              <li key={`${cert.name ?? "cert"}-${index}`} className="text-muted-foreground">
                <span className="text-foreground">{cert.name}</span>
                {cert.issuer ? ` — ${cert.issuer}` : ""}
                {cert.issued_date ? ` (${formatMonth(cert.issued_date)})` : ""}
              </li>
            ))}
          </ul>
        </Field>
      )}

      {parsed.languages.length > 0 && (
        <Field label="Languages">
          <span className="text-muted-foreground">
            {parsed.languages
              .map((lang) => [lang.name, lang.proficiency].filter(Boolean).join(" — "))
              .join(" · ")}
          </span>
        </Field>
      )}

      {parsed.projects.length > 0 && (
        <Field label="Projects">
          <ul className="flex flex-col gap-1.5">
            {parsed.projects.map((project, index) => (
              <li key={`${project.name ?? "project"}-${index}`}>
                <span className="text-foreground">{project.name}</span>
                {project.description && (
                  <span className="text-muted-foreground"> — {project.description}</span>
                )}
              </li>
            ))}
          </ul>
        </Field>
      )}
    </div>
  );
}

function ParseActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // self-start so the flex-col parent doesn't stretch it to full width.
      className="inline-flex w-fit cursor-pointer items-center gap-1.5 self-start rounded border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      <RefreshCw className="size-3" />
      {label}
    </button>
  );
}

export function ProfileCvDetails({
  cv,
  state,
  canManage,
  actionError,
  onParse,
}: {
  cv: ProfileCvEntry;
  state: CvParseState;
  canManage: boolean;
  actionError: string | null;
  onParse: () => void;
}) {
  return (
    <div className="border-t border-border bg-page-bg px-3 py-3">
      {state === "parsing" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          Reading this CV — details will appear here in a moment.
        </div>
      )}

      {state === "unparsed" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileSearch className="size-3.5" />
            This CV hasn&apos;t been read yet, so there are no details to show.
          </div>
          {canManage && <ParseActionButton label="Read this CV" onClick={onParse} disabled={false} />}
        </div>
      )}

      {state === "failed" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>
              This CV couldn&apos;t be read.
              {cv.parseError ? <span className="text-muted-foreground"> {cv.parseError}</span> : null}
            </span>
          </div>
          {canManage && <ParseActionButton label="Try again" onClick={onParse} disabled={false} />}
          {/* A failed re-parse keeps the previous good parse, so show it rather
              than pretending there's nothing — the error above says it's stale. */}
          {cv.parsed && (
            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-2 text-caption text-muted-foreground">
                Showing the last successful read of this CV.
              </p>
              <ParsedCvBody parsed={cv.parsed} />
            </div>
          )}
        </div>
      )}

      {state === "parsed" && cv.parsed && (
        <div className="flex flex-col gap-3">
          <ParsedCvBody parsed={cv.parsed} />
          {canManage && (
            <div className="border-t border-border pt-3">
              <ParseActionButton label="Read again" onClick={onParse} disabled={false} />
            </div>
          )}
        </div>
      )}

      {/* A 'success' row always carries parsed_data (the DB CHECK enforces it),
          so this only fires if that invariant were ever broken. */}
      {state === "parsed" && !cv.parsed && (
        <p className="text-xs text-muted-foreground">
          This CV is marked as read but no details were stored.
        </p>
      )}

      {/* Once a parse attempt finishes, its reason is already on the row and
          rendered by the failed state above — repeating it here showed the same
          sentence twice. This only speaks up when the request itself never got
          far enough to record anything (a network error, say). */}
      {actionError && actionError !== cv.parseError && (
        <p className="mt-2 text-xs text-destructive">{actionError}</p>
      )}
    </div>
  );
}
