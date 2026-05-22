/**
 * DATEV EXTF 700 Buchungsstapel generator.
 *
 * Official spec: "DATEV-Format 7.0 Buchungsstapel (EXTF)".
 * This implements the essential fields for small businesses:
 * invoices (revenue), payments (bank), expenses.
 *
 * Output is semicolon-separated CSV (DATEV convention), German locale
 * (comma as decimal separator, DMY date), quoted text fields, ISO-8859-15
 * encoding recommended — we emit UTF-8 and the Kanzlei can re-encode in Excel.
 */

import { format } from "date-fns"

import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
  LineItem,
  Payment,
  Settings,
} from "@/types/database.types"

/** SKR03 default account lookup (very small sample). */
const SKR03_ACCOUNTS = {
  bank: "1200",
  kasse: "1000",
  erloese_19: "8400",
  erloese_7: "8300",
  erloese_steuerfrei_19: "8195", // Kleinunternehmer §19
  erloese_reverse: "8336", // innerg. Leistung reverse charge
  forderungen: "1400",
  wareneinkauf: "3400",
  buero: "4930",
  telefon: "4920",
  werbung: "4610",
  reise: "4660",
  beratung: "4955",
  sonstiges: "4900",
} as const

function deNumber(cents: number): string {
  // DATEV wants positive decimal with comma, sign via S/H column
  return (Math.abs(cents) / 100).toFixed(2).replace(".", ",")
}

function datevDate(isoDate: string): string {
  // DDMMYYYY (but actually DATEV uses DDMM only for Belegdatum; year is in header).
  // We emit DDMM — most imports accept.
  const [y, m, d] = isoDate.split("-")
  return `${d}${m}${y}`
}

function quote(s: string | null | undefined): string {
  if (!s) return '""'
  return `"${s.replace(/"/g, '""')}"`
}

interface Booking {
  umsatz: number // cents
  sh: "S" | "H"
  konto: string
  gegenkonto: string
  buschluessel?: string
  belegdatum: string // ISO YYYY-MM-DD
  belegnr: string
  text: string
}

function bookingRow(b: Booking): string {
  // Column order per DATEV Buchungsstapel v7.0 (first 14 essential):
  // 1 Umsatz (ohne S/H)
  // 2 Soll/Haben
  // 3 WKZ Umsatz
  // 4 Kurs
  // 5 Basis-Umsatz
  // 6 WKZ Basis-Umsatz
  // 7 Konto
  // 8 Gegenkonto (ohne BU-Schlüssel)
  // 9 BU-Schlüssel
  // 10 Belegdatum
  // 11 Belegfeld 1 (Belegnummer)
  // 12 Belegfeld 2
  // 13 Skonto
  // 14 Buchungstext
  const cols = [
    deNumber(b.umsatz),
    b.sh,
    "EUR",
    "",
    "",
    "",
    b.konto,
    b.gegenkonto,
    b.buschluessel ?? "",
    datevDate(b.belegdatum),
    quote(b.belegnr),
    "",
    "",
    quote(b.text),
  ]
  return cols.join(";")
}

export interface DatevExportInput {
  settings: Settings
  invoices: Invoice[]
  /**
   * Line items grouped by parent invoice id. Wird genutzt um Rechnungen mit
   * mehreren USt-Sätzen (z.B. 19 % + 7 %) korrekt zu splitten — Steuerberater
   * können sonst nicht zwischen Erlösen 19 % (SKR 8400) und 7 % (SKR 8300)
   * unterscheiden.
   */
  lineItemsByInvoice?: Record<string, LineItem[]>
  payments: (Payment & { invoice?: { number: string | null } | null })[]
  expenses: (ExpenseEntry & { category?: Category | null })[]
  extraIncome: (IncomeEntry & { category?: Category | null })[]
  from: string // ISO
  to: string
  mandantennummer?: string
  beraternummer?: string
}

/**
 * Liefert das Erlös-Konto + den DATEV-Buchungsschlüssel (BU) für den
 * gegebenen USt-Satz. Buchungsschlüssel sind DATEV-Standard:
 *   "3" = 19 % USt, "2" = 7 % USt, "8" = steuerfrei (innerg. Reverse Charge),
 *   ""  = ohne automatische USt-Berechnung (für Klein­unternehmer).
 */
