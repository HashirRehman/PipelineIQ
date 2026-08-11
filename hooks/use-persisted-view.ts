"use client";

import { useSyncExternalStore } from "react";

export type ViewMode = "list" | "cards";

// Persisted list/cards preference shared by the list pages (Pipeline,
// Discovery, Profiles). Same localStorage pattern as the sidebar collapse
// flag: same-tab writes dispatch a `pipelineiq:<namespace>-view-changed`
// event so the useSyncExternalStore snapshot refreshes (the storage event
// only fires cross-tab).
//
// List is the default: the server snapshot always returns defaultValue so
// SSR and the first client render agree — the persisted preference is picked
// up synchronously after hydration with no mismatch and no
// setState-in-effect.
export function usePersistedView(
  namespace: string,
  defaultValue: ViewMode = "list",
) {
  const storageKey = `pipelineiq.${namespace}.view`;
  const changedEvent = `pipelineiq:${namespace}-view-changed`;

  const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(changedEvent, callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener(changedEvent, callback);
    };
  };

  const getSnapshot = (): ViewMode =>
    window.localStorage.getItem(storageKey) === "cards" ? "cards" : defaultValue;

  const getServerSnapshot = (): ViewMode => defaultValue;

  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setView = (next: ViewMode) => {
    window.localStorage.setItem(storageKey, next);
    window.dispatchEvent(new Event(changedEvent));
  };

  return [view, setView] as const;
}
