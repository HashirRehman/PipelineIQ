import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StatisticsTab from "./statistics-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Statistics — PipelineIQ",
};

export default async function StatisticsPage() {
  // Job pages are open to every role (Admin / BD Manager / Business Developer).
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) redirect("/users");
  return <StatisticsTab />;
}
