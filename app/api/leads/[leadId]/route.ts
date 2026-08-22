import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import { updateLeadSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leadId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { notes, pipelineStageId, developer } = parsed.data;

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // RLS scopes this to the owner (owner snapshot or the profile's current
  // assigned user) or admin/manager; the org filter additionally rejects
  // cross-org lead ids up front.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id, profiles(user_id)")
    .eq("id", leadId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  // Applier's Notes: the user whose assigned profile owns the lead (the
  // profile's CURRENT user — leads follow the profile) may write or edit the
  // notes — plus the roles with canManageLeadNotes in the ROLE_PERMISSIONS
  // matrix (Admin + BD Manager), who manage the whole pipeline.
  const perms = await getCachedRolePermissions();
  const isProfileOwner = lead.profiles?.user_id != null && lead.profiles.user_id === user.id;
  if (notes !== undefined && lead.user_id !== user.id && !isProfileOwner && !perms.canManageLeadNotes) {
    return NextResponse.json(
      { error: "Only the applier, an admin, or a manager can edit the notes." },
      { status: 403 },
    );
  }

  // Who handles the lead — an assignment decision, so Admin + BD Manager
  // only (same rule as editing a job's fields; the UI gates the row on
  // canEditJob too). "" clears the developer.
  if (developer !== undefined && !perms.canEditJobs) {
    return NextResponse.json(
      { error: "Only an admin or a manager can assign the developer." },
      { status: 403 },
    );
  }

  const updates: {
    notes?: string;
    pipeline_stage_id?: string;
    developer?: string | null;
    last_activity_at: string;
  } = {
    last_activity_at: new Date().toISOString(),
  };
  if (notes !== undefined) updates.notes = notes;
  if (pipelineStageId !== undefined) updates.pipeline_stage_id = pipelineStageId;
  if (developer !== undefined) updates.developer = developer === "" ? null : developer;

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (error) {
    console.error("api/leads/[leadId]: update failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
