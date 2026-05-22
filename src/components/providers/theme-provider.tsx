"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "theme"

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

/**
 * ThemeProvider — sehr bewusst NICHT mit useSyncExternalStore +
 * dispatchEvent("storage"), weil das storage-Event in derselben Tab
 * gar nicht feuert. Stattdessen plain React-State + Side-Effects:
 *
 *   1. Initial state = "system" (server-safe)
 *   2. Nach mount: Stored-Wert aus localStorage übernehmen
 *   3. <html> bekommt class="dark" wenn resolvedTheme="dark"
 *   4. Bei "system": auf prefers-color-scheme-Änderung reagieren
 *
 * Damit kein Hydration-Mismatch entsteht, lesen wir localStorage erst
 * NACH dem Mount (initial = "system"). Das kann zu einem Flash führen —
 * akzeptiert für die Einfachheit. Optional könnte ein Inline-Script im
 * <head> die Klasse vor Hydration setzen.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light",
  )

  // 1. Initial sync from localStorage after mount
  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored)
    }
  }, [])

  // 2. Recompute resolvedTheme whenever theme or system pref changes
  React.useEffect(() => {
    if (typeof window === "undefined") return

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const update = () => setResolvedTheme(mq.matches ? "dark" : "light")
      update()
      mq.addEventListener("change", update)
      return () => mq.removeEventListener("change", update)
    }
    setResolvedTheme(theme)
  }, [theme])

  // 3. Apply class to <html>
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // private mode / disabled storage — ignorierbar
    }
  }, [])

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}

/**
 * Inline-Script, das vor Hydration die richtige Klasse setzt — verhindert
 * White-Flash beim Laden. Im RootLayout in <head> einfügen:
 *   <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
 */
export const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem("${STORAGE_KEY}") || "system";
    var d = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (d) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`
// keep getSystemPreference exported for tests / SSR utilities
export { getSystemPreference }
