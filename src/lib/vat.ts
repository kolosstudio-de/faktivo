/**
 * VAT helpers — §14 / §19 / §13b UStG logic.
 */

/**
 * German standard rates (as of 2026).
 * §12 (1) UStG: 19% Regelsteuersatz.
 * §12 (2) UStG: 7% ermäßigt (food, books, newspapers, hotel stays, art, ...).
 * 0% is used for §19 Kleinunternehmer and for §13b reverse-charge scenarios.
 */
export const VAT_RATES = [0, 7, 19] as const
export type VatRate = (typeof VAT_RATES)[number] | number // keep loose for edge cases

/**
 * §19 UStG notice — updated per Jahressteuergesetz 2024 (in force 2025-01-01).
 * Kleinunternehmer revenue is now §4 steuerfrei (not merely "nicht erhoben").
 * Must appear on every invoice while the flag is on.
 *
 * Localisations beibehalten den expliziten Paragraphenverweis (§ 19 UStG),
 * weil die rechtliche Grundlage deutsch bleibt — übersetzt wird nur der
 * erklärende Satz, damit nicht-deutschsprachige Empfänger den Hinweis
 * verstehen. Vgl. § 14 Abs. 6 UStG i.V.m. UStDV § 33.
 */
export const KLEINUNTERNEHMER_NOTICE_DE =
  "Kein Steuerausweis aufgrund Anwendung der Kleinunternehmerregelung nach § 19 UStG."

export const KLEINUNTERNEHMER_NOTICE_EN =
  "No VAT charged under the small-business rule pursuant to § 19 UStG."

export const KLEINUNTERNEHMER_NOTICE_RU =
  "НДС не выставляется в соответствии с правилом для малого бизнеса § 19 UStG (Германия)."

export const KLEINUNTERNEHMER_NOTICE_UK =
  "ПДВ не нараховується відповідно до правила для малого бізнесу § 19 UStG (Німеччина)."

/**
 * Kurz-Label, das im PDF als eigenständige Zeile über der Positions-Tabelle
 * steht (`document-pdf.tsx:503`). Bewusst kürzer als die vollständige Notiz —
 * das vollständige Statement steht im Notizen-Block am Fuß.
 */
export const KLEINUNTERNEHMER_LABEL_DE = "Kleinunternehmer gem. § 19 UStG"
export const KLEINUNTERNEHMER_LABEL_EN = "Small business per § 19 UStG"
export const KLEINUNTERNEHMER_LABEL_RU = "Малый бизнес согл. § 19 UStG"
export const KLEINUNTERNEHMER_LABEL_UK = "Малий бізнес згідно § 19 UStG"

/**
 * 2025 Kleinunternehmer thresholds (per Jahressteuergesetz 2024, BGBl. I 2024 Nr. 387).
 * Replaces the pre-2025 €22,000 / €50,000.
 */
export const KLEINUNTERNEHMER_THRESHOLD_PRIOR_YEAR_EUR = 25_000
export const KLEINUNTERNEHMER_THRESHOLD_CURRENT_YEAR_EUR = 100_000

/**
 * §13b reverse-charge notice for B2B services where the recipient is liable for VAT
 * (most common: EU B2B services; also construction services inside DE).
 */
export const REVERSE_CHARGE_NOTICE_DE =
  "Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)."

export const REVERSE_CHARGE_NOTICE_EN =
  "VAT liability transferred to the recipient (§ 13b UStG / reverse charge)."

export const REVERSE_CHARGE_NOTICE_RU =
  "Обязанность по уплате НДС возложена на получателя (§ 13b UStG, reverse charge)."

export const REVERSE_CHARGE_NOTICE_UK =
  "Обов'язок зі сплати ПДВ покладено на одержувача (§ 13b UStG, reverse charge)."

export interface VatContext {
  isKleinunternehmer: boolean
  reverseCharge: boolean
  /** Recipient country ISO-2 (DE, AT, ...). */
  recipientCountry?: string
  /** Recipient has a valid USt-IdNr (triggers intra-EU reverse charge for services). */
  recipientHasUstId?: boolean
}

/**
 * Determine the effective VAT rate for a line given its nominal rate + context.
 * Returns the rate that should actually be applied (0 for §19 or reverse-charge).
 */
export function effectiveVatRate(nominal: number, ctx: VatContext): number {
  if (ctx.isKleinunternehmer) return 0
  if (ctx.reverseCharge) return 0
  return nominal
}

/**
 * Sprach-Codes, die wir auf Rechnungen unterstützen. "uk" = ukrainisch.
 * Müssen mit `settings.invoice_language_default` synchron bleiben.
 */
