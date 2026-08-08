import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: React.ReactNode
  sub?: string
  color?: string
  className?: string
  valueClassName?: string
  labelClassName?: string
}

export function StatCard({ label, value, sub, color, className, valueClassName, labelClassName }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-background p-4 flex flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        {color && (
          <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
        )}
        <span className={cn("text-xs text-muted-foreground font-medium", labelClassName)}>{label}</span>
      </div>
      <div className={cn("text-2xl font-semibold text-foreground tabular-nums", valueClassName)}>{value}</div>
      {sub && <div className="text-meta text-muted-foreground">{sub}</div>}
    </div>
  )
}
