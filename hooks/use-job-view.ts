"use client";

import { usePersistedView, type ViewMode } from "./use-persisted-view";

export type JobView = ViewMode;

// Shared by the Pipeline and Discovery pages — list is the default view. The
// choice persists in localStorage (`pipelineiq.jobs.view`) and is shared
// between the two pages.
export function useJobView() {
  return usePersistedView("jobs");
}
