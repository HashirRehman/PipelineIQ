"use client"

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { stageColor } from "@/lib/constants"

/** One pipeline stage — id/name/state come from the database. */
export interface StageOption {
  id: string
  name: string
  state: "active" | "paused" | "closed"
}

export function LeadStatusSelect({
  value,
  stages,
  onChange,
  container,
}: {
  value: string
  /** Ordered pipeline stages from the API — the only source of options. */
  stages: StageOption[]
  onChange: (status: string) => void
  /**
   * Portal the popup inside a containing modal/drawer. Required when this
   * select renders inside a modal dialog — a popup portaled to <body> sits
   * outside the dialog's focus trap, which yanks focus back and blinks the
   * popup shut.
   */
  container?: React.RefObject<HTMLElement | null>
}) {
  const index = stages.findIndex(s => s.name === value)
  const color = index >= 0 ? stageColor(index) : "var(--status-slate)"

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-auto gap-1.5 px-2.5 rounded-md text-xs font-medium cursor-pointer border shadow-none bg-card whitespace-nowrap focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
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
      <SelectContent
        className="text-item"
        container={container}
      >
        {stages.map((s, i) => {
          const dotColor = stageColor(i)
          return (
            <SelectItem key={s.id} value={s.name}>
              <span className="flex items-center gap-2">
                <span
                  className="size-[6px] rounded-full shrink-0"
                  style={{ background: dotColor }}
                />
                {s.name}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
