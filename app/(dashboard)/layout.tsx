import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Display concern only (which nav links to show) — middleware remains
  // the actual /admin/* access-control boundary.
  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <AppShell isAdmin={!!isAdmin} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
