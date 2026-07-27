// Module 1 — auth-flow Server Actions (distinct from users.ts's user-record actions)
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPasswordSchema, signInSchema } from "@/lib/validation/schemas";

export type SignInState = {
  error?: string;
};

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword(
    parsed.data,
  );

  if (error) {
    // Never reveal which field was wrong.
    return { error: "Invalid email or password." };
  }

  // Client-initiated insert against the RLS-scoped client is fine here
  // since a user can only insert their own row (login_history_insert
  // policy: user_id = auth.uid()).
  const { error: historyError } = await supabase
    .from("login_history")
    .insert({ user_id: data.user.id });

  if (historyError) {
    console.error("signIn: login_history insert failed", historyError);
    // Don't block sign-in over a logging failure.
  }

  // Deactivation (profiles.is_active) only marks the row — Supabase Auth
  // itself doesn't know about it, so a deactivated user's credentials
  // would otherwise still authenticate successfully. Enforcing it here is
  // what actually makes "Admin can deactivate a login" true.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact an administrator." };
  }

  // /engineers is already role-aware via RLS (Admin sees all, BD sees
  // only their assigned engineers) — the same shared home for both roles.
  redirect("/engineers");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type SetPasswordState = {
  error?: string;
};

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your invite link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error("setPassword: updateUser failed", error);
    return { error: "Something went wrong. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/login");
}
