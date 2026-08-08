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
        "px-2 py-0.5 rounded text-meta font-medium h-auto whitespace-nowrap",
        className,
      )}
      style={{
        // color may be a raw hex or a var(--…) token; color-mix keeps the
        // tint theme-driven either way
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        color,
        borderColor: `color-mix(in srgb, ${color} 19%, transparent)`,
      }}
    >
      {children}
    </Badge>
  )
}
