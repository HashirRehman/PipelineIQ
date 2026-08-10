import type { Metadata } from "next";
import { redirect } from "next/navigation";
import UsersTab from "./users-tab";
import { getCachedRolePermissions } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Team — PipelineIQ",
};

export default async function UsersPage() {
  // Users is Admin + BD Manager; Business Developers land on Discovery.
  const perms = await getCachedRolePermissions();
  if (!perms.canViewUsers) redirect("/discovery");
  return <UsersTab />;
}
