import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppliedJobsTab from "./applied-jobs-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pipeline — PipelineIQ",
};

export default async function AppliedJobsPage() {
  // Job pages are open to every role (Admin / BD Manager / Business Developer).
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) redirect("/users");
  return <AppliedJobsTab />;
}