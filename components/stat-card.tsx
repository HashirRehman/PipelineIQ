import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  sub,
  color,
  valueClassName,
  labelClassName,
  className,
}: {
  label: string
  value: ReactNode
  sub?: string
  color?: string
  valueClassName?: string
  labelClassName?: string
  className?: string
}) {
  return (
    <Card
      className={cn(
        "py-4.5 px-5 gap-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-none ring-0",
        className
      )}
    >
      <CardContent className="p-0">
        <div
          className={cn(
            "font-mono text-[26px] font-bold mb-0.5",
            valueClassName
          )}
          style={{ color }}
        >
          {value}
        </div>
        <div className={cn("text-xs font-medium text-[var(--fg)] mb-0.5", labelClassName)}>
          {label}
        </div>
        {sub && (
          <div className="text-[11px] text-[var(--muted-fg)]">{sub}</div>
        )}
      </CardContent>
    </Card>
  )
}
