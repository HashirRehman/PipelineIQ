import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { verifyOrganizationAccess } from "@/lib/api/organization";
import { createClient, getCachedUser } from "@/lib/supabase/server";
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

  const { notes, pipelineStageId } = parsed.data;

  const org = await verifyOrganizationAccess(request, supabase, user.id);
  if (!org.ok) return org.response;

  // RLS scopes this to the owner snapshot (user_id = auth.uid()) or admin;
  // the org filter additionally rejects cross-org lead ids up front.
  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("id", leadId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  // Applier's Notes: only the user whose assigned profile was used to apply
  // (the permanent user_id owner snapshot) may write or edit the notes.
  if (notes !== undefined && lead.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the user who applied with the profile can edit the notes." },
      { status: 403 },
    );
  }

  const updates: { notes?: string; pipeline_stage_id?: string; last_activity_at: string } = {
    last_activity_at: new Date().toISOString(),
  };
  if (notes !== undefined) updates.notes = notes;
  if (pipelineStageId !== undefined) updates.pipeline_stage_id = pipelineStageId;

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
