"use client"

import type { ReactNode } from "react"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Shared collapsible right-hand filter sidebar — the shell behind the
 * Discovery / Pipeline / Leads filter bars. Each page composes its own
 * sections (FilterSection, DateRangeSection, SortSection, CountryCombobox,
 * ProfileUserFilters…) as children; this component owns the collapse
 * animation, the "Filters" header, and the Clear button.
 *
 * `widthClass` must be a literal Tailwind class (e.g. "w-[240px]") — it's
 * applied to both the aside (collapsed → w-0) and the inner fixed-width
 * panel so the content never reflows while collapsing.
 */
export function FilterSidebar({
  open,
  clearable,
  onClear,
  widthClass = "w-[240px]",
  children,
}: {
  open: boolean
  /** Show the Clear button (filters are active). */
  clearable: boolean
  onClear: () => void
  widthClass?: string
  children: ReactNode
}) {
  return (
    <aside
      className={cn(
        "shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
        open ? widthClass : "w-0",
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-y-auto border-l border-border bg-card transition-opacity duration-200",
          widthClass,
          open ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SlidersHorizontal className="size-3.5" /> Filters
          </span>
          {clearable && (
            <button
              type="button"
              onClick={onClear}
              className="text-meta text-primary hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        {children}
      </div>
    </aside>
  )
}
