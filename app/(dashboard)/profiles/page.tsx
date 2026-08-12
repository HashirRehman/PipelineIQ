import type { Metadata } from "next"
import { redirect } from "next/navigation"
import ProfilesTab from "./profiles-tab"
import { getCachedRolePermissions } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Profiles",
}

export default async function ProfilesPage() {
  // Profiles are Admin + BD Manager. Anyone else (Business Developer,
  // unassigned) is redirected to Discovery.
  const perms = await getCachedRolePermissions()
  if (!perms.canAccessProfiles) {
    redirect("/discovery")
  }
  return <ProfilesTab />
}
