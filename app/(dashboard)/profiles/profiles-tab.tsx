"use client"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProfilesListApiResponse } from "@/app/api/profiles/route"
import type { ProfileDetailApiResponse } from "@/app/api/profiles/[profileId]/route"
import { ProfileDetailSheet } from "@/components/profiles/profile-detail-sheet"
import { ProfilesList } from "@/components/profiles/profiles-list"
import { Skeleton } from "@/components/ui/skeleton"
import { cvParseState } from "@/components/profiles/profile-cv-details"
import { ApiError, apiGet } from "@/lib/api/client"
import { queryKeys } from "@/lib/api/query-keys"

// A freshly uploaded CV is parsed in the background, and nothing pushes the
// result to the browser.
const PARSE_POLL_INTERVAL_MS = 3000

export default function ProfilesTab() {
  const queryClient = useQueryClient()
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: queryKeys.profiles.list(),
    queryFn: ({ signal }) => apiGet<ProfilesListApiResponse>("/api/profiles", signal),
  })

  const detail = useQuery({
    queryKey: queryKeys.profiles.detail(selectedProfileId ?? "none"),
    queryFn: ({ signal }) =>
      apiGet<ProfileDetailApiResponse>(
        `/api/profiles/${encodeURIComponent(selectedProfileId!)}`,
        signal,
      ),
    enabled: selectedProfileId !== null,
    refetchInterval: (query) =>
      query.state.data?.cvs.some((cv) => cvParseState(cv) === "parsing")
        ? PARSE_POLL_INTERVAL_MS
        : false,
  })

  const listData = list.data
  const detailData = selectedProfileId ? detail.data : undefined

  // 403 = role may not see profiles; a real answer, not a failure.
  const accessDenied = list.error instanceof ApiError && list.error.status === 403

  const refreshAfterMutation = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all() })

  if (list.isPending) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
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

  if (accessDenied) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="text-sm font-semibold text-foreground mb-1.5">Access denied</div>
          <div className="text-xs text-muted-foreground">
            Only administrators and BD managers can view and manage profiles.
          </div>
        </div>
      </div>
    )
  }

  if (list.error || !listData) {
    return (
      <div className="p-8">
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Unable to load candidate profiles.
        </div>
      </div>
    )
  }

  return (
    <>
      <ProfilesList
        profiles={listData.profiles}
        canManage={listData.canManage}
        seniorityLevels={listData.seniorityLevels}
        onSelectProfile={setSelectedProfileId}
        onProfileCreated={async (profileId) => {
          await refreshAfterMutation()
          setSelectedProfileId(profileId)
        }}
      />

      {selectedProfileId && detail.error && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-md border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-lg">
          Unable to load the selected profile.
        </div>
      )}

      {/* Opens on click; the drawer shows a skeleton while the detail query
          is in flight. If the first load fails the drawer stays closed and
          the error toast shows instead — same as before the skeleton. */}
      <ProfileDetailSheet
        open={selectedProfileId != null && !(detail.error && !detailData)}
        profile={detailData?.profile ?? null}
        seniorityLevels={listData.seniorityLevels}
        assignableUsers={listData.assignableUsers}
        cvs={detailData?.cvs ?? []}
        canManage={listData.canManage}
        onClose={() => setSelectedProfileId(null)}
        onChanged={refreshAfterMutation}
      />
    </>
  )
}
