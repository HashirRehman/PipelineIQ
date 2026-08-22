import { Loader2 } from "lucide-react"

/**
 * Shown the instant a dashboard route is navigated to, while the page's
 * server-side permission check resolves — bridges that gap so navigation
 * feels immediate instead of frozen. Every dashboard loading.tsx renders
 * this one component, so it applies everywhere at once.
 */
export function RouteLoadingSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Loader2 aria-hidden className="size-6 animate-spin text-primary" />
      <output className="sr-only">Loading…</output>
    </div>
  )
}
