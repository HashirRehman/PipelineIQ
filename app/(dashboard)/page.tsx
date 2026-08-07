import { redirect } from "next/navigation";

/**
 * Legacy landing page — Profiles is the default section, so canonicalize
 * "/" to "/profiles" (matches the old default tab).
 */
export default function DashboardHomePage() {
  redirect("/profiles");
}
