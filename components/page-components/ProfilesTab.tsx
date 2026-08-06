"use client";

import { useCallback, useEffect, useState } from "react";

import type { EngineersListApiResponse } from "@/app/api/engineers/route";
import type { EngineerDetailApiResponse } from "@/app/api/engineers/[engineerId]/route";
import { EngineerDetailSheet } from "@/components/engineers/engineer-detail-sheet";
import { EngineersList } from "@/components/engineers/engineers-list";

export default function ProfilesTab() {
  const [listData, setListData] =
    useState<EngineersListApiResponse | null>(null);

  const [selectedEngineerId, setSelectedEngineerId] =
    useState<string | null>(null);

  const [detailData, setDetailData] =
    useState<EngineerDetailApiResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadEngineers = useCallback(
    async (
      signal?: AbortSignal,
      options?: { silent?: boolean },
    ) => {
      try {
        if (!options?.silent) {
          setLoading(true);
        }

        const response = await fetch("/api/engineers", {
          signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load engineer profiles.");
        }

        const data =
          (await response.json()) as EngineersListApiResponse;

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
          "ProfilesTab: engineers request failed",
          requestError,
        );

        setError("Unable to load engineer profiles.");
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

    loadEngineers(controller.signal);

    return () => controller.abort();
  }, [loadEngineers]);

  const fetchEngineerDetail = useCallback(async (engineerId: string) => {
    const response = await fetch(
      `/api/engineers/${encodeURIComponent(engineerId)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to load engineer profile.");
    }

    return (await response.json()) as EngineerDetailApiResponse;
  }, []);

  const selectEngineer = async (engineerId: string) => {
    setSelectedEngineerId(engineerId);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      setDetailData(await fetchEngineerDetail(engineerId));
    } catch (requestError) {
      console.error(
        "ProfilesTab: engineer detail request failed",
        requestError,
      );

      setDetailError(
        "Unable to load the selected engineer profile.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshAfterMutation = async () => {
    if (!selectedEngineerId) {
      await loadEngineers(undefined, { silent: true });
      return;
    }

    const [, detailResult] = await Promise.allSettled([
      loadEngineers(undefined, { silent: true }),
      fetchEngineerDetail(selectedEngineerId),
    ]);

    if (detailResult.status === "fulfilled") {
      setDetailData(detailResult.value);
      setDetailError(null);
      return;
    }

    console.error(
      "ProfilesTab: engineer detail refresh failed",
      detailResult.reason,
    );

    setDetailError("Unable to refresh the selected engineer profile.");
  };

  const closeEngineerDetail = () => {
    setSelectedEngineerId(null);
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
          {error ?? "Unable to load engineer profiles."}
        </div>
      </div>
    );
  }

  return (
    <>
      <EngineersList
        engineers={listData.engineers}
        isAdmin={listData.isAdmin}
        seniorityLevels={listData.seniorityLevels}
        onSelectEngineer={selectEngineer}
        onEngineerCreated={async (engineerId) => {
          await loadEngineers();
          await selectEngineer(engineerId);
        }}
      />

      {detailLoading && selectedEngineerId && (
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
        <EngineerDetailSheet
          engineer={detailData.engineer}
          seniorityLevels={listData.seniorityLevels}
          assignments={detailData.assignments}
          bdCandidates={detailData.bdCandidates}
          cvs={detailData.cvs}
          isAdmin={listData.isAdmin}
          onClose={closeEngineerDetail}
          onChanged={refreshAfterMutation}
        />
      )}
    </>
  );
}