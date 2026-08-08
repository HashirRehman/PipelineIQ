"use client"

import { useEffect } from "react"

import {
  applyPattern,
  getStoredPatternId,
  STORAGE_KEY,
} from "@/lib/theme/patterns"

/**
 * Applies the user's saved background pattern on app load and keeps it in
 * sync across tabs (storage events). Renders nothing — mount once in the
 * root layout inside the ThemeProvider.
 */
export function PatternApplier() {
  useEffect(() => {
    applyPattern(getStoredPatternId())

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) applyPattern(getStoredPatternId())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return null
}
