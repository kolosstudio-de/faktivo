import { getRequestConfig } from "next-intl/server"

import { applyZodLocale } from "@/lib/i18n/zod-locale"
import type { Locale } from "./locale"
import { routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !(routing.locales as readonly string[]).includes(locale)) {
    locale = routing.defaultLocale
  }

  // Zod-Fehlermeldungen pro Request lokalisieren. So zeigt das Validator-
  // Schema in DE "Ungültige E-Mail-Adresse" statt englischer Defaults an.
  applyZodLocale(locale as Locale)

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
