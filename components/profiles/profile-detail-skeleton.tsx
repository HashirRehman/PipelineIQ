"use client";

import { Skeleton } from "@/components/ui/skeleton";

// Drawer body shown while the profile detail fetch is in flight — mirrors the
// real layout (top bar, left column, Details aside) so the drawer opens
// instantly and the content doesn't resize when the data lands.
export function ProfileDetailSkeleton() {
  return (
    <>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left column */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-card px-8 py-6 space-y-7">
          <section className="space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4" />
          </section>
          <section className="space-y-2.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </section>
          <section className="space-y-2.5">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </section>
        </div>

        {/* Right column — Details */}
        <aside className="w-[280px] shrink-0 border-l border-border bg-page-bg overflow-y-auto px-6 py-6">
          <Skeleton className="h-3 w-14 mb-4" />
          <div className="space-y-5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
