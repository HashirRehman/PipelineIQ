import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function TintedBadge({
  color,
  children,
  className,
  bordered = true,
}: {
  color: string
  children: ReactNode
  className?: string
  bordered?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-2 py-0.5 rounded text-[11px] font-semibold font-mono h-auto",
        className
      )}
      style={{
        background: color + "18",
        color,
        border: bordered ? `1px solid ${color}30` : "1px solid transparent",
      }}
    >
      {children}
    </Badge>
  )
}
