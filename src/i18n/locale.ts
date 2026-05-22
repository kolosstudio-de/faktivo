export const locales = ["de", "en", "ru", "uk"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "de"

export const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  ru: "Русский",
  uk: "Українська",
}

/**
 * Compact label für den Sprach-Switcher. Wir verzichten bewusst auf Flaggen —
 * russische Sprache mit russischer Fahne ist für ukrainische Nutzer:innen
 * problematisch, und umgekehrt. Reine Buchstaben sind neutral.
 */
export const localeShort: Record<Locale, string> = {
  de: "DE",
  en: "EN",
  ru: "РУ",
  uk: "УК",
}
