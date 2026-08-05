"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withdrawLeadSchema, reapplyLeadSchema } from "@/lib/validation/schemas";

export type WithdrawLeadState = {
  error?: string;
  success?: boolean;
};

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
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: true };
}

export type ReapplyLeadState = {
  error?: string;
};

export async function reapplyLead(
  _prevState: ReapplyLeadState,
  formData: FormData,
): Promise<ReapplyLeadState> {
  const parsed = reapplyLeadSchema.safeParse({
    leadId: formData.get("leadId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("job_engineer_match_id, bd_user_id, status")
    .eq("id", parsed.data.leadId)
    .maybeSingle();

  if (!lead) {
    return { error: "Lead not found." };
  }

  if (lead.status !== "withdrawn") {
    return { error: "Only a withdrawn lead can be reapplied." };
  }

  const { data: newLeadId, error } = await supabase.rpc("create_lead_from_match", {
    p_match_id: lead.job_engineer_match_id,
    p_bd_user_id: lead.bd_user_id,
  });

  if (error) {
    if (error.code === "P0001") {
      return { error: error.message };
    }
    console.error("reapplyLead: create_lead_from_match rpc failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/leads");
  redirect(`/leads/${newLeadId}`);
}
