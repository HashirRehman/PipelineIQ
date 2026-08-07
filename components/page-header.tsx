import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  subtitle?: string
  actions?: ReactNode
  breadcrumb?: string
  className?: string
}

export function PageHeader({ title, description, subtitle, actions, breadcrumb, className }: PageHeaderProps) {
  const sub = subtitle ?? description
  return (
    <div className={`flex items-start justify-between border-b border-border bg-background px-6 py-4 shrink-0 ${className ?? ""}`}>
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-xs text-muted-foreground mb-0.5">{breadcrumb}</p>
        )}
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
    </div>
  )
}
