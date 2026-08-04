import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between mb-6 shrink-0",
        className
      )}
    >
      <div>
        <h1 className="text-[22px] font-bold text-[var(--fg)] m-0">{title}</h1>
        <p className="text-xs text-[var(--muted-fg)] mt-0.5 mb-0">{subtitle}</p>
      </div>
      {actions && (
        <div className="flex gap-2.5 flex-wrap items-center">{actions}</div>
      )}
    </div>
  )
}
