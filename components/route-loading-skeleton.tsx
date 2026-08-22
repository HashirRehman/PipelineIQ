import { Skeleton } from "@/components/ui/skeleton"

/**
 * Generic placeholder shown the instant a dashboard route is navigated to,
 * while the page's server-side permission check resolves — bridges that gap
 * so navigation feels immediate instead of frozen. Each tab renders its own
 * more detailed skeleton once mounted (e.g. profiles-tab.tsx), so this only
 * needs to fill the content area plausibly, not match every page exactly.
 */
export function RouteLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
