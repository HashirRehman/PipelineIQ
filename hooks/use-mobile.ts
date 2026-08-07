"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}

// Same subscription pattern as use-mounted.ts: useSyncExternalStore renders
// the server snapshot during SSR/hydration (false) and the live media-query
// snapshot on the client — no setState call inside an effect, so it doesn't
// trip the React Compiler's cascading-render warning.
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => false,
  );
}
