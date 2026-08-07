import type { Metadata } from "next";
import Sidebar from "./sidebar";
import { getCachedUser, getCachedUserRole } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Shared shell for every section of the app (profiles, discovery, leads,
 * users, statistics). The sidebar lives here so it persists across
 * navigation instead of being remounted per tab. The acting user's identity
 * is resolved on the server (middleware already guarantees they're authed
 * before reaching this shell) and passed down for display.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, role] = await Promise.all([getCachedUser(), getCachedUserRole()]);

  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <Sidebar
        user={{
          name,
          email: user?.email ?? "",
          role: role ? role.toLowerCase() : null,
        }}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </main>
    </div>
  );
}
