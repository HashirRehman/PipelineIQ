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
} from "@/lib/services/manual-jobs";

export const dynamic = "force-dynamic";

// Manually add a job from the Pipeline page's "New Job" flow. One call does
// three inserts, in dependency order:
//   1. the `jobs` row (visible to every other profile as a Discovery
//      suggestion — no state row = suggested),
//   2. the chosen profile's `job_profile_states` row (applied / dismissed;
//      a "lead" job is applied so it can wrap the lead),
//   3. when the state is "lead", the `leads` row with its pipeline stage and
//      the lead comment.
// Like POST /api/leads, the inserts are sequential rather than a DB
// transaction (the schema doc's open question #8 — the codebase has no
// SECURITY DEFINER write functions), but every failure-prone input — the
// profile, the Manual scraper, and the lead stage — is validated BEFORE the
// first insert, so the only failure after that point is a transient DB error.
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Job pages are open to every role; the gate stays as a named helper so a
  // future restricted role only has to change lib/auth/roles.ts.
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

  const parsed = createManualJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

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

  const prepared = prepareManualJob(parsed.data, refs);
  if ("message" in prepared) {
    return NextResponse.json(
      { error: prepared.message },
      { status: prepared.status },
    );
  }

  const inserted = await insertManualJob(context, prepared);
  if (!inserted.ok) {
    return NextResponse.json({ error: inserted.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, jobId: inserted.jobId });
}
