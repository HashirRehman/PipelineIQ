"use client";

import { useState } from "react";

export type ViewMode = "list" | "cards";

// List/cards view preference for the list pages (Pipeline, Discovery,
// Profiles). List is always the default: previously the choice was persisted
// in localStorage, which let a stored "cards" value override the default on
// every load. Now the app always opens with List selected and the toggle
// only changes the view for the current page session.
//
// `namespace` keeps the old call-site API (`usePersistedView("jobs")`,
// `usePersistedView("profiles")`) intact in case persistence is brought back.
export function usePersistedView(_namespace: string) {
  const [view, setView] = useState<ViewMode>("list");
  return [view, setView] as const;
}
