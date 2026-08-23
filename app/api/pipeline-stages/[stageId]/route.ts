import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import { updatePipelineStageSchema } from "@/lib/validation/schemas";
import type { ApiPipelineStage, PipelineStageState } from "@/app/api/pipeline-stages/route";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
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
  if (!perms.canManageLeadStages) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { stageId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updatePipelineStageSchema.safeParse({ ...(body as object), stageId });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { name, state } = parsed.data;

  const updates: { name?: string; state?: PipelineStageState } = {};
  if (name !== undefined) updates.name = name;
  if (state !== undefined) updates.state = state;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .update(updates)
    .eq("id", stageId)
    .select("id, name, order_index, state")
    .maybeSingle();

  if (error) {
    console.error("api/pipeline-stages/[stageId]: update failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Stage not found." }, { status: 404 });
  }

  const stage: Omit<ApiPipelineStage, "leadCount"> = {
    id: data.id,
    name: data.name,
    orderIndex: data.order_index,
    state: data.state as PipelineStageState,
  };

  return NextResponse.json({ success: true, stage });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
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
  if (!perms.canManageLeadStages) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { stageId } = await params;

  const { count, error: countError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_stage_id", stageId)
    .is("deleted_at", null);

  if (countError) {
    console.error("api/pipeline-stages/[stageId]: lead count failed", countError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `${count} lead${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} in this stage. Move them before deleting.`,
      },
      { status: 400 },
    );
  }

  const { error, data } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", stageId)
    .select("id");

  if (error) {
    console.error("api/pipeline-stages/[stageId]: delete failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Stage not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
