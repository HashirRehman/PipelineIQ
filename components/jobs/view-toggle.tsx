"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/hooks/use-persisted-view";
import { cn } from "@/lib/utils";

// Segmented List | Cards toggle for the list pages (Pipeline, Discovery,
// Profiles). Mirrors the Leads page's List/Board control — an active option
// gets the accent background, the other stays muted.
export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  const option = (value: ViewMode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={view === value}
      title={`${label} view`}
      className={cn(
        "flex h-9 items-center gap-1.5 px-2.5 text-xs transition cursor-pointer",
        view === value
          ? "bg-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/50",
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border">
      {option("list", "List", <List className="size-3.5" />)}
      <div className="h-4 w-px bg-border" />
      {option("cards", "Cards", <LayoutGrid className="size-3.5" />)}
    </div>
  );
}
