import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LeadStagesTab from "./lead-stages-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lead Stages",
};

export default async function LeadStagesPage() {
  // Admin-only — everyone else lands on Discovery, same redirect Users uses.
  const perms = await getCachedRolePermissions();
  if (!perms.canManageLeadStages) redirect("/discovery");
  return <LeadStagesTab />;
}
