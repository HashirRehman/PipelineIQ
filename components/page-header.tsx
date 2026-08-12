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
    <div className={`flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-4 shrink-0 ${className ?? ""}`}>
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-caption text-muted-foreground mb-1 font-medium uppercase tracking-wide">
            {breadcrumb}
          </p>
        )}
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h1>
        {sub && (
          <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
    </div>
  )
}
