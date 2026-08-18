"use client";

import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

interface TopBarProps {
  user: { name: string; email: string; role: string | null };
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/profiles": "Profiles",
  "/discovery": "Discovery",
  "/pipeline": "Pipeline",
  "/applied-jobs": "Pipeline",
  "/users": "Team",
  "/statistics": "Statistics",
  "/settings": "Settings",
};

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname();
  const segment = "/" + (pathname.split("/")[1] ?? "");
  const pageName = PAGE_NAMES[segment] ?? "PipelineIQ";

  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <header className="flex h-[57px] shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <h1 className="text-title-sm font-heading font-semibold tracking-tight text-foreground">
        {pageName}
      </h1>
      <div className="flex items-center gap-3">
        {/* Mode toggle — light / dark */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="size-8 rounded-lg hover:bg-accent"
        >
          {isDark ? (
            <Sun className="size-4" strokeWidth={1.8} />
          ) : (
            <Moon className="size-4" strokeWidth={1.8} />
          )}
        </Button>
      </div>
    </header>
  );
}
