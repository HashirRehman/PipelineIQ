"use client";

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  Sun,
  UserRound,
  Users,
} from "lucide-react";
import type { TabId, Profile } from "@/app/page";
import { useTheme } from "next-themes";
import { Avatar } from "@/components/avatar";
import { PipelineIQLogo } from "@/components/pipelineiq-logo";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV: {
  id: TabId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "profiles", label: "Profiles", icon: UserRound },
  { id: "discovery", label: "Discovery", icon: Search },
  { id: "leads", label: "Leads", icon: Briefcase },
  { id: "users", label: "Users", icon: Users },
  { id: "statistics", label: "Statistics", icon: BarChart3 },
];

function ProfileAvatar({
  name,
  size = 24,
}: {
  name: string;
  size?: number;
}) {
  return <Avatar name={name} size={size} />;
}

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  profiles: Profile[];
  activeProfile: Profile;
  setActiveProfile: (p: Profile) => void;
  counts?: Record<string, number>;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  profiles,
  activeProfile,
  setActiveProfile,
  counts,
}: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SidebarProvider
      defaultOpen
      className="h-full w-[216px] min-h-0 shrink-0"
      style={{ "--sidebar-width": "216px" } as React.CSSProperties}
    >
      <SidebarRoot
        collapsible="none"
        className="bg-[var(--sidebar)] text-[var(--sidebar-fg)] border-r border-[var(--border)] select-none"
      >
        {/* Logo */}
        <SidebarHeader className="p-2 px-2.5 mb-4">
          <PipelineIQLogo />
        </SidebarHeader>

        <SidebarContent className="px-2.5">
          {/* Profile Switcher */}
          <div className="mb-4">
            <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="w-full h-auto p-2 px-2.5 justify-between gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg cursor-pointer text-left hover:bg-[var(--card)] hover:border-[var(--border-strong)] transition-colors shadow-none"
                  />
                }
              >
                <ProfileAvatar name={activeProfile.name} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--fg)] truncate">
                    {activeProfile.name}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--muted-fg)] truncate">
                    {activeProfile.seniority}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "shrink-0 text-[var(--muted-fg)] transition-transform",
                    profileOpen && "rotate-180"
                  )}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                className="p-1 bg-[var(--card)] text-[var(--fg)] border border-[var(--border-strong)] rounded-lg shadow-xl"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 py-1 text-[10px] font-semibold text-[var(--muted-fg)] uppercase font-mono border-b border-[var(--border)] rounded-none">
                    Switch Profile
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                {profiles.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => {
                      setActiveProfile(p);
                      setProfileOpen(false);
                    }}
                    className={cn(
                      "w-full gap-2 rounded-none px-2.5 py-2 text-left cursor-pointer",
                      p.id === activeProfile.id
                        ? "bg-[var(--secondary)] font-medium focus:bg-[var(--secondary)]"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    <ProfileAvatar name={p.name} size={20} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-[var(--fg)] truncate">
                        {p.name}
                      </div>
                      <div className="font-mono text-[9px] text-[var(--muted-fg)] truncate">
                        {p.seniority}
                      </div>
                    </div>
                    {p.id === activeProfile.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Nav Links */}
          <SidebarGroup>
            <SidebarGroupLabel className="px-2.5 py-1 h-auto text-[10px] font-semibold text-[var(--muted-fg)] uppercase font-mono tracking-wider">
              Menu
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="flex flex-col gap-0.5">
                {NAV.map((item) => {
                  const isActive = activeTab === item.id;
                  const count = counts?.[item.id];
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                          "h-auto justify-start p-2 px-2.5 rounded-md text-xs font-medium transition-all shadow-none cursor-pointer",
                          isActive
                            ? "bg-cyan-500/15 text-[var(--primary)] font-semibold hover:bg-cyan-500/15"
                            : "text-[var(--sidebar-fg)] hover:bg-black/5 dark:hover:bg-white/5",
                          count !== undefined && count > 0 && "pr-8"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            isActive
                              ? "text-[var(--primary)]"
                              : "text-[var(--muted-fg)]"
                          )}
                        />
                        <span className="flex-1 text-left ml-2">
                          {item.label}
                        </span>
                      </SidebarMenuButton>
                      {count !== undefined && count > 0 && (
                        <SidebarMenuBadge
                          className={cn(
                            "min-w-0 h-4 px-1.5 font-mono text-[10px] rounded-full",
                            isActive
                              ? "bg-[var(--primary)] text-white font-bold"
                              : "bg-[var(--secondary)] text-[var(--muted-fg)]"
                          )}
                        >
                          {count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Bottom */}
        <SidebarFooter className="p-2.5 border-t border-[var(--border)]">
          <Button
            variant="ghost"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="w-full h-auto justify-start gap-2 p-2 px-2.5 rounded-md text-xs text-[var(--sidebar-fg)] hover:bg-black/5 dark:hover:bg-white/5 shadow-none cursor-pointer"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-[13px]" />
            ) : (
              <Moon className="size-[13px]" />
            )}
            <span className="text-xs">
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </Button>

          <div className="flex items-center gap-2 p-0.5">
            <ProfileAvatar name="Alex Rivera" size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[var(--sidebar-fg)] truncate">
                Alex Rivera
              </div>
              <div className="font-mono text-[10px] text-[var(--primary)]">
                admin
              </div>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                aria-label="Log out"
                title="Log out"
                className="text-[var(--muted-fg)] hover:bg-black/5 hover:text-[var(--fg)] dark:hover:bg-white/5 shadow-none cursor-pointer"
              >
                <LogOut className="size-[13px]" />
              </Button>
            </form>
          </div>
        </SidebarFooter>
      </SidebarRoot>
    </SidebarProvider>
  );
}
