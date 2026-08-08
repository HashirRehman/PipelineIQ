"use client"

import { useEffect } from "react"

import {
  applyPalette,
  getStoredPaletteId,
  STORAGE_KEY,
} from "@/lib/theme/palettes"

/**
 * Applies the user's saved theme palette on app load and keeps it in sync
 * across tabs (storage events). Renders nothing — mount once in the root
 * layout inside the ThemeProvider.
 */
export function PaletteApplier() {
  useEffect(() => {
    applyPalette(getStoredPaletteId())

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) applyPalette(getStoredPaletteId())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return null
}
