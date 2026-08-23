import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import type { Json } from "@/lib/supabase/database.types";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import {
  JOB_EDITABLE_FIELDS,
  JOB_FIELD_COLUMNS,
  JOB_PARSED_DATA_FIELDS,
  JOB_PARSED_DATA_KEYS,
  updateJobSchema,
  type JobEditableField,
  type JobParsedDataField,
} from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

// Edit a job's own fields. Every edited column is also appended to
// jobs.manual_overrides, which is how the change survives: the nightly
// discovery cron rewrites title/company/description/etc. on every run and
// skips whatever this array names (migration 20260812130222). Nothing merges
// at read time — the column itself stays authoritative, so relevance scoring
// and the UI both see the corrected text.
//
// Editing is Admin + BD Manager (originally a jobs_update RLS policy, now
// enforced by the canEditJobs check below — RLS is disabled, so this check
// is the real boundary, not a UI-friendliness layer on top of one).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = await getCachedRolePermissions();
  if (!perms.canEditJobs) {
    return NextResponse.json(
      { error: "Only an admin or a manager can edit a job." },
      { status: 403 },
    );
  }

  const { jobId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // The org filter rejects a cross-org job id up front rather than letting
  // it fall through to a confusing zero-row update below.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, company_name, manual_overrides, parsed_data")
    .eq("id", jobId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const updates: Record<string, string | boolean | null> = {};
  const editedColumns: string[] = [];

  for (const field of JOB_EDITABLE_FIELDS) {
    const value = parsed.data[field as JobEditableField];
    if (value === undefined) continue;
    const column = JOB_FIELD_COLUMNS[field];

    if (field === "jobPostedAt") {
      // A date input gives "YYYY-MM-DD"; the column is timestamptz.
      updates[column] = value === null ? null : new Date(`${value}T00:00:00`).toISOString();
    } else if (field === "applyUrl" && typeof value === "string" && value !== "") {
      // Same normalization as job creation: a bare domain is accepted and
      // gets a scheme, so the stored URL is always followable.
      updates[column] = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    } else {
      updates[column] = value === "" ? null : value;
    }

    editedColumns.push(column);
  }

  // Parsed-data extras are merged into the existing jsonb object — never
  // replaced wholesale, so a skills edit can't drop the developer value.
  // An empty list means "cleared", same as "" on a text field.
  const parsedDataPatch: Record<string, Json> = {};
  for (const field of JOB_PARSED_DATA_FIELDS) {
    const value = parsed.data[field as JobParsedDataField];
    if (value === undefined) continue;
    const key = JOB_PARSED_DATA_KEYS[field];
    parsedDataPatch[key] =
      Array.isArray(value) && value.length === 0
        ? null
        : value === ""
          ? null
          : (value as Json);
  }

  // Union, not replace: editing the title today must not hand yesterday's
  // edited description back to the cron. Only the ingest-written columns are
  // protected — parsed_data edits are excluded (the constraint wouldn't know
  // them, and the enrichment that writes parsed_data runs once per job).
  const overrides = Array.from(new Set([...(job.manual_overrides ?? []), ...editedColumns]));

  const { error } = await supabase
    .from("jobs")
    .update({
      ...updates,
      manual_overrides: overrides,
      // Only attach parsed_data when a parsed field was actually edited — an
      // empty object would otherwise be written (and null out the column's
      // whole jsonb, since update() sets whatever keys it's given).
      ...(Object.keys(parsedDataPatch).length > 0
        ? {
            parsed_data: {
              ...((job.parsed_data ?? {}) as Record<string, Json>),
              ...parsedDataPatch,
            },
          }
        : {}),
    })
    .eq("id", jobId);
  if (error) {
    console.error("api/jobs/[jobId]: update failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, manualOverrides: overrides });
}
