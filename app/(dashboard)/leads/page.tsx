import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LeadsTab from "./leads-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Leads",
};

export default async function LeadsPage() {
  // Job pages are open to every role (Admin / BD Manager / Business Developer).
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) redirect("/users");
  return <LeadsTab />;
}