function resolveRevenueAccount(
  vatRate: number,
  isKleinunternehmer: boolean,
  reverseCharge: boolean,
): { konto: string; bu: string } {
  if (isKleinunternehmer) {
    return { konto: SKR03_ACCOUNTS.erloese_steuerfrei_19, bu: "" }
  }
  if (reverseCharge) {
    return { konto: SKR03_ACCOUNTS.erloese_reverse, bu: "8" }
  }
  if (vatRate === 0) {
    return { konto: SKR03_ACCOUNTS.erloese_steuerfrei_19, bu: "" }
  }
  if (vatRate >= 6.5 && vatRate <= 7.5) {
    return { konto: SKR03_ACCOUNTS.erloese_7, bu: "2" }
  }
  // Default to 19 % bucket (covers 18.5..19.5 nominal)
  return { konto: SKR03_ACCOUNTS.erloese_19, bu: "3" }
}

/**
 * Gruppiert Lineitems nach USt-Satz und summiert Brutto (subtotal + vat) per
 * Bucket. So bekommen wir eine Buchungszeile je Steuersatz.
 */
function groupLineTotalsByVatRate(
  lines: LineItem[],
): Array<{ vatRate: number; grossCents: number }> {
  const buckets = new Map<number, number>()
  for (const line of lines) {
    // VAT-Rate als 1-Nachkommastellen-Schlüssel — vermeidet 19 vs 19.00 vs 18.999
    const key = Math.round(Number(line.vat_rate) * 10) / 10
    const gross =
      Number(line.line_subtotal_cents) + Number(line.line_vat_cents)
    buckets.set(key, (buckets.get(key) ?? 0) + gross)
  }
  return [...buckets.entries()]
    .map(([vatRate, grossCents]) => ({ vatRate, grossCents }))
    .sort((a, b) => b.vatRate - a.vatRate) // höchster Satz zuerst (Konvention)
}