export type InvoiceLocale = "de" | "en" | "ru" | "uk"

/**
 * Defensiver Locale-Normalizer — UI-Locales kommen als Free-Text aus settings
 * oder Query-Params. Alles, was nicht in unserer Liste ist, fällt auf "de"
 * zurück (das ist die juristisch wirksame Sprache).
 */
export function normalizeInvoiceLocale(input: unknown): InvoiceLocale {
  if (typeof input !== "string") return "de"
  const lower = input.toLowerCase().slice(0, 2)
  if (lower === "en" || lower === "ru" || lower === "uk") return lower
  return "de"
}

const KLEIN_NOTICE: Record<InvoiceLocale, string> = {
  de: KLEINUNTERNEHMER_NOTICE_DE,
  en: KLEINUNTERNEHMER_NOTICE_EN,
  ru: KLEINUNTERNEHMER_NOTICE_RU,
  uk: KLEINUNTERNEHMER_NOTICE_UK,
}

const REVERSE_NOTICE: Record<InvoiceLocale, string> = {
  de: REVERSE_CHARGE_NOTICE_DE,
  en: REVERSE_CHARGE_NOTICE_EN,
  ru: REVERSE_CHARGE_NOTICE_RU,
  uk: REVERSE_CHARGE_NOTICE_UK,
}

const KLEIN_LABEL: Record<InvoiceLocale, string> = {
  de: KLEINUNTERNEHMER_LABEL_DE,
  en: KLEINUNTERNEHMER_LABEL_EN,
  ru: KLEINUNTERNEHMER_LABEL_RU,
  uk: KLEINUNTERNEHMER_LABEL_UK,
}

/**
 * Which statutory notices must appear on the invoice footer, given the context.
 */
export function invoiceNotices(
  ctx: VatContext,
  locale: InvoiceLocale = "de"
): string[] {
  const notices: string[] = []
  if (ctx.isKleinunternehmer) notices.push(KLEIN_NOTICE[locale])
  if (ctx.reverseCharge) notices.push(REVERSE_NOTICE[locale])
  return notices
}

/**
 * Kurz-Label "Kleinunternehmer gem. § 19 UStG" in der gewählten Sprache,
 * für die einzeilige Anzeige über der Positions-Tabelle.
 */
export function kleinunternehmerLabel(locale: InvoiceLocale = "de"): string {
  return KLEIN_LABEL[locale]
}

/**
 * Format a VAT rate for display: "19%" or "0%".
 */
export function formatVatRate(rate: number, locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate / 100)
}

/**
 * §14 UStG requires an invoice to carry a unique sequential number, issue date,
 * delivery/service date (Leistungsdatum), full issuer + recipient data,
 * a description of goods/services, quantity + unit price, net per rate, rate + amount
 * of VAT (or a § 19 / § 13b notice in lieu of VAT), and discount/payment terms.
 *
 * This helper checks whether the given values pass the minimum required fields.
 * Returns a list of missing-field keys (empty = OK).
 */
export interface InvoiceValidationInput {
  issuerName?: string | null
  issuerAddressStreet?: string | null
  issuerAddressCity?: string | null
  issuerTaxId?: string | null
  issuerUstId?: string | null
  recipientName?: string | null
  recipientAddressStreet?: string | null
  recipientAddressCity?: string | null
  invoiceNumber?: string | null
  issueDate?: string | null
  deliveryDate?: string | null
  lineCount?: number
  hasVatOrNotice?: boolean
}

export function validateInvoiceFields(
  input: InvoiceValidationInput
): string[] {
  const missing: string[] = []
  if (!input.issuerName?.trim()) missing.push("issuer.name")
  if (!input.issuerAddressStreet?.trim()) missing.push("issuer.street")
  if (!input.issuerAddressCity?.trim()) missing.push("issuer.city")
  if (!input.issuerTaxId?.trim() && !input.issuerUstId?.trim())
    missing.push("issuer.taxId|ustId")
  if (!input.recipientName?.trim()) missing.push("recipient.name")
  if (!input.recipientAddressStreet?.trim()) missing.push("recipient.street")
  if (!input.recipientAddressCity?.trim()) missing.push("recipient.city")
  if (!input.invoiceNumber?.trim()) missing.push("number")
  if (!input.issueDate?.trim()) missing.push("issueDate")
  if (!input.deliveryDate?.trim()) missing.push("deliveryDate")
  if ((input.lineCount ?? 0) < 1) missing.push("lineItems")
  if (!input.hasVatOrNotice) missing.push("vat|§19|§13b notice")
  return missing
}
