import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DashboardTab from "./dashboard-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Root dashboard — the at-a-glance operational view. Every role lands here
 * after login; Admin and BD Manager see the whole org, Business Developers
 * see their own pipeline (scoped server-side by the leads API).
 */
export default async function DashboardHomePage() {
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) redirect("/users");
  return <DashboardTab />;
}
