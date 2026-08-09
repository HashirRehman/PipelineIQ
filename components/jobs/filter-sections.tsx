"use client"

import type { ReactNode } from "react"
import { FilterOption } from "@/components/jobs/filter-option"
import { DATE_RANGES, SORT_OPTIONS, type DateRange, type SortOption } from "@/lib/constants"

/**
 * Shared filter-bar sections used by the Discovery and Applied Jobs sidebars.
 * Backed by the same DATE_RANGES / SORT_OPTIONS lists and server-side parsing
 * as the APIs, so a new option lands everywhere with one edit.
 */

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 pb-4">
      <p className="text-caption font-semibold text-muted-foreground uppercase tracking-widest mb-2">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

export function DateRangeSection({
  value,
  onValueChange,
}: {
  value: DateRange
  onValueChange: (value: DateRange) => void
}) {
  return (
    <FilterSection title="Time">
      {DATE_RANGES.map((range) => (
        <FilterOption
          key={range.value}
          active={value === range.value}
          onClick={() => onValueChange(range.value)}
        >
          {range.label}
        </FilterOption>
      ))}
    </FilterSection>
  )
}

export function SortSection({
  value,
  onValueChange,
  options = SORT_OPTIONS,
}: {
  value: SortOption
  onValueChange: (value: SortOption) => void
  options?: readonly (typeof SORT_OPTIONS)[number][]
}) {
  return (
    <FilterSection title="Sort">
      {options.map((option) => (
        <FilterOption
          key={option.value}
          active={value === option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </FilterOption>
      ))}
    </FilterSection>
  )
}
