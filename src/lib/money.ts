/**
 * Money helpers — integer cents (never floats).
 *
 * All invoice math happens in cents. Display happens in EUR via Intl.
 * German rounding: half-up (kaufmännisch) per line, then sum — matches §14 UStG guidance.
 */

export type Cents = number

export const ZERO: Cents = 0

/**
 * Convert user input (string like "12,34" or "12.34") to cents.
 * Accepts German comma or English dot decimal separator.
 * Accepts thousand separators ("1.234,56" DE or "1,234.56" EN).
 */
export function parseCents(input: string | number | null | undefined): Cents {
  if (input == null || input === "") return 0
  if (typeof input === "number") return roundHalfUp(input * 100)

  const s = String(input).trim()
  if (!s) return 0

  // Detect locale from which separator comes LAST — that's the decimal one.
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  let normalized: string

  if (lastComma === -1 && lastDot === -1) {
    normalized = s
  } else if (lastComma > lastDot) {
    // DE: "1.234,56" → "1234.56"
    normalized = s.replace(/\./g, "").replace(",", ".")
  } else {
    // EN: "1,234.56" → "1234.56"
    normalized = s.replace(/,/g, "")
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return 0
  return roundHalfUp(n * 100)
}

/** Convert cents → decimal euros (e.g. 12345 → 123.45). */
export function centsToEur(cents: Cents): number {
  return cents / 100
}

/**
 * German commercial rounding: half-up for positive values, half-down for negatives
 * (i.e. always away from zero on exact halves). Matches HGB / §14 UStG practice.
 */
export function roundHalfUp(value: number): number {
  if (value < 0) return -Math.round(-value)
  return Math.round(value)
}

/**
 * Format cents as German currency string: "1.234,56 €".
 * Pass a different locale to override.
 */
export function formatMoney(
  cents: Cents,
  opts: { locale?: string; currency?: string } = {}
): string {
  const { locale = "de-DE", currency = "EUR" } = opts
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Format as plain decimal string without currency — useful inside forms.
 */
export function formatAmount(
  cents: Cents,
  opts: { locale?: string } = {}
): string {
  const { locale = "de-DE" } = opts
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Compute a single line's subtotal / VAT / total in cents.
 *
 * Formula (§14 UStG compliant):
 *   gross_unit      = unit_price_cents
 *   line_before_disc = quantity * gross_unit (treated as NET — add VAT on top)
 *   line_net        = line_before_disc * (1 - discount_pct/100)
 *   line_vat        = line_net * vat_rate/100
 *   line_total      = line_net + line_vat
 *
 * Rounding: per line (half-up).
 */
export interface LineTotals {
  lineSubtotalCents: Cents
  lineVatCents: Cents
  lineTotalCents: Cents
}

export function computeLineTotals(params: {
  quantity: number
  unitPriceCents: Cents
  vatRatePct: number
  discountPct?: number
}): LineTotals {
  const { quantity, unitPriceCents, vatRatePct, discountPct = 0 } = params

  const qty = Number.isFinite(quantity) ? quantity : 0
  const disc = Number.isFinite(discountPct) ? discountPct : 0
  const rate = Number.isFinite(vatRatePct) ? vatRatePct : 0

  const gross = qty * unitPriceCents
  const afterDiscount = gross * (1 - disc / 100)
  const net = roundHalfUp(afterDiscount)
  const vat = roundHalfUp(net * (rate / 100))
  const total = net + vat

  return {
    lineSubtotalCents: net,
    lineVatCents: vat,
    lineTotalCents: total,
  }
}

/**
 * Sum line totals into document totals.
 * When `isKleinunternehmer = true`, vat is forced to 0 regardless of per-line rates
 * (§19 UStG — no VAT is charged or shown). The document still stores the rate=0 snapshot.
 */
export interface DocumentTotals {
  subtotalCents: Cents
  vatCents: Cents
  totalCents: Cents
}

export function sumDocumentTotals(
  lines: LineTotals[],
  opts: { isKleinunternehmer?: boolean } = {}
): DocumentTotals {
  let subtotal = 0
  let vat = 0
  let total = 0

  for (const line of lines) {
    subtotal += line.lineSubtotalCents
    vat += line.lineVatCents
    total += line.lineTotalCents
  }

  if (opts.isKleinunternehmer) {
    // §19 — no VAT shown; total equals net
    return { subtotalCents: subtotal, vatCents: 0, totalCents: subtotal }
  }

  return { subtotalCents: subtotal, vatCents: vat, totalCents: total }
}

/**
 * Group lines by VAT rate and return per-rate nets and VAT amounts — required by
 * §14 UStG when multiple rates apply on a single invoice.
 */
export function vatBreakdown(
  lines: Array<{ vat_rate: number; line_subtotal_cents: Cents; line_vat_cents: Cents }>
): Array<{ rate: number; netCents: Cents; vatCents: Cents }> {
  const map = new Map<number, { netCents: Cents; vatCents: Cents }>()
  for (const l of lines) {
    const key = l.vat_rate
    const curr = map.get(key) ?? { netCents: 0, vatCents: 0 }
    curr.netCents += l.line_subtotal_cents
    curr.vatCents += l.line_vat_cents
    map.set(key, curr)
  }
  return [...map.entries()]
    .map(([rate, v]) => ({ rate, ...v }))
    .sort((a, b) => a.rate - b.rate)
}
