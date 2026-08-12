import type { Metadata } from "next";
import Sidebar from "./sidebar";
import { TopBar } from "@/components/top-bar";
import { OrganizationProvider } from "@/components/organization-provider";
import { getCachedOrganizationId, getCachedUser, getCachedUserRole } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · PipelineIQ",
  },
};

/**
 * Shared shell for every section of the app (profiles, discovery, leads,
 * users, statistics). The sidebar and top bar live here so they persist
 * across navigation instead of being remounted per tab. The acting user's
 * identity is resolved on the server (middleware already guarantees they're
 * authed before reaching this shell) and passed down for display.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, role, organizationId] = await Promise.all([
    getCachedUser(),
    getCachedUserRole(),
    getCachedOrganizationId(),
  ]);

  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <OrganizationProvider organizationId={organizationId}>
      <div className="flex h-screen overflow-hidden bg-page-bg text-foreground">
        <Sidebar
          user={{
            name,
            email: user?.email ?? "",
            role: role ? role.toLowerCase() : null,
          }}
        />
        <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <TopBar
            user={{
              name,
              email: user?.email ?? "",
              role: role ? role.toLowerCase() : null,
            }}
          />
          <main className="flex flex-1 min-w-0 flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </OrganizationProvider>
  );
}
