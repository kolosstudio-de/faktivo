"use client"

/**
 * Per-user display preferences (client-side only, localStorage-backed).
 *
 * Currently:
 *   - showGermanCategoryLabels: whether to show the original German
 *     category name as a small italic subtitle next to the translated one.
 *     Useful for users who interact with a Steuerberater, DATEV / Anlage EÜR
 *     where German labels are the legal reference.
 *
 * These are intentionally NOT persisted to the database — they're pure UX
 * preferences that should follow the device, not the account. A user might
 * want German labels on their work laptop (alongside Steuerberater) but
 * clean translated labels on their phone.
 */

import * as React from "react"

const STORAGE_KEY = "faktivo:show_german_category_labels"
const DEFAULT_VALUE = true  // German subtitle ON by default (helps cross-ref)

/**
 * Hook returning `[value, setValue]` for the "show German category labels"
 * preference. Reads localStorage on mount; falls back to DEFAULT_VALUE for
 * server-side rendering / first render to avoid hydration mismatches.
 */
export function useShowGermanCategoryLabels(): [boolean, (v: boolean) => void] {
  const [value, setValue] = React.useState<boolean>(DEFAULT_VALUE)

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true" || stored === "false") {
        setValue(stored === "true")
      }
    } catch {
      // localStorage unavailable (SSR / private mode) — keep default
    }
  }, [])

  const setAndPersist = React.useCallback((next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
      // Fire a storage event for other tabs / components listening
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: String(next) }),
      )
    } catch {
      /* ignore */
    }
  }, [])

  // Listen for cross-tab / cross-component changes
  React.useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      if (e.newValue === "true" || e.newValue === "false") {
        setValue(e.newValue === "true")
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }, [])

  return [value, setAndPersist]
}
