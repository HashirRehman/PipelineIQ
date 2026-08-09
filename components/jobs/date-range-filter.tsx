"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DATE_RANGES, type DateRange } from "@/lib/constants"
import { cn } from "@/lib/utils"

/**
 * Shared date-range filter (All time / 24h / 7d / 30d / 12m). Used by the
 * Leads toolbar and the Discovery filter row; backed by the same DATE_RANGES
 * list and server-side parsing as the leads/discovery APIs.
 */
export function DateRangeFilter({
  value,
  onValueChange,
  triggerClassName,
}: {
  value: DateRange
  onValueChange: (value: DateRange) => void
  triggerClassName?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange((v ?? "all") as DateRange)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto min-w-[130px] rounded-md text-xs text-muted-foreground bg-card border border-border shadow-none focus:ring-0",
          triggerClassName,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DATE_RANGES.map((range) => (
          <SelectItem key={range.value} value={range.value} className="text-xs">
            {range.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
