"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ProfilesListApiResponse } from "@/app/api/profiles/route"
import type { ProfileDetailApiResponse } from "@/app/api/profiles/[profileId]/route"
import { ProfileDetailSheet } from "@/components/profiles/profile-detail-sheet"
import { ProfilesList } from "@/components/profiles/profiles-list"
import { Skeleton } from "@/components/ui/skeleton"
import { withOrgId } from "@/lib/api/client"
import { Loader2 } from "lucide-react"

export default function ProfilesTab() {
  const [listData, setListData] = useState<ProfilesListApiResponse | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  // The drawer's open state is derived from detailData, so a refetch that
  // resolves after it closed would reopen it. Read the live selection to drop
  // those late results.
  const selectedIdRef = useRef<string | null>(null)
  const [detailData, setDetailData] = useState<ProfileDetailApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const loadProfiles = useCallback(async (signal?: AbortSignal, options?: { silent?: boolean }) => {
    try {
      const res = await fetch(withOrgId("/api/profiles"), { signal, cache: "no-store" })
      if (res.status === 403) {
        setAccessDenied(true)
        return
      }
      if (!res.ok) throw new Error("Failed to load profiles.")
      setListData(await res.json() as ProfilesListApiResponse)
      setError(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setError("Unable to load candidate profiles.")
    } finally {
      if (!signal?.aborted && !options?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    async function loadInitial() {
      await loadProfiles(ctrl.signal)
    }
    loadInitial()
    return () => ctrl.abort()
  }, [loadProfiles])

  const fetchDetail = useCallback(async (profileId: string): Promise<ProfileDetailApiResponse> => {
    const res = await fetch(withOrgId(`/api/profiles/${encodeURIComponent(profileId)}`), { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to load profile.")
    return res.json()
  }, [])

  const selectProfile = async (profileId: string) => {
    selectedIdRef.current = profileId
    setSelectedProfileId(profileId)
    setDetailData(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const detail = await fetchDetail(profileId)
      if (selectedIdRef.current !== profileId) return
      setDetailData(detail)
    } catch {
      if (selectedIdRef.current === profileId) setDetailError("Unable to load the selected profile.")
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshAfterMutation = async () => {
    const profileId = selectedProfileId
    if (!profileId) {
      await loadProfiles(undefined, { silent: true })
      return
    }
    const [, detailResult] = await Promise.allSettled([
      loadProfiles(undefined, { silent: true }),
      fetchDetail(profileId),
    ])
    if (selectedIdRef.current !== profileId) return
    if (detailResult.status === "fulfilled") {
      setDetailData(detailResult.value)
      setDetailError(null)
    } else {
      setDetailError("Unable to refresh profile.")
    }
  }

  const closeDetail = () => {
    selectedIdRef.current = null
    setSelectedProfileId(null)
    setDetailData(null)
    setDetailError(null)
  }

  if (loading) {
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

  if (error || !listData) {
    return (
      <div className="p-8">
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error ?? "Unable to load profiles."}
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
        onSelectProfile={selectProfile}
        onProfileCreated={async (profileId) => {
          setLoading(true)
          await loadProfiles()
          await selectProfile(profileId)
        }}
      />

      {/* Loading overlay */}
      {detailLoading && selectedProfileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/20">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm shadow-lg">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading profile…
          </div>
        </div>
      )}

      {/* Detail error toast */}
      {detailError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-md border border-destructive/30 bg-background px-4 py-3 text-sm text-destructive shadow-lg">
          {detailError}
        </div>
      )}

      {/* Detail sheet */}
      <ProfileDetailSheet
        open={detailData !== null}
        profile={detailData?.profile ?? null}
        seniorityLevels={listData?.seniorityLevels ?? []}
        assignableUsers={listData?.assignableUsers ?? []}
        cvs={detailData?.cvs ?? []}
        canManage={listData?.canManage ?? false}
        onClose={closeDetail}
        onChanged={refreshAfterMutation}
      />
    </>
  )
}
