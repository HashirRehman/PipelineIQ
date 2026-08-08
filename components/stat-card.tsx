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
    <div
      className={cn(
        "group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {color && (
          <span className="size-2 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-110" style={{ background: color }} />
        )}
        <span className={cn("text-caption font-medium uppercase tracking-wide text-muted-foreground", labelClassName)}>{label}</span>
      </div>
      <div className={cn("text-2xl font-bold text-foreground tabular-nums tracking-tight leading-none", valueClassName)}>{value}</div>
      {sub && <div className="text-meta text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
