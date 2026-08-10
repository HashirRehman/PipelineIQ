import { redirect } from "next/navigation";
import { getCachedRolePermissions } from "@/lib/supabase/server";

/**
 * Legacy landing page — routes each role to the homeSection declared in the
 * ROLE_PERMISSIONS matrix (lib/auth/roles.ts), so adding a role or changing
 * its landing page is a one-line matrix edit.
 */
export default async function DashboardHomePage() {
  const perms = await getCachedRolePermissions();
  redirect(perms.homeSection);
}
