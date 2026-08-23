import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api/guard";
import { createClient, getCachedRolePermissions, getCachedUser } from "@/lib/supabase/server";
import {
  createPipelineStageSchema,
  reorderPipelineStagesSchema,
} from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export type PipelineStageState = "active" | "paused" | "closed";

export interface ApiPipelineStage {
  id: string;
  name: string;
  orderIndex: number;
  state: PipelineStageState;
  leadCount: number;
}

export interface PipelineStagesResponse {
  stages: ApiPipelineStage[];
  canManage: boolean;
}

export async function GET() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = await getCachedRolePermissions();

  const [stagesRes, leadsRes] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, order_index, state")
      .order("order_index", { ascending: true }),
    supabase.from("leads").select("pipeline_stage_id").is("deleted_at", null),
  ]);

  if (stagesRes.error) {
    console.error("api/pipeline-stages: stages query failed", stagesRes.error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (leadsRes.error) {
    console.error("api/pipeline-stages: leads query failed", leadsRes.error);
  }

  const countByStage = new Map<string, number>();
  for (const row of leadsRes.data ?? []) {
    countByStage.set(
      row.pipeline_stage_id,
      (countByStage.get(row.pipeline_stage_id) ?? 0) + 1,
    );
  }

  const stages: ApiPipelineStage[] = (stagesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    orderIndex: s.order_index,
    state: s.state as PipelineStageState,
    leadCount: countByStage.get(s.id) ?? 0,
  }));

  const response: PipelineStagesResponse = {
    stages,
    canManage: perms.canManageLeadStages,
  };

  return NextResponse.json(response);
}

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
  if (!perms.canManageLeadStages) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createPipelineStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { name, state } = parsed.data;

  const { data: maxRow } = await supabase
    .from("pipeline_stages")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrderIndex = (maxRow?.order_index ?? -1) + 1;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({ name, state, order_index: nextOrderIndex })
    .select("id, name, order_index, state")
    .single();

  if (error) {
    console.error("api/pipeline-stages: insert failed", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const stage: ApiPipelineStage = {
    id: data.id,
    name: data.name,
    orderIndex: data.order_index,
    state: data.state as PipelineStageState,
    leadCount: 0,
  };

  return NextResponse.json({ success: true, stage });
}

// Rewrites order_index for every stage id, in the order supplied. Supabase's
// client SDK has no multi-row transaction, so each stage is updated
// sequentially — acceptable here since the stage count is small (a handful
// of rows) and reorders are infrequent admin actions, not a hot path.
export async function PATCH(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = reorderPipelineStagesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { stageIds } = parsed.data;

  // stageIds must be the complete, current set of stage ids — a partial or
  // stale list (concurrent edit, deleted/added stage since the client last
  // fetched) would leave the omitted stage's order_index untouched and
  // colliding with the freshly-assigned 0..n-1 range.
  const { data: existingStages, error: existingError } = await supabase
    .from("pipeline_stages")
    .select("id");
  if (existingError) {
    console.error("api/pipeline-stages: reorder existing-ids query failed", existingError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const existingIds = new Set((existingStages ?? []).map((s) => s.id));
  const suppliedIds = new Set(stageIds);
  const isSameSet =
    existingIds.size === suppliedIds.size &&
    [...existingIds].every((id) => suppliedIds.has(id));
  if (!isSameSet) {
    return NextResponse.json(
      { error: "Stage list is out of date. Refresh and try again." },
      { status: 409 },
    );
  }

  for (let i = 0; i < stageIds.length; i++) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ order_index: i })
      .eq("id", stageIds[i]);
    if (error) {
      console.error("api/pipeline-stages: reorder failed", error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
