"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// Detects whether the component has mounted on the client. Returns false
// during SSR and hydration, then true on the client after mount.
//
// This is the recommended replacement for the
// useEffect(() => setMounted(true), []) mounted-gate: useSyncExternalStore
// renders the server snapshot during hydration (so theme-dependent UI stays
// in sync with the SSR'd HTML — no hydration mismatch) and the client
// snapshot afterwards. No setState call inside an effect, so it doesn't
// trip the React Compiler's cascading-render warning.
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
