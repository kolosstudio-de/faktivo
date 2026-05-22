/**
 * Zod ↔ next-intl Brücke.
 *
 * Zod 4 hat eingebaute Lokalisierung der Fehlermeldungen via `z.config()`.
 * Wir mappen unsere 4 App-Locales (de/en/ru/uk) auf die mitgelieferten
 * Zod-Locales — keine zusätzliche Abhängigkeit nötig.
 *
 * Vorher: Default-Fehler waren immer Englisch ("Invalid email", "Required"),
 * was DE-Erstnutzer*innen verwirrte. Jetzt: "Ungültige E-Mail-Adresse" etc.
 */

import { z } from "zod"
import * as zodLocales from "zod/locales"

import type { Locale } from "@/i18n/locale"

const LOCALE_MAP: Record<Locale, () => { localeError: unknown }> = {
  de: zodLocales.de,
  en: zodLocales.en,
  ru: zodLocales.ru,
  uk: zodLocales.uk,
}

/**
 * Setzt die globale Zod-Locale für die aktuelle Request-Pipeline.
 *
 * Server-Side: kann pro Request aufgerufen werden (z.B. im
 * `setRequestLocale`-Hook oder im `i18n/request.ts`-Config).
 *
 * Client-Side: einmalig pro App-Mount (z.B. im NextIntlClientProvider-Wrap).
 */
export function applyZodLocale(locale: Locale): void {
  const loader = LOCALE_MAP[locale] ?? LOCALE_MAP.de
  const { localeError } = loader() as { localeError: unknown }
  // Cast: $ZodErrorMap ist Zod-intern; der Rückgabewert der locale-Loader
  // ist kompatibel.
  z.config({
    localeError: localeError as NonNullable<
      Parameters<typeof z.config>[0]
    >["localeError"],
  })
}
