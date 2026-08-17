"use client";

// Every applied (job, profile) pair in scope for the acting user — the
// Dashboard and Statistics tabs aggregate these into application counts.
// Cached under queryKeys.jobs.applications(), which shares the jobs prefix
// with Discovery / Applied Jobs, so applying to (or dismissing) a job
// invalidates the stats alongside the feeds.
import { useQuery } from "@tanstack/react-query";
import type { ApplicationsResponse } from "@/app/api/jobs/applications/route";
import { apiGet } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.jobs.applications(),
    queryFn: ({ signal }) =>
      apiGet<ApplicationsResponse>("/api/jobs/applications", signal),
  });
}
