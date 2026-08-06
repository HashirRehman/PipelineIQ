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
  LEAD_STATUS_BG,
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
  return (
    <Select
      value={value}
      onValueChange={v => onChange((v as LeadStatus | null) ?? "Applied")}
    >
      <SelectTrigger
        size="sm"
        className="h-auto w-auto px-2 py-0.75 rounded-md text-[11px] font-semibold cursor-pointer font-mono border whitespace-nowrap"
        style={{
          background: LEAD_STATUS_BG[value],
          borderColor: `${LEAD_STATUS_COLOR[value]}40`,
          color: LEAD_STATUS_COLOR[value],
        }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUSES.map(s => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
