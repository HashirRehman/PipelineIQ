"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Users } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DashboardNav, type DashboardNavItem } from "@/components/dashboard-nav";

function buildNavItems(isAdmin: boolean): DashboardNavItem[] {
  const items: DashboardNavItem[] = [];

  if (isAdmin) {
    items.push({ href: "/admin/users", label: "Users", icon: Users });
  }

  return items;
}

function SidebarContent({
  isAdmin,
  userEmail,
  onNavigate,
}: {
  isAdmin: boolean;
  userEmail: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="font-heading text-lg font-semibold"
        >
          PipelineIQ
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <DashboardNav items={buildNavItems(isAdmin)} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        <form action={signOutAction} className="mt-2">
          <Button variant="ghost" size="sm" type="submit" className="w-full justify-start px-0">
            Logout
          </Button>
        </form>
      </div>
    </div>
  );
}

export function DesktopSidebar({
  isAdmin,
  userEmail,
}: {
  isAdmin: boolean;
  userEmail: string;
}) {
  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border">
      <SidebarContent isAdmin={isAdmin} userEmail={userEmail} />
    </aside>
  );
}

export function MobileSidebar({
  isAdmin,
  userEmail,
}: {
  isAdmin: boolean;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label="Open navigation menu"
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent
          isAdmin={isAdmin}
          userEmail={userEmail}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
