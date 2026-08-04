import { cn } from "@/lib/utils"

const GRADIENTS = [
  "#06b6d4,#6366f1",
  "#10b981,#06b6d4",
  "#f59e0b,#ef4444",
  "#6366f1,#ec4899",
  "#06b6d4,#10b981",
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
  const idx = name.charCodeAt(0) % GRADIENTS.length
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-full shrink-0 flex items-center justify-center font-bold text-white select-none",
        className
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${GRADIENTS[idx]})`,
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}
