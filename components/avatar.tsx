import { cn } from "@/lib/utils"

// Neutral avatar palette — defined as --avatar-1..5 in app/globals.css
// (the single theme source of truth), so avatar colors re-theme with it
const COLORS = [
  "var(--avatar-1)",
  "var(--avatar-2)",
  "var(--avatar-3)",
  "var(--avatar-4)",
  "var(--avatar-5)",
]

export function Avatar({
  name,
  size = 36,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const bg = COLORS[name.charCodeAt(0) % COLORS.length]

  return (
    <div
      aria-hidden
      role="img"
      aria-label={name}
      className={cn(
        "rounded-full shrink-0 flex items-center justify-center font-semibold text-white select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </div>
  )
}
