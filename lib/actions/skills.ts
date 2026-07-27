"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/engineers";
import { createSkillSchema, setSkillActiveSchema } from "@/lib/validation/schemas";

export type SkillActionState = {
  error?: string;
  success?: boolean;
};

export async function createSkill(
  _prevState: SkillActionState,
  formData: FormData,
): Promise<SkillActionState> {
  const parsed = createSkillSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  const { error } = await supabase.from("skills").insert({ name: parsed.data.name });

  if (error) {
    if (error.code === "23505") {
      return { error: "A skill with this name already exists." };
    }
    console.error("createSkill: skills insert failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/skills");
  revalidatePath("/engineers", "layout");
  return { success: true };
}

export async function setSkillActive(
  _prevState: SkillActionState,
  formData: FormData,
): Promise<SkillActionState> {
  const parsed = setSkillActiveSchema.safeParse({
    skillId: formData.get("skillId"),
    isActive: formData.get("isActive"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const adminCheck = await requireAdmin(supabase);
  if ("error" in adminCheck) {
    return { error: adminCheck.error };
  }

  const { error } = await supabase
    .from("skills")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.skillId);

  if (error) {
    console.error("setSkillActive: skills update failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin/skills");
  revalidatePath("/engineers", "layout");
  return { success: true };
}
