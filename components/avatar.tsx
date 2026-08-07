import { cn } from "@/lib/utils"

// Neutral palette — 5 muted tones that don't compete with status colors
const COLORS = [
  "#475569", // slate
  "#4b5563", // cool grey
  "#6b7280", // grey
  "#374151", // dark grey
  "#1e3a5f", // brand dark blue
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
