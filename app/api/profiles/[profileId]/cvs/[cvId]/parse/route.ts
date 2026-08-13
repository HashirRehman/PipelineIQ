// Manual re-parse of a single CV.
//
// Two things need this: a CV whose automatic parse failed (a Groq outage, a
// rate limit, or a file that turned out to be unreadable), and a CV parsed
// under an older parse_schema_version.
//
// Unlike the upload path this runs inline rather than in after() — the caller
// asked for a parse and is waiting on the answer, so the outcome comes back in
// the response instead of only in the row.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { GroqAiClient } from "@/lib/ai/groq-client";
import { actorNameFromUser, logActivity } from "@/lib/api/activity";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { parseAndStoreCv } from "@/lib/cv-parsing/parse-cv";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// A Groq call plus a file download; nowhere near the ceiling, but a default
// timeout is a bad reason to leave a row stuck 'pending'.
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ profileId: string; cvId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { profileId, cvId } = await context.params;

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Re-parsing spends AI budget and overwrites stored data, so it matches
  // upload/delete: Admin + BD Manager.
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessProfiles) {
    return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
  }

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // Read through the user-scoped client so RLS applies to the lookup, and
  // join the profile to enforce that this CV really belongs to a profile in
  // the caller's org — profile_cvs has no organization_id of its own.
  const { data: cvRow } = await supabase
    .from("profile_cvs")
    .select("id, file_name, file_type, storage_path, profiles!inner(id, organization_id, full_name)")
    .eq("id", cvId)
    .eq("profile_id", profileId)
    .eq("profiles.organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!cvRow) {
    return NextResponse.json({ success: false, error: "CV not found." }, { status: 404 });
  }

  // The write goes through the service-role client: profile_cvs_update is
  // admin-only under RLS and this caller is an admin, but the parse columns
  // are system-owned bookkeeping, written the same way the sweep and the
  // upload's after() callback write them. One code path, one set of semantics.
  const outcome = await parseAndStoreCv(createAdminClient(), new GroqAiClient(), {
    cvId: cvRow.id,
    fileType: cvRow.file_type,
    storagePath: cvRow.storage_path,
  });

  if (outcome.status === "failed") {
    // 200, not 5xx: the request was handled correctly and the row now records
    // exactly why the parse didn't work. The client needs the reason, not an
    // error status implying it should retry blindly.
    return NextResponse.json({ success: false, status: "failed", error: outcome.error });
  }

  // profiles is a to-one embed (one profile per CV) despite the generated
  // type's array shape — see the "no generated types embed" gotcha; the
  // runtime always hands back a single object here.
  const profileRow = cvRow.profiles as unknown as { full_name: string };

  await logActivity({
    supabase,
    organizationId: org.organizationId,
    actorUserId: user.id,
    actorName: actorNameFromUser(user),
    action: "profile_cv_parsed",
    description: `Parsed CV "${cvRow.file_name}" for profile "${profileRow.full_name}"`,
    entityType: "profile_cv",
    entityId: cvRow.id,
    entityLabel: cvRow.file_name,
  });

  revalidatePath("/");

  return NextResponse.json({
    success: true,
    status: "success",
    skillCount: outcome.skillCount,
    experienceCount: outcome.experienceCount,
  });
}
