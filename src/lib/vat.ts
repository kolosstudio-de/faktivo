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
 */
export const KLEINUNTERNEHMER_NOTICE_DE =
  "Kein Steuerausweis aufgrund Anwendung der Kleinunternehmerregelung nach § 19 UStG."

export const KLEINUNTERNEHMER_NOTICE_EN =
  "No VAT charged under the small-business rule pursuant to § 19 UStG."

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
 * Which statutory notices must appear on the invoice footer, given the context.
 */
export function invoiceNotices(
  ctx: VatContext,
  locale: "de" | "en" | "ru" = "de"
): string[] {
  const notices: string[] = []
  if (ctx.isKleinunternehmer) {
    notices.push(
      locale === "en" ? KLEINUNTERNEHMER_NOTICE_EN : KLEINUNTERNEHMER_NOTICE_DE
    )
  }
  if (ctx.reverseCharge) {
    notices.push(
      locale === "en" ? REVERSE_CHARGE_NOTICE_EN : REVERSE_CHARGE_NOTICE_DE
    )
  }
  return notices
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
