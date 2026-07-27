// Module 4 — lead management Server Actions
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markAppliedSchema, withdrawLeadSchema } from "@/lib/validation/schemas";

export type MarkAppliedState = {
  error?: string;
  success?: boolean;
  leadId?: string;
};

// No requireAdmin-style gate — BD-or-Admin, same as dismissMatch/
// runDiscoveryNow. p_bd_user_id is always the caller's own id: there's no
// BD-picker UI yet, so the clicking user becomes the lead's permanent
// owner (including Admin, who already sees every lead regardless). All
// real authorization (match access, duplicate-lead prevention) happens
// inside create_lead_from_match() itself — this action only translates
// its P0001 messages into the same friendly-error shape every other
// action this session uses.
export async function markApplied(
  _prevState: MarkAppliedState,
  formData: FormData,
): Promise<MarkAppliedState> {
  const parsed = markAppliedSchema.safeParse({
    matchId: formData.get("matchId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authorized." };
  }

  const { data, error } = await supabase.rpc("create_lead_from_match", {
    p_match_id: parsed.data.matchId,
    p_bd_user_id: user.id,
  });

  if (error) {
    if (error.code === "P0001") {
      return { error: error.message };
    }
    console.error("markApplied: create_lead_from_match rpc failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/discovery");
  revalidatePath("/leads");
  return { success: true, leadId: data as string };
}

export type WithdrawLeadState = {
  error?: string;
  success?: boolean;
};

// withdraw_lead() itself enforces is_admin() OR bd_user_id = auth.uid() —
// this action has no separate check, same reasoning as create_lead_from_match
// above.
export async function withdrawLead(
  _prevState: WithdrawLeadState,
  formData: FormData,
): Promise<WithdrawLeadState> {
  const parsed = withdrawLeadSchema.safeParse({
    leadId: formData.get("leadId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("withdraw_lead", {
    p_lead_id: parsed.data.leadId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    if (error.code === "P0001") {
      return { error: error.message };
    }
    console.error("withdrawLead: withdraw_lead rpc failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/leads");
  return { success: true };
}
