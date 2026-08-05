// Module 3 — job-discovery feed Server Actions (BD or Admin, RLS-scoped)
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GroqAiClient } from "@/lib/ai/groq-client";
import {
  acquireDiscoveryLock,
  releaseDiscoveryLock,
  runJobDiscovery,
  type DiscoverySummary,
} from "@/lib/cron/discover-jobs";
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

  revalidatePath("/");
  return { success: true };
}

export type RunDiscoveryState = {
  status?: "completed" | "skipped" | "cooldown" | "error";
  summary?: DiscoverySummary;
  error?: string;
  nextRunAvailableAt?: string;
};

// Open to any authenticated role (Admin or BD) — this app has no
// self-signup and no anonymous access, so "any real session" already
// means "a real user of this app," not the public internet. Unlike the
// Admin-only actions in lib/actions/engineers.ts, this check is not UX
// polish sitting on top of an RLS policy — runJobDiscovery needs the
// service-role client regardless of caller (it writes
// jobs/job_engineer_matches/cron_run_locks, none of which grant
// authenticated direct write access), which bypasses RLS entirely. That
// makes this check the ONLY enforcement boundary for this action, so it
// must run — and be allowed to reject — before the admin client is ever
// created.
export async function runDiscoveryNow(
  _prevState: RunDiscoveryState,
  _formData: FormData,
): Promise<RunDiscoveryState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", error: "Not authorized." };
  }

  const adminClient = createAdminClient();

  const lockResult = await acquireDiscoveryLock(adminClient);
  if (!lockResult.acquired) {
    if (lockResult.reason === "cooldown") {
      return { status: "cooldown", nextRunAvailableAt: lockResult.nextRunAvailableAt };
    }
    return { status: "skipped" };
  }

  let completed = false;
  try {
    const summary = await runJobDiscovery(adminClient, new GroqAiClient());
    completed = true;
    revalidatePath("/");
    return { status: "completed", summary };
  } catch (error) {
    console.error("runDiscoveryNow: runJobDiscovery failed", error);
    return { status: "error", error: "Something went wrong. Please try again." };
  } finally {
    await releaseDiscoveryLock(adminClient, { completed });
  }
}
