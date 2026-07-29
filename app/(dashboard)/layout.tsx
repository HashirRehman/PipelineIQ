import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getCachedUser, getCachedIsAdmin } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  // Display concern only (which nav links to show) — middleware remains
  // the actual /admin/* access-control boundary.
  const isAdmin = await getCachedIsAdmin();

  return (
    <AppShell isAdmin={!!isAdmin} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
