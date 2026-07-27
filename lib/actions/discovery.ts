// Module 3 — job-discovery feed Server Actions (BD or Admin, RLS-scoped)
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dismissMatchSchema } from "@/lib/validation/schemas";

export type DismissMatchState = {
  error?: string;
  success?: boolean;
};

// No requireAdmin-style gate here — dismissing a match is a BD-or-Admin
// action. The job_engineer_matches_update RLS policy (is_admin() or
// engineer_id in assigned_engineer_ids()) is the actual boundary, and the
// grant on this table only permits touching (status, dismissed_reason) in
// the first place — so this payload is hardcoded to exactly those two
// columns, never relevance_score/ai_model_version.
export async function dismissMatch(
  _prevState: DismissMatchState,
  formData: FormData,
): Promise<DismissMatchState> {
  const parsed = dismissMatchSchema.safeParse({
    matchId: formData.get("matchId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  // An RLS-filtered update matches zero rows silently (no Postgres error),
  // so .select("id") + an empty-check is what turns that into a real
  // "not accessible" message instead of a false "success".
  const { data, error } = await supabase
    .from("job_engineer_matches")
    .update({ status: "dismissed", dismissed_reason: parsed.data.reason })
    .eq("id", parsed.data.matchId)
    .select("id");

  if (error) {
    console.error("dismissMatch: job_engineer_matches update failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  if (!data || data.length === 0) {
    return { error: "Match not found or not accessible." };
  }

  revalidatePath("/discovery");
  return { success: true };
}
