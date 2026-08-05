// Module 1 — invite/user-management Server Actions
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCachedIsAdmin } from "@/lib/supabase/server";
import { inviteUserSchema } from "@/lib/validation/schemas";

export type InviteUserState = {
  error?: string;
  success?: boolean;
};

export async function inviteUser(
  _prevState: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    roleId: formData.get("roleId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { email, fullName, roleId } = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authorized." };
  }

  // Mandatory here even though middleware already gates /admin/* — the
  // invite call below uses the service-role client, which bypasses RLS
  // entirely. For that one call, this check *is* the access-control
  // boundary, not a redundant extra layer on top of RLS.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    return { error: "Not authorized." };
  }

  const adminClient = createAdminClient();

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    });

  if (inviteError) {
    if (inviteError.code === "email_exists") {
      return { error: "An account with this email already exists." };
    }
    console.error("inviteUser: inviteUserByEmail failed", inviteError);
    return { error: "Something went wrong. Please try again." };
  }

  // Uses the request-scoped RLS client, not the admin client — relies on
  // the user_roles_insert policy (is_admin()) as defense-in-depth on top
  // of the explicit check above.
  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: inviteData.user.id,
    role_id: roleId,
    assigned_by: user.id,
  });

  if (roleError) {
    console.error("inviteUser: user_roles insert failed", roleError);
    return {
      error:
        "User invited, but role assignment failed — contact an administrator.",
    };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export type UserStatusState = {
  error?: string;
  success?: boolean;
};

export async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
): Promise<UserStatusState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authorized." };
  }

  const isAdmin = await getCachedIsAdmin();
  if (!isAdmin) {
    return { error: "Not authorized." };
  }

  if (userId === user.id) {
    return { error: "You cannot change your own active status." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) {
    console.error("setUserActiveStatus error:", error);
    return { error: error.message || "Failed to update user status." };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

