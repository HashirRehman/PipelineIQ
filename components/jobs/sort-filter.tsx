"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SORT_OPTIONS, type SortOption } from "@/lib/constants"
import { cn } from "@/lib/utils"

/**
 * Shared sort filter used by Leads and Discovery. Pass `options` to narrow
 * the list (e.g. leads omits "Relevance"); backed by the same SORT_OPTIONS
 * list and server-side parsing as the leads/discovery APIs.
 */
export function SortFilter({
  value,
  onValueChange,
  options = SORT_OPTIONS,
  triggerClassName,
}: {
  value: SortOption
  onValueChange: (value: SortOption) => void
  options?: readonly (typeof SORT_OPTIONS)[number][]
  triggerClassName?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange((v ?? value) as SortOption)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto min-w-[120px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0",
          triggerClassName,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
