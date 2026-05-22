/**
 * Category-name translation helper.
 *
 * Default categories are seeded in German (e.g., "Lebensmittel",
 * "Miete & Nebenkosten"). For multi-language UI we map the German
 * source name to an i18n key under the "CategoryNames" namespace.
 *
 * If the user creates a custom category, its German source name has no
 * mapping — the function falls back to the raw name.
 */

import type { useTranslations } from "next-intl"

type T = ReturnType<typeof useTranslations<"Banking">>

/**
 * German seed category name → i18n key under "CategoryNames" namespace.
 * Keep in sync with `supabase/migrations/20260424000004_seed_categories.sql`
 * and `supabase/migrations/20260430000001_expand_categories.sql`.
 */
const NAME_TO_KEY: Record<string, string> = {
  // Business income
  "Erlöse Dienstleistungen": "erloeseDienstleistungen",
  "Erlöse Produktverkauf": "erloeseProdukt",
  "Sonstige betriebliche Erträge": "sonstigeErtraege",
  "Zinserträge": "zinsertraege",

  // Business expense
  "Wareneinkauf": "wareneinkauf",
  "Fremdleistungen / Subunternehmer": "fremdleistungen",
  "Personalkosten (Löhne)": "personalkosten",
  "Raumkosten (Miete Büro)": "raumkosten",
  "Versicherungen (Betrieb)": "versicherungenBetrieb",
  "KFZ-Kosten (betrieblich)": "kfzBetrieblich",
  "Reisekosten": "reisekosten",
  "Bewirtung": "bewirtung",
  "Telefon & Internet": "telefonInternet",
  "Büromaterial": "bueromaterial",
  "Software-Abos": "softwareAbos",
  "Werbung & Marketing": "werbungMarketing",
  "Beratungskosten (Steuerberater, Anwalt)": "beratungskosten",
  "Fortbildung": "fortbildung",
  "Abschreibungen (AfA)": "abschreibungen",
  "Zinsen Bankkredit": "zinsenBankkredit",
  "Bankgebühren": "bankgebuehren",
  "Sonstige Betriebsausgaben": "sonstigeBetriebsausgaben",
  "Software-Tools / SaaS-Subscriptions": "saasSubscriptions",
  "Hardware & Geräte": "hardware",
  "Domain & Hosting": "domainHosting",
  "Internet (geschäftlich)": "internetGeschaeftlich",
  "Mobilfunk (geschäftlich)": "mobilfunkGeschaeftlich",
  "Geschäftsessen": "geschaeftsessen",
  "Coworking & Büromiete-flex": "coworking",
  "Werbung Online (Google/Meta Ads)": "werbungOnline",
  "Buchhaltung / Software": "buchhaltungSoftware",

  // Personal income
  "Gehalt / Lohn": "gehalt",
  "Bürgergeld (Jobcenter)": "buergergeld",
  "Wohngeld": "wohngeld",
  "Kindergeld": "kindergeld",
  "Geschenke / Sonstiges": "geschenkeSonstiges",
  "Mieteinnahmen (privat)": "mieteinnahmen",
  "Verkauf privat (eBay etc.)": "verkaufPrivat",

  // Personal expense
  "Miete & Nebenkosten": "miete",
  "Lebensmittel": "lebensmittel",
  "Transport / ÖPNV": "transportOepnv",
  "Versicherungen (privat)": "versicherungenPrivat",
  "Krankenkasse": "krankenkasse",
  "Internet & Handy": "internetHandy",
  "Kleidung": "kleidung",
  "Freizeit & Hobby": "freizeit",
  "Bildung": "bildung",
  "Sonstiges": "sonstiges",
  "Strom & Gas": "stromGas",
  "Wasser & Müll": "wasserMuell",
  "Restaurants & Cafés": "restaurantsCafes",
  "Streaming-Dienste": "streaming",
  "Fitness & Sport": "fitness",
  "Friseur & Beauty": "friseurBeauty",
  "Auto-Tankstelle": "autoTankstelle",
  "Auto-Werkstatt & Reparatur": "autoWerkstatt",
  "KFZ-Versicherung": "kfzVersicherung",
  "KFZ-Steuer": "kfzSteuer",
  "ÖPNV / Bahn / Bus": "oepnv",
  "Apotheke": "apotheke",
  "Arzt & Behandlung": "arzt",
  "Geschenke": "geschenke",
  "Reisen & Urlaub": "reisenUrlaub",
  "Restaurants (Privat)": "restaurantsPrivat",
  "Haustiere": "haustiere",
  "Möbel & Einrichtung": "moebel",
  "Haushaltsartikel": "haushaltsartikel",
  "Spenden": "spenden",
  "Schulgebühren / Kita": "schulgebuehren",
  "Steuerberater (privat)": "steuerberaterPrivat",
}

/**
 * Translate a German seed category name to the current locale via i18n.
 * Falls back to the raw name for user-created custom categories.
 *
 * Usage in client components:
 *   const t = useTranslations("Banking")
 *   const label = translateCategoryName(category.name, t)
 *
 * Note: we use Banking namespace + nested key "CategoryNames.X" so a
 * single useTranslations call suffices.
 */
export function translateCategoryName(germanName: string, t: T): string {
  const key = NAME_TO_KEY[germanName]
  if (!key) return germanName
  // next-intl raw key access — has() check for graceful fallback
  // Banking namespace contains a nested "CategoryNames" object.
  // If the locale file is missing the key, fall back to original.
  try {
    const translated = (t as (k: string) => string)(`CategoryNames.${key}`)
    return translated && translated !== `Banking.CategoryNames.${key}`
      ? translated
      : germanName
  } catch {
    return germanName
  }
}
