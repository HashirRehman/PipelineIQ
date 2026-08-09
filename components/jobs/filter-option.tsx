import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function FilterOption({
  active,
  onClick,
  children,
  dot,
  disabled = false,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  dot?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 w-full rounded px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer",
        disabled && "opacity-40 cursor-not-allowed",
        active
          ? "bg-primary/10 font-semibold text-primary"
          : "text-foreground",
        !disabled && !active && "hover:bg-accent",
      )}
    >
      {dot && <span className="size-1.5 rounded-full shrink-0" style={{ background: dot }} />}
      {children}
    </button>
  )
}
