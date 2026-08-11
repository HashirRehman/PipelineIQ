import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import { createManualJobSchema } from "@/lib/validation/schemas";
import {
  insertManualJob,
  loadManualJobRefs,
  prepareManualJob,
  type ManualJobContext,
  type ManualJobPrepared,
} from "@/lib/services/manual-jobs";

export const dynamic = "force-dynamic";

const MAX_ROWS = 500;

const importSchema = createManualJobSchema
  .array()
  .min(1, "Nothing to import.")
  .max(MAX_ROWS, `At most ${MAX_ROWS} jobs per import.`);

type ImportResult = {
  index: number;
  jobId?: string;
  error?: string;
};

// Bulk-import jobs from the Pipeline page's "Import" flow. The client has
// already parsed the spreadsheet, matched profiles/stages, and validated each
// row — this route re-validates everything against the server's own rules
// (the same schema as the single "New Job" call) BEFORE the first insert, so
// one bad row can never leave a half-created job behind. Inserts then run
// sequentially; per-row results let the client report exactly what landed.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jobsPayload =
    typeof body === "object" &&
    body !== null &&
    "jobs" in body &&
    Array.isArray((body as { jobs: unknown }).jobs)
      ? (body as { jobs: unknown }).jobs
      : body;

  const parsed = importSchema.safeParse(jobsPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const jobs = parsed.data;

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;
  const organizationId = org.organizationId;

  const context: ManualJobContext = {
    supabase,
    organizationId,
    userId: user.id,
    canAccessProfiles: perms.canAccessProfiles,
  };

  const refs = await loadManualJobRefs(context);
  if ("message" in refs) {
    return NextResponse.json({ error: refs.message }, { status: refs.status });
  }

  // Validate every row up front — a bad profile or stage anywhere means the
  // whole import is rejected before anything is written.
  const preparedRows: ManualJobPrepared[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const prepared = prepareManualJob(jobs[i], refs);
    if ("message" in prepared) {
      return NextResponse.json(
        { error: `Row ${i + 1}: ${prepared.message}` },
        { status: 400 },
      );
    }
    preparedRows.push(prepared);
  }

  const results: ImportResult[] = [];
  for (let i = 0; i < preparedRows.length; i++) {
    const inserted = await insertManualJob(context, preparedRows[i]);
    if (inserted.ok) {
      results.push({ index: i, jobId: inserted.jobId });
    } else {
      results.push({ index: i, error: inserted.message });
    }
  }

  const imported = results.filter((r) => r.jobId).length;
  const failed = results.filter((r) => r.error);

  if (imported === 0 && failed.length > 0) {
    return NextResponse.json(
      { error: failed[0].error ?? "Nothing was imported." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    imported,
    failed: failed.length,
    results,
  });
}
