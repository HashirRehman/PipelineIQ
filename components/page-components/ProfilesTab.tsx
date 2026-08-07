"use client";

import { useCallback, useEffect, useState } from "react";

import type { ProfilesListApiResponse } from "@/app/api/profiles/route";
import type { ProfileDetailApiResponse } from "@/app/api/profiles/[profileId]/route";
import { ProfileDetailSheet } from "@/components/profiles/profile-detail-sheet";
import { ProfilesList } from "@/components/profiles/profiles-list";

export default function ProfilesTab() {
  const [listData, setListData] =
    useState<ProfilesListApiResponse | null>(null);

  const [selectedProfileId, setSelectedProfileId] =
    useState<string | null>(null);

  const [detailData, setDetailData] =
    useState<ProfileDetailApiResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadProfiles = useCallback(
    async (
      signal?: AbortSignal,
      options?: { silent?: boolean },
    ) => {
      try {
        // loading already starts true on mount; callers that want a fresh
        // spinner (e.g. after creating a profile) set it themselves before
        // calling, so no synchronous setState happens inside an effect.
        const response = await fetch("/api/profiles", {
          signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load candidate profiles.");
        }

        const data =
          (await response.json()) as ProfilesListApiResponse;

        setListData(data);
        setError(null);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "ProfilesTab: profiles request failed",
          requestError,
        );

        setError("Unable to load candidate profiles.");
      } finally {
        if (!signal?.aborted && !options?.silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitial() {
      await loadProfiles(controller.signal);
    }
    loadInitial();

    return () => controller.abort();
  }, [loadProfiles]);

  const fetchProfileDetail = useCallback(async (profileId: string) => {
    const response = await fetch(
      `/api/profiles/${encodeURIComponent(profileId)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to load candidate profile.");
    }

    return (await response.json()) as ProfileDetailApiResponse;
  }, []);

  const selectProfile = async (profileId: string) => {
    setSelectedProfileId(profileId);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      setDetailData(await fetchProfileDetail(profileId));
    } catch (requestError) {
      console.error(
        "ProfilesTab: profile detail request failed",
        requestError,
      );

      setDetailError(
        "Unable to load the selected candidate profile.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    if (!selectedProfileId) {
      await loadProfiles(undefined, { silent: true });
      return;
    }

    const [, detailResult] = await Promise.allSettled([
      loadProfiles(undefined, { silent: true }),
      fetchProfileDetail(selectedProfileId),
    ]);

    if (detailResult.status === "fulfilled") {
      setDetailData(detailResult.value);
      setDetailError(null);
      return;
    }

    console.error(
      "ProfilesTab: profile detail refresh failed",
      detailResult.reason,
    );

    setDetailError("Unable to refresh the selected candidate profile.");
  };

  const closeProfileDetail = () => {
    setSelectedProfileId(null);
    setDetailData(null);
    setDetailError(null);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading profiles...
        </div>
      </div>
    );
  }

  if (error || !listData) {
    return (
      <div className="p-7 px-8">
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error ?? "Unable to load candidate profiles."}
        </div>
      </div>
    );
  }

  return (
    <>
      <ProfilesList
        profiles={listData.profiles}
        isAdmin={listData.isAdmin}
        seniorityLevels={listData.seniorityLevels}
        onSelectProfile={selectProfile}
        onProfileCreated={async (profileId) => {
          setLoading(true);
          await loadProfiles();
          await selectProfile(profileId);
        }}
      />

      {detailLoading && selectedProfileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading profile...
          </div>
        </div>
      )}

      {detailError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-md border border-destructive/30 bg-card px-4 py-3 text-sm text-destructive shadow-lg">
          {detailError}
        </div>
      )}

      {detailData && (
        <ProfileDetailSheet
          profile={detailData.profile}
          seniorityLevels={listData.seniorityLevels}
          assignableUsers={listData.assignableUsers}
          cvs={detailData.cvs}
          isAdmin={listData.isAdmin}
          onClose={closeProfileDetail}
          onChanged={refreshAfterMutation}
        />
      )}
    </>
  );
}