export function generateExtf700(input: DatevExportInput): string {
  const {
    settings,
    invoices,
    payments,
    expenses,
    extraIncome,
    from,
    to,
    mandantennummer = "1",
    beraternummer = "0",
  } = input

  const yearFrom = new Date(from).getFullYear()
  const headerDate = format(new Date(), "yyyyMMddHHmmss")

  // Line 1: format header (EXTF spec)
  const h = [
    '"EXTF"',
    "700", // version
    "21", // format (Buchungsstapel=21)
    '"Buchungsstapel"',
    "9", // FormatDaten (9 = current buchungsstapel)
    headerDate,
    "", // Imported On
    '""', // Herkunft
    `"${(settings.company_name ?? "Kolos").replace(/"/g, "")}"`, // Exportiert von
    '"Kolos Digital Finanzen"', // ImportierteDaten-by
    beraternummer,
    mandantennummer,
    `${yearFrom}0101`, // WJ-Beginn
    "4", // Sachkontonummer-Länge
    `${from.replace(/-/g, "")}`, // Datum-Anfang
    `${to.replace(/-/g, "")}`, // Datum-Ende
    '""', // Bezeichnung
    '""', // Diktatkürzel
    "1", // Buchungstyp (1=Finanzbuchführung)
    "0", // Rechnungslegungszweck
    "0", // Festschreibung
    '"EUR"',
    "", // Derivatskennzeichen
    "", // SKR
    "", // Branchenlösung
    "",
    "",
    "",
    "",
    "",
  ].join(";")

  // Line 2: column header row (DATEV-fixed)
  const cols = [
    "Umsatz (ohne Soll/Haben-Kz)",
    "Soll/Haben-Kennzeichen",
    "WKZ Umsatz",
    "Kurs",
    "Basis-Umsatz",
    "WKZ Basis-Umsatz",
    "Konto",
    "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel",
    "Belegdatum",
    "Belegfeld 1",
    "Belegfeld 2",
    "Skonto",
    "Buchungstext",
  ]
    .map((c) => `"${c}"`)
    .join(";")

  const bookings: string[] = []

  // Invoices — revenue booking, split per VAT-Satz wenn Lineitems vorliegen
  for (const inv of invoices) {
    if (!inv.number || inv.locked_at === null) continue
    if (inv.total_cents === 0) continue

    const lines = input.lineItemsByInvoice?.[inv.id] ?? []
    const buckets = lines.length > 0 ? groupLineTotalsByVatRate(lines) : []

    // Bei Kleinunternehmer / Reverse-Charge gibt es nur einen Bucket — auch
    // dann normalisieren wir auf "ein vatRate=0/nominal", damit der Pfad
    // unten konsistent ist.
    if (
      inv.is_kleinunternehmer_at_issue ||
      inv.reverse_charge ||
      buckets.length === 0
    ) {
      // Fallback: ein Buchungssatz fürs ganze Brutto (alte Verhalten).
      const { konto, bu } = resolveRevenueAccount(
        // VAT-Rate aus erstem Line falls vorhanden, sonst 19 als Default
        lines[0]?.vat_rate ?? 19,
        inv.is_kleinunternehmer_at_issue,
        inv.reverse_charge,
      )
      const sh: "S" | "H" = inv.total_cents >= 0 ? "H" : "S"
      bookings.push(
        bookingRow({
          umsatz: inv.total_cents,
          sh,
          konto: SKR03_ACCOUNTS.forderungen,
          gegenkonto: konto,
          buschluessel: bu,
          belegdatum: inv.issue_date,
          belegnr: inv.number,
          text: `Rechnung ${inv.number}`,
        }),
      )
      continue
    }

    // Echtes Splitting per USt-Satz. Ein Buchungssatz je Bucket.
    // Rundungsdrift: wir kumulieren die ersten N-1 Buckets, der letzte
    // bekommt den Rest (= inv.total_cents - sum_others), damit am Ende
    // die Forderungssumme exakt aufgeht.
    const sortedBuckets = buckets
    let running = 0
    for (let i = 0; i < sortedBuckets.length; i++) {
      const bucket = sortedBuckets[i]
      const isLast = i === sortedBuckets.length - 1
      const gross = isLast ? inv.total_cents - running : bucket.grossCents
      running += gross
      if (gross === 0) continue

      const { konto, bu } = resolveRevenueAccount(
        bucket.vatRate,
        false,
        false,
      )
      const sh: "S" | "H" = gross >= 0 ? "H" : "S"
      const suffix =
        sortedBuckets.length > 1
          ? ` (${bucket.vatRate.toFixed(0)} % USt)`
          : ""
      bookings.push(
        bookingRow({
          umsatz: gross,
          sh,
          konto: SKR03_ACCOUNTS.forderungen,
          gegenkonto: konto,
          buschluessel: bu,
          belegdatum: inv.issue_date,
          belegnr: inv.number,
          text: `Rechnung ${inv.number}${suffix}`,
        }),
      )
    }
  }

  // Payments — bank receipt
  for (const p of payments) {
    bookings.push(
      bookingRow({
        umsatz: p.amount_cents,
        sh: "H",
        konto: p.method === "cash" ? SKR03_ACCOUNTS.kasse : SKR03_ACCOUNTS.bank,
        gegenkonto: SKR03_ACCOUNTS.forderungen,
        belegdatum: p.paid_at,
        belegnr: p.invoice?.number ?? p.reference ?? "",
        text: `Zahlung ${p.invoice?.number ?? ""}`.trim(),
      })
    )
  }

  // Expenses
  for (const e of expenses) {
    if (!e.is_deductible) continue
    const accountFromCategory =
      e.category?.skr_code ??
      (e.vat_rate > 0 ? SKR03_ACCOUNTS.sonstiges : SKR03_ACCOUNTS.sonstiges)
    bookings.push(
      bookingRow({
        umsatz: e.amount_cents,
        sh: "S",
        konto: accountFromCategory,
        gegenkonto: SKR03_ACCOUNTS.bank,
        buschluessel: e.vat_rate > 0 ? "9" : "",
        belegdatum: e.occurred_on,
        belegnr: e.id.slice(0, 8),
        text:
          `${e.vendor ?? ""} ${e.description ?? ""}`.trim().slice(0, 60) ||
          "Betriebsausgabe",
      })
    )
  }

  // Extra manual income
  for (const inc of extraIncome) {
    if (inc.scope !== "business") continue
    bookings.push(
      bookingRow({
        umsatz: inc.amount_cents,
        sh: "H",
        konto: SKR03_ACCOUNTS.bank,
        gegenkonto: inc.category?.skr_code ?? SKR03_ACCOUNTS.erloese_steuerfrei_19,
        belegdatum: inc.occurred_on,
        belegnr: inc.id.slice(0, 8),
        text:
          `${inc.source ?? ""} ${inc.description ?? ""}`.trim().slice(0, 60) ||
          "Einnahme",
      })
    )
  }

  return [h, cols, ...bookings].join("\n") + "\n"
}
