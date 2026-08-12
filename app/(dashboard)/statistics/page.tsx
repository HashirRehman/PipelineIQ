import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StatisticsTab from "./statistics-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Statistics",
};

/**
 * Statistics — the filterable analytics explorer (date ranges, granularity,
 * user/profile filters, trend charts). Admin and BD Manager see the whole
 * org; Business Developers see only their own data (scoped server-side by
 * the leads API).
 */
export default async function StatisticsPage() {
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) redirect("/users");
  return <StatisticsTab />;
}
