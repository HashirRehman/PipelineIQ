import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function TintedBadge({
  color,
  children,
  className,
}: {
  color: string
  children: ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-2 py-0.5 rounded text-[11px] font-medium h-auto whitespace-nowrap",
        className,
      )}
      style={{
        background: color + "14",
        color,
        borderColor: color + "30",
      }}
    >
      {children}
    </Badge>
  )
}
