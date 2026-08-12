"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  GripVertical,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiPost } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  autoMapHeaders,
  cellToText,
  localToday,
  parseSkills,
  parseWorkbook,
  validateRow,
  validateValues,
  type FieldMapping,
  type ImportFieldKey,
  type ImportKind,
  type ParsedSheet,
  type ImportProfile,
  type ImportRowIssues,
  type ImportRowValues,
  type ImportStage,
} from "@/lib/import/job-import";

type ReviewRow = {
  index: number;
  values: ImportRowValues;
  issues: ImportRowIssues;
  included: boolean;
};

type Step = "upload" | "map" | "review" | "done";

const CLEAR = "__none__";

const KIND_OPTIONS: readonly { value: ImportKind; label: string; hint: string }[] = [
  {
    value: "applied",
    label: "Applied jobs",
    hint: "Every row imports as an Applied job. No stage, notes, or developer.",
  },
  {
    value: "lead",
    label: "Leads",
    hint: "Every row imports as a Lead. Each row needs a stage and can carry notes.",
  },
];

function ImportKindPicker({
  value,
  onChange,
}: {
  value: ImportKind;
  onChange: (kind: ImportKind) => void;
}) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {KIND_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function rowHasIssues(issues: ImportRowIssues): boolean {
  return Object.values(issues).some(Boolean);
}

/**
 * Bulk import of jobs from an Excel file, in three steps:
 *   1. Choose whether we're importing Applied jobs or Leads, and upload the
 *      workbook — columns are read and shown.
 *   2. Map columns to fields by drag-and-drop (or the dropdown on each
 *      field), exclude the columns you don't want, with live validation of
 *      every row as you map.
 *   3. Review the resolved rows — fix profiles that didn't match, stages,
 *      dates — then import. Only fully-valid, included rows submit.
 */
export function ImportJobsDialog({
  open,
  onOpenChange,
  onImported,
  profiles,
  stages,
  defaultKind = "applied",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
  /** Active profiles the caller may add jobs for (role-scoped, like New Job). */
  profiles: ImportProfile[];
  stages: ImportStage[];
  /** Kind preselected when the dialog opens — the Leads page defaults to "lead". */
  defaultKind?: ImportKind;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [importKind, setImportKind] = useState<ImportKind>("applied");
  const [fileName, setFileName] = useState<string | null>(null);
  /** Every sheet with content, keyed by name — lets the user pick a tab. */
  const [sheets, setSheets] = useState<Record<string, ParsedSheet>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState<string | null>(null);
  /** The active sheet — what the mapping and validation run against. */
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ImportFieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset whenever the dialog is (re)opened.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep("upload");
      setImportKind(defaultKind);
      setFileName(null);
      setSheets({});
      setSheetNames([]);
      setSheetName(null);
      setSheet(null);
      setMapping({});
      setExcluded(new Set());
      setReviewRows(null);
      setError(null);
      setPending(false);
      setResult(null);
    }
    prevOpen.current = open;
  }, [open, defaultKind]);

  const close = () => onOpenChange(false);

  // -------------------------------------------------------------------------
  // Upload step
  // -------------------------------------------------------------------------

  async function handleFile(file: File) {
    setError(null);
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("That doesn't look like an Excel file. Choose a .xlsx file.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer);
      if (parsed.sheetNames.length === 0) {
        setError("No sheets with columns and data were found. Check the file.");
        return;
      }
      setFileName(file.name);
      setSheets(parsed.sheets);
      setSheetNames(parsed.sheetNames);
      selectSheet(parsed.sheetNames[0], parsed.sheets, importKind);
      setStep("map");
    } catch (err) {
      console.error("import: parse failed", err);
      setError("Couldn't read that file. Make sure it's a valid Excel workbook.");
    }
  }

  /** Make a sheet the active one — re-reads headers, re-maps, resets exclusions. */
  function selectSheet(
    name: string,
    allSheets: Record<string, ParsedSheet> = sheets,
    kind: ImportKind = importKind,
  ) {
    const parsed = allSheets[name];
    if (!parsed) return;
    const rows =
      parsed.rows.length > MAX_IMPORT_ROWS
        ? parsed.rows.slice(0, MAX_IMPORT_ROWS)
        : parsed.rows;
    // Stage/Notes/Developer only exist for Leads — for an Applied import,
    // drop any headers that would auto-map onto them (their data is not
    // imported).
    const initial = autoMapHeaders(parsed.headers);
    if (kind === "applied") {
      delete initial.stage;
      delete initial.comment;
      delete initial.developer;
    }
    setSheetName(name);
    setSheet({ ...parsed, rows });
    setMapping(initial);
    setExcluded(new Set());
  }

  // -------------------------------------------------------------------------
  // Mapping helpers
  // -------------------------------------------------------------------------

  /** Assign a source column to a field (one column can only feed one field). */
  const assign = (header: string, fieldKey: ImportFieldKey | null) => {
    if (excluded.has(header)) return;
    setMapping((current) => {
      const next = { ...current };
      for (const [key, mappedHeader] of Object.entries(next)) {
        if (mappedHeader === header) delete next[key as ImportFieldKey];
      }
      if (fieldKey) next[fieldKey] = header;
      return next;
    });
  };

  const toggleExclude = (header: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(header)) {
        next.delete(header);
      } else {
        next.add(header);
        // Unmap it if it was feeding a field.
        setMapping((m) => {
          const updated = { ...m };
          for (const [key, mappedHeader] of Object.entries(updated)) {
            if (mappedHeader === header) delete updated[key as ImportFieldKey];
          }
          return updated;
        });
      }
      return next;
    });
  };

  // Live validation of every row against the current mapping — recomputed as
  // columns are dropped/removed so problems surface while mapping.
  const liveStats = useMemo(() => {
    if (!sheet) return null;
    let ready = 0;
    const issueCounts = new Map<string, number>();
    for (const record of sheet.rows) {
      const { issues } = validateRow(record, mapping, profiles, stages, importKind);
      if (rowHasIssues(issues)) {
        for (const message of Object.values(issues)) {
          if (message) issueCounts.set(message, (issueCounts.get(message) ?? 0) + 1);
        }
      } else {
        ready++;
      }
    }
    return { total: sheet.rows.length, ready, issues: [...issueCounts.entries()] };
  }, [sheet, mapping, profiles, stages, importKind]);

  function goToReview() {
    if (!sheet) return;
    const rows: ReviewRow[] = sheet.rows.map((record, index) => {
      const { issues, values } = validateRow(record, mapping, profiles, stages, importKind);
      return { index, values, issues, included: true };
    });
    setReviewRows(rows);
    setStep("review");
  }

  // -------------------------------------------------------------------------
  // Review step
  // -------------------------------------------------------------------------

  function updateReviewRow(rowIndex: number, patch: Partial<ImportRowValues>) {
    setReviewRows((current) => {
      if (!current) return current;
      return current.map((row, i) => {
        if (i !== rowIndex) return row;
        const values = { ...row.values, ...patch };
        return {
          ...row,
          values,
          issues: validateValues(values, profiles, stages, importKind),
        };
      });
    });
  }

  // Stage and Notes only exist for Lead imports — the kind is chosen once at
  // the top, so both columns are either shown for every row or for none.
  const isLead = importKind === "lead";

  // The kind picker also sits on the Map step, so the user can switch between
  // Applied and Leads after mapping started. Keep the lead-only fields (Stage
  // / Notes / Developer) in sync with the choice: switching to Leads re-maps
  // their columns (only headers not already feeding another field), switching
  // to Applied drops them — those values are never imported for applied jobs.
  const changeKind = (kind: ImportKind) => {
    setImportKind(kind);
    if (step !== "map" || !sheet) return;
    setMapping((current) => {
      const next = { ...current };
      if (kind === "lead") {
        const fresh = autoMapHeaders(sheet.headers);
        for (const key of ["stage", "comment", "developer"] as const) {
          const header = fresh[key];
          if (header && !next[key] && !Object.values(next).includes(header)) {
            next[key] = header;
          }
        }
      } else {
        delete next.stage;
        delete next.comment;
        delete next.developer;
      }
      return next;
    });
  };

  // Free-text columns of the review table (Developer and Notes are lead-only).
  const TEXT_COLUMNS: readonly (readonly [keyof ImportRowValues, string])[] = [
    ["source", "w-32"],
    ["developer", "w-32"],
    ["skills", "w-40"],
    ["location", "w-32"],
    ["comment", "w-48"],
    ["budget", "w-28"],
    ["expCompensation", "w-32"],
    ["url", "w-44"],
  ];
  const visibleTextColumns = isLead
    ? TEXT_COLUMNS
    : TEXT_COLUMNS.filter(([key]) => key !== "comment" && key !== "developer");

  const reviewSummary = useMemo(() => {
    if (!reviewRows) return null;
    let ready = 0;
    let attention = 0;
    let excludedCount = 0;
    for (const row of reviewRows) {
      if (!row.included) {
        excludedCount++;
        continue;
      }
      if (rowHasIssues(row.issues)) attention++;
      else ready++;
    }
    return { total: reviewRows.length, ready, attention, excludedCount };
  }, [reviewRows]);

  async function handleSubmit() {
    if (!reviewRows) return;
    const jobs = reviewRows
      .filter((row) => row.included && !rowHasIssues(row.issues))
      .map((row) => {
        const v = row.values;
        const skills = parseSkills(v.skills);
        return {
          title: v.title.trim(),
          company: v.company.trim(),
          location: v.location.trim() || undefined,
          url: v.url.trim() || undefined,
          date: v.date || localToday(),
          source: v.source.trim() || undefined,
          skills: skills.length > 0 ? skills : undefined,
          budget: v.budget.trim() || undefined,
          expCompensation: v.expCompensation.trim() || undefined,
          developer: isLead ? (v.developer.trim() || undefined) : undefined,
          profileId: v.profileId,
          state: importKind,
          pipelineStageId: isLead ? (v.stageId || undefined) : undefined,
          comment: v.comment.trim() || undefined,
        };
      });

    if (jobs.length === 0) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiPost<{
        success: boolean;
        imported: number;
        failed: number;
      }>("/api/jobs/import", { jobs });
      setResult({ imported: response.imported, failed: response.failed });
      setStep("done");
      onImported();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  // -------------------------------------------------------------------------
  // Renders
  // -------------------------------------------------------------------------

  const headers = sheet?.headers ?? [];
  const usedByField = (fieldKey: ImportFieldKey) => mapping[fieldKey];

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close() }}>
      <DialogContent className="sm:max-w-5xl max-h-[calc(100vh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>Import jobs</DialogTitle>
          <DialogDescription>
            Upload an Excel file, map its columns to job fields, review the
            resolved rows. Only fully-valid rows are imported.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
          {(
            [
              { key: "upload", label: "Upload" },
              { key: "map", label: "Map columns" },
              { key: "review", label: "Review" },
            ] as { key: Step; label: string }[]
          ).map((item, i) => {
            const active = step === item.key;
            const done =
              (item.key === "map" && (step === "map" || step === "review" || step === "done")) ||
              (item.key === "review" && (step === "review" || step === "done"));
            return (
              <div key={item.key} className="flex items-center gap-2">
                {i > 0 && <span className="text-border">/</span>}
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 py-0.5",
                    active && "bg-primary/10 text-primary",
                    done && !active && "text-foreground",
                  )}
                >
                  {done && !active ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : (
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full text-[10px]",
                        active ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          {/* -----------------------------------------------------------------
              STEP 1 — UPLOAD
          ----------------------------------------------------------------- */}
          {step === "upload" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">
                  What are you importing?
                </Label>
                <div className="flex flex-wrap items-center gap-3">
                  <ImportKindPicker
                    value={importKind}
                    onChange={changeKind}
                  />
                  <span className="text-xs text-muted-foreground">
                    {KIND_OPTIONS.find((option) => option.value === importKind)?.hint}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className="h-auto w-full flex-col gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-14 text-center hover:border-primary/50 hover:bg-muted/50"
              >
                <UploadCloud className="size-10 text-muted-foreground" />
                <div className="text-sm font-medium">
                  Drop your Excel file here, or click to browse
                </div>
                <div className="text-xs text-muted-foreground">
                  .xlsx or .xls · pick the tab to import on the next step · the
                  first row with content becomes the column headers
                </div>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 2 — MAP COLUMNS
          ----------------------------------------------------------------- */}
          {step === "map" && sheet && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
                {sheetNames.length > 1 ? (
                  <>
                    <span className="text-muted-foreground">· tab</span>
                    <Select
                      value={sheetName ?? undefined}
                      onValueChange={(name) => {
                        if (name) selectSheet(name);
                      }}
                    >
                      <SelectTrigger size="sm" className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">
                      · {sheet.headers.length} columns · {sheet.rows.length} rows
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    · {sheet.sheetName} · {sheet.headers.length} columns ·{" "}
                    {sheet.rows.length} rows
                  </span>
                )}
                <div className="ml-auto">
                  <ImportKindPicker
                    value={importKind}
                    onChange={changeKind}
                  />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                {/* Source columns */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
                      Source columns
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      drag onto a field
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {headers.map((header) => {
                      const isExcluded = excluded.has(header);
                      const sample = sheet.rows.find((row) => cellToText(row[header]));
                      const sampleText = sample ? cellToText(sample[header]) : "";
                      return (
                        <div
                          key={header}
                          draggable={!isExcluded}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", header);
                            e.dataTransfer.effectAllowed = "copy";
                            setDragging(header);
                          }}
                          onDragEnd={() => setDragging(null)}
                          className={cn(
                            "group flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 transition-colors",
                            isExcluded
                              ? "opacity-40"
                              : "cursor-grab hover:border-primary/40 active:cursor-grabbing",
                            dragging === header && "opacity-50",
                          )}
                        >
                          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{header}</div>
                            {sampleText && (
                              <div className="truncate text-xs text-muted-foreground">
                                e.g. {sampleText}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => toggleExclude(header)}
                            title={isExcluded ? "Include column" : "Exclude column"}
                            aria-label={isExcluded ? "Include column" : "Exclude column"}
                            className={cn(
                              "size-5 shrink-0 rounded-full text-xs",
                              isExcluded
                                ? "bg-accent text-foreground"
                                : "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                            )}
                          >
                            {isExcluded ? "＋" : "×"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Columns you exclude (×) are skipped entirely. No data from
                    them is imported.
                  </p>
                </div>

                {/* Target fields */}
                <div className="flex flex-col gap-2">
                  <Label className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
                    Job fields
                  </Label>
                  <div className="flex flex-col gap-1.5">
                    {IMPORT_FIELDS.map((field) => {
                      // Stage and Notes only exist for Lead imports — the
                      // kind is chosen once at the top of the flow.
                      if (field.leadOnly && !isLead) {
                        return null;
                      }
                      const assigned = usedByField(field.key);
                      const isTarget = dropTarget === field.key;
                      return (
                        <div
                          key={field.key}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropTarget(field.key);
                          }}
                          onDragLeave={() => setDropTarget((t) => (t === field.key ? null : t))}
                          onDrop={(e) => {
                            e.preventDefault();
                            const header = e.dataTransfer.getData("text/plain");
                            if (header) assign(header, field.key);
                            setDropTarget(null);
                          }}
                          className={cn(
                            "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 transition-colors",
                            isTarget && "border-primary ring-2 ring-primary/20",
                            assigned && "border-primary/30",
                          )}
                        >
                          <span className="w-36 shrink-0 text-sm">
                            {field.label}
                            {field.required && (
                              <span className="ml-0.5 text-destructive">*</span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            {assigned ? (
                              <span className="flex items-center gap-1.5 text-sm">
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                                  {assigned}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => assign(assigned, null)}
                                  title="Remove mapping"
                                  aria-label="Remove mapping"
                                  className="size-5 rounded text-muted-foreground hover:bg-transparent hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {isTarget ? "Release to map" : "Drop a column here"}
                              </span>
                            )}
                          </div>
                          <Select
                            value={assigned ?? ""}
                            onValueChange={(v) => {
                              if (v === CLEAR) assign(assigned ?? "", null);
                              else if (v) assign(v, field.key);
                            }}
                          >
                            <SelectTrigger size="sm" className="w-40">
                              <SelectValue placeholder="Don't import" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={CLEAR}>Don&apos;t import</SelectItem>
                              {headers
                                .filter((header) => !excluded.has(header))
                                .map((header) => (
                                  <SelectItem key={header} value={header}>
                                    {header}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    One column can feed only one field.{" "}
                    {isLead
                      ? "Every row will import as a Lead. Map a Stage column, or pick a stage per row in Review."
                      : "Every row will import as an Applied job. No stage, notes, or developer."}
                  </p>
                </div>
              </div>

              {/* Live validation summary */}
              {liveStats && (
                <div
                  aria-live="polite"
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-sm",
                    liveStats.ready === liveStats.total
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-amber-500/30 bg-amber-500/10",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {liveStats.ready === liveStats.total ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="size-4 text-amber-500" />
                    )}
                    <span className="font-medium">
                      {liveStats.ready} of {liveStats.total} rows ready
                    </span>
                    {liveStats.ready !== liveStats.total && (
                      <span className="text-muted-foreground">
                        · {liveStats.total - liveStats.ready} need attention
                      </span>
                    )}
                  </div>
                  {liveStats.issues.length > 0 && (
                    <ul className="flex flex-col gap-0.5 pl-6 text-xs text-muted-foreground">
                      {liveStats.issues.slice(0, 6).map(([message, count]) => (
                        <li key={message}>
                          {message}
                          {count > 1 && (
                            <span className="text-muted-foreground/70">
                              {" "}
                              · {count} rows
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <Button type="button" onClick={goToReview}>
                  Review rows <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 3 — REVIEW & EDIT
          ----------------------------------------------------------------- */}
          {step === "review" && reviewRows && reviewSummary && (
            <div className="flex flex-col gap-4">
              <div
                aria-live="polite"
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
                  reviewSummary.attention === 0
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-amber-500/30 bg-amber-500/10",
                )}
              >
                <span className="font-medium">
                  {reviewSummary.ready} of {reviewSummary.total} rows ready to
                  import{isLead ? " as Leads" : " as Applied jobs"}
                </span>
                {reviewSummary.attention > 0 && (
                  <span className="text-muted-foreground">
                    · {reviewSummary.attention} need attention (fix below or
                    exclude the row)
                  </span>
                )}
                {reviewSummary.excludedCount > 0 && (
                  <span className="text-muted-foreground">
                    · {reviewSummary.excludedCount} excluded
                  </span>
                )}
                <div className="ml-auto">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSubmit()}
                    disabled={
                      pending || reviewSummary.ready === 0
                    }
                  >
                    {pending
                      ? "Importing…"
                      : `Import ${reviewSummary.ready} job${reviewSummary.ready === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="sticky left-0 bg-muted/50 px-2 py-2 font-medium">
                        <span className="sr-only">Include</span>
                      </th>
                      <th className="px-2 py-2 font-medium">#</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Title *</th>
                      <th className="px-2 py-2 font-medium">Company *</th>
                      <th className="px-2 py-2 font-medium">Profile *</th>
                      {isLead && (
                        <th className="px-2 py-2 font-medium">Stage</th>
                      )}
                      <th className="px-2 py-2 font-medium">Date</th>
                      <th className="px-2 py-2 font-medium">Source</th>
                      {isLead && (
                        <th className="px-2 py-2 font-medium">Developer</th>
                      )}
                      <th className="px-2 py-2 font-medium">Skills</th>
                      <th className="px-2 py-2 font-medium">Location</th>
                      {isLead && (
                        <th className="px-2 py-2 font-medium">Notes</th>
                      )}
                      <th className="px-2 py-2 font-medium">Budget</th>
                      <th className="px-2 py-2 font-medium">Exp. Comp.</th>
                      <th className="px-2 py-2 font-medium">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((row, i) => {
                      const hasIssues = rowHasIssues(row.issues);
                      const issueText = Object.values(row.issues)
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <tr
                          key={row.index}
                          className={cn(
                            "border-t border-border align-top",
                            !row.included && "opacity-50",
                          )}
                        >
                          <td className="sticky left-0 bg-background px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={row.included}
                              onChange={(e) =>
                                setReviewRows((current) =>
                                  current
                                    ? current.map((r, j) =>
                                        j === i ? { ...r, included: e.target.checked } : r,
                                      )
                                    : current,
                                )
                              }
                              aria-label={`Include row ${row.index + 1}`}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{row.index + 1}</td>
                          <td className="px-2 py-1.5">
                            {hasIssues ? (
                              <span
                                title={issueText}
                                className="flex items-center gap-1 text-amber-500"
                              >
                                <AlertTriangle className="size-4 shrink-0" />
                              </span>
                            ) : (
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-col gap-1">
                              <Input
                                className="h-7 w-44"
                                value={row.values.title}
                                onChange={(e) =>
                                  updateReviewRow(i, { title: e.target.value })
                                }
                              />
                              {row.issues.title && (
                                <span className="text-xs text-destructive">
                                  {row.issues.title}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-col gap-1">
                              <Input
                                className="h-7 w-40"
                                value={row.values.company}
                                onChange={(e) =>
                                  updateReviewRow(i, { company: e.target.value })
                                }
                              />
                              {row.issues.company && (
                                <span className="text-xs text-destructive">
                                  {row.issues.company}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-col gap-1">
                              <Select
                                value={row.values.profileId}
                                onValueChange={(v) => {
                                  if (v) updateReviewRow(i, { profileId: v });
                                }}
                              >
                                <SelectTrigger
                                  size="sm"
                                  className={cn(
                                    "w-44",
                                    rowHasIssues(row.issues) &&
                                      !row.values.profileId &&
                                      "aria-invalid",
                                  )}
                                >
                                  <SelectValue placeholder="Pick a profile" />
                                </SelectTrigger>
                                <SelectContent>
                                  {profiles.map((profile) => (
                                    <SelectItem key={profile.id} value={profile.id}>
                                      {profile.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {row.issues.profile && (
                                <span className="text-xs text-destructive">
                                  {row.issues.profile}
                                </span>
                              )}
                            </div>
                          </td>
                          {isLead && (
                            <td className="px-2 py-1.5">
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={row.values.stageId}
                                  onValueChange={(v) => {
                                    if (v) updateReviewRow(i, { stageId: v });
                                  }}
                                >
                                  <SelectTrigger size="sm" className="w-40">
                                    <SelectValue placeholder="Not set" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {stages.map((stage) => (
                                      <SelectItem key={stage.id} value={stage.id}>
                                        {stage.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {row.issues.stage && (
                                  <span className="text-xs text-destructive">
                                    {row.issues.stage}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-2 py-1.5">
                            <div className="flex flex-col gap-1">
                              <Input
                                type="date"
                                className="h-7 w-36"
                                value={row.values.date}
                                onChange={(e) =>
                                  updateReviewRow(i, { date: e.target.value })
                                }
                              />
                              {row.issues.date && (
                                <span className="text-xs text-destructive">
                                  {row.issues.date}
                                </span>
                              )}
                            </div>
                          </td>
                          {visibleTextColumns.map(([key, width]) => (
                            <td key={key} className="px-2 py-1.5">
                              <Input
                                className={cn("h-7", width)}
                                value={row.values[key]}
                                onChange={(e) =>
                                  updateReviewRow(i, { [key]: e.target.value })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("map")}
                >
                  <ArrowLeft className="size-4" /> Back to mapping
                </Button>
                <p className="text-xs text-muted-foreground">
                  Rows with errors won&apos;t import until fixed or excluded.
                </p>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              STEP 4 — DONE
          ----------------------------------------------------------------- */}
          {step === "done" && result && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <div className="text-base font-medium">
                {result.imported} job{result.imported === 1 ? "" : "s"} imported
              </div>
              {result.failed > 0 && (
                <p className="text-sm text-muted-foreground">
                  {result.failed} row{result.failed === 1 ? "" : "s"} failed.
                  Check the pipeline and add those by hand.
                </p>
              )}
              <Button type="button" onClick={close} className="mt-2">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
