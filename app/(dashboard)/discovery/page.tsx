import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DiscoveryTab from "./discovery-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Discovery — PipelineIQ",
};

export default async function DiscoveryPage() {
  // Job pages are open to every role (Admin / BD Manager / Business Developer).
  const perms = await getCachedRolePermissions();
  if (!perms.canAccessJobs) redirect("/users");
  return <DiscoveryTab />;
}
