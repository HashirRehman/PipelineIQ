import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DesktopSidebar, MobileSidebar } from "@/components/dashboard-sidebar";

export function AppShell({
  isAdmin,
  userEmail,
  children,
}: {
  isAdmin: boolean;
  userEmail: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <DesktopSidebar isAdmin={isAdmin} userEmail={userEmail} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:justify-end md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <MobileSidebar isAdmin={isAdmin} userEmail={userEmail} />
            <Link href="/" className="font-heading text-base font-semibold">
              PipelineIQ
            </Link>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
