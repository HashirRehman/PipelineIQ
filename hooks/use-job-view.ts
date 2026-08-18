"use client";

import { usePersistedView, type ViewMode } from "./use-persisted-view";

export type JobView = ViewMode;

// Shared by the Pipeline and Discovery pages — list is always the default
// view; the toggle switches it for the current page session.
export function useJobView() {
  return usePersistedView("jobs");
}
