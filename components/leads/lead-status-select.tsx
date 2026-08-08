"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LEAD_STATUSES,
  LEAD_STATUS_COLOR,
  type LeadStatus,
} from "@/lib/constants"

export function LeadStatusSelect({
  value,
  onChange,
}: {
  value: LeadStatus
  onChange: (status: LeadStatus) => void
}) {
  const color = LEAD_STATUS_COLOR[value]

  return (
    <Select
      value={value}
      onValueChange={v => onChange(v as LeadStatus)}
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-auto gap-1.5 px-2.5 rounded-md text-xs font-medium cursor-pointer border shadow-none bg-card whitespace-nowrap focus:ring-0"
        style={{
          borderColor: `${color}30`,
          color,
        }}
      >
        {/* Dot */}
        <span
          className="size-[6px] rounded-full shrink-0"
          style={{ background: color }}
        />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="text-item">
        {LEAD_STATUSES.map(s => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span
                className="size-[6px] rounded-full shrink-0"
                style={{ background: LEAD_STATUS_COLOR[s] }}
              />
              {s}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
