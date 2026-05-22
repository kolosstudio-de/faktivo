/**
 * WZ 2008 Branche codes — curated subset for freelancers, creatives,
 * IT, media agencies, and typical self-employed roles in DE.
 *
 * `kskRelevant: true` marks Berufe where KSK-Abgabe (5% on payments to
 * these creatives) is triggered per §24 KSVG. Media agencies MUST flag this.
 */

export interface BrancheEntry {
  wz: string
  label: string
  labelRu?: string
  labelUa?: string
  kskRelevant?: boolean
  typicalLegalForm?: "freiberufler" | "einzelunternehmen" | "kuenstler" | "gmbh"
}

export const branchen: BrancheEntry[] = [
  // Werbung & Medien (KSK-relevant)
  { wz: "70.21", label: "PR & Unternehmenskommunikation", labelRu: "PR и коммуникации", labelUa: "PR і комунікації", kskRelevant: true, typicalLegalForm: "freiberufler" },
  { wz: "73.11", label: "Werbeagentur / Marketing", labelRu: "Рекламное агентство", labelUa: "Рекламне агентство", kskRelevant: true, typicalLegalForm: "freiberufler" },
  { wz: "73.12", label: "Werbung · Mediavermarktung", labelRu: "Медиа-маркетинг", labelUa: "Медіа-маркетинг", kskRelevant: true },
  { wz: "74.10.01", label: "Grafik-Design", labelRu: "Графический дизайн", labelUa: "Графічний дизайн", kskRelevant: true, typicalLegalForm: "freiberufler" },
  { wz: "74.10.02", label: "Industrie- & Produktdesign", labelRu: "Промышленный дизайн", labelUa: "Промисловий дизайн", kskRelevant: true },
  { wz: "74.10.03", label: "Mode- & Textildesign", kskRelevant: true },
  { wz: "74.20.1", label: "Fotografie", labelRu: "Фотография", labelUa: "Фотографія", kskRelevant: true, typicalLegalForm: "freiberufler" },
  { wz: "59.11", label: "Film-/Videoproduktion", labelRu: "Видео-продакшн", labelUa: "Відео-продакшн", kskRelevant: true },
  { wz: "59.12", label: "Nachbearbeitung Film/Video", kskRelevant: true },
  { wz: "59.20", label: "Tonstudio / Musikproduktion", kskRelevant: true },
  { wz: "74.30", label: "Übersetzen & Dolmetschen", labelRu: "Переводы", labelUa: "Переклади", kskRelevant: true, typicalLegalForm: "freiberufler" },
  { wz: "90.01", label: "Darstellende Kunst", kskRelevant: true, typicalLegalForm: "kuenstler" },
  { wz: "90.03", label: "Kunstschaffen (Maler, Bildhauer, Autor)", kskRelevant: true, typicalLegalForm: "kuenstler" },
  { wz: "90.04", label: "Kultureinrichtungen", kskRelevant: true },
  { wz: "58.11", label: "Verlagswesen (Bücher)", kskRelevant: true },
  { wz: "58.13", label: "Zeitungen / Zeitschriften", kskRelevant: true },

  // IT / Software
  { wz: "62.01", label: "Software-Entwicklung", labelRu: "Разработка ПО", labelUa: "Розробка ПЗ", typicalLegalForm: "freiberufler" },
  { wz: "62.02", label: "IT-Beratung", labelRu: "IT-консалтинг", labelUa: "IT-консалтинг", typicalLegalForm: "freiberufler" },
  { wz: "62.03", label: "IT-Systembetreuung" },
  { wz: "63.12", label: "Webportale" },
  { wz: "58.21", label: "Verlegen von Computerspielen", kskRelevant: true },

  // Beratung / Coaching
  { wz: "70.22", label: "Unternehmensberatung / Coaching", labelRu: "Бизнес-консалтинг / коучинг", labelUa: "Бізнес-консалтинг / коучинг", typicalLegalForm: "freiberufler" },
  { wz: "85.59", label: "Erwachsenenbildung / Training" },
  { wz: "85.60", label: "Bildungsdienstleistungen" },

  // Handel / E-Commerce
  { wz: "47.91", label: "Online-Versandhandel", labelRu: "Онлайн-магазин", labelUa: "Онлайн-магазин" },
  { wz: "47.71", label: "Einzelhandel Bekleidung" },
  { wz: "47.19", label: "Einzelhandel (sonstige Waren)" },

  // Gastro / Events
  { wz: "56.10", label: "Restaurants / Gastro" },
  { wz: "82.30", label: "Event-Organisation / Messen" },

  // Gesundheit / Wellness
  { wz: "86.90", label: "Gesundheitswesen (Heilpraktiker, Therapeut)", typicalLegalForm: "freiberufler" },
  { wz: "96.04", label: "Körperpflege (Kosmetik, Massage)" },

  // Sonstiges
  { wz: "82.11", label: "Sekretariatsdienste / Assistenz" },
  { wz: "82.99", label: "Sonstige Dienstleistungen" },
  { wz: "other", label: "Anderes (bitte später präzisieren)", labelRu: "Другое", labelUa: "Інше" },
]

export function isKskRelevant(wzCode: string | null | undefined): boolean {
  if (!wzCode) return false
  return branchen.find((b) => b.wz === wzCode)?.kskRelevant ?? false
}
