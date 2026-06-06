/**
 * Pure EÜR-Kalkulation (§ 4 Abs. 3 EStG).
 *
 * Hier liegen die Funktionen, die aus Rechnungen / Zusatz-Einnahmen / Ausgaben
 * die Anlage-EÜR-Zeilen berechnen. Bewusst SEPARIERT vom PDF-Renderer
 * (`src/lib/pdf/eur-pdf.tsx`), damit:
 *
 *   1. Unit-Tests die Math gegen die §4-Spec verifizieren können, ohne
 *      einen kompletten PDF-Stream zu mocken (scripts/test-eur.mjs).
 *   2. /api/reports/eur in Zukunft auch JSON liefern kann (für
 *      Steuerberater-Dashboard oder ELSTER-Export), nicht nur PDF.
 *   3. Geschäftsregeln (private_share_pct-Abzug, Storno-Filter,
 *      SKR03→Zeile-Mapping) genau einmal definiert sind, nicht in jedem
 *      Consumer dupliziert.
 *
 * Stand 2026-06-04 — extrahiert aus eur-pdf.tsx (bisher inline).
 */

import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
} from "@/types/database.types"

export interface EurInput {
  year: number
  invoices: Invoice[]
  /** "Zusatz"-Einnahmen außerhalb des Rechnungs-Flows (Bargeld-Job, Erstattungen). */
  extraIncome: IncomeEntry[]
  expenses: (ExpenseEntry & { category?: Category | null })[]
}

export interface EurZeileBucket {
  zeile: number
  label: string
  amountCents: number
}

export interface EurResult {
  year: number
  einnahmenUmsatzCents: number
  einnahmenExtraCents: number
  einnahmenGesamtCents: number
  ausgabenByZeile: EurZeileBucket[]
  ausgabenGesamtCents: number
  gewinnCents: number
}

/**
 * SKR03-Konto → EÜR-Zeile-Mapping (vereinfachte Form für KU/Freiberufler).
 *
 * Die offiziellen EÜR-Zeilen sind 11-99 mit feinster Granularität, das BMF-
 * Formular ändert sich jährlich. Wir mappen auf die wichtigsten Buckets,
 * die der Steuerberater dann auf das aktuelle Formular projezieren kann.
 *
 * Wenn ein SKR-Code nicht erkannt wird, landet die Ausgabe in Z58
 * "Sonstige Betriebsausgaben" — sichere Default-Bucket, kein Datenverlust.
 */
export function mapExpenseToZeile(skr?: string | null): number {
  if (!skr) return 58
  if (skr.startsWith("34")) return 26 // Wareneinkauf → Z26
  if (skr.startsWith("31")) return 27 // Fremdleistungen → Z27
  if (skr.startsWith("41")) return 28 // Personalkosten → Z28
  if (skr.startsWith("42")) return 30 // Raumkosten → Z30
  if (skr.startsWith("43")) return 32 // Versicherungen → Z32
  if (skr.startsWith("45")) return 34 // KFZ → Z34
  if (skr.startsWith("466")) return 36 // Reisekosten → Z36
  if (skr.startsWith("465")) return 37 // Bewirtung → Z37
  if (skr.startsWith("492")) return 39 // Telefon → Z39
  if (skr.startsWith("493")) return 40 // Büromaterial → Z40
  if (skr.startsWith("461")) return 41 // Werbung → Z41
  if (skr.startsWith("495")) return 44 // Beratung → Z44
  if (skr.startsWith("494")) return 45 // Fortbildung → Z45
  if (skr.startsWith("483")) return 48 // Abschreibungen → Z48
  if (skr.startsWith("497")) return 50 // Bankgebühren → Z50
  return 58 // Sonstige Betriebsausgaben
}

/**
 * Labels für die Zeilen, die der Renderer + Tests konsumieren. Nur Deutsch —
 * EÜR ist eine deutsche Steuer-Anlage, die Labels müssen mit dem BMF-Formular
 * matchen, nicht mit der UI-Locale des Users.
 */
export const ZEILE_LABELS: Record<number, string> = {
  26: "Wareneinkauf",
  27: "Fremdleistungen / Subunternehmer",
  28: "Personalkosten (Löhne / Gehälter)",
  30: "Raumkosten",
  32: "Versicherungen",
  34: "KFZ-Kosten (betrieblich)",
  36: "Reisekosten",
  37: "Bewirtungskosten",
  39: "Telefon, Internet, Porto",
  40: "Büromaterial",
  41: "Werbung",
  44: "Rechts- und Steuerberatung",
  45: "Fortbildung",
  48: "Abschreibungen (AfA)",
  50: "Bankgebühren",
  58: "Sonstige Betriebsausgaben",
}

/**
 * Kern-Pipeline. Aus Input-Daten die fertigen EÜR-Aggregate ableiten.
 *
 * Regeln (§ 4 Abs. 3 EStG + GoBD):
 *  - Rechnungen mit Status draft/cancelled werden vom Aufrufer schon gefiltert
 *    (siehe `/api/reports/eur/route.ts`); wir summieren `invoices` 1:1 auf.
 *  - Storno-Rechnungen tragen negative total_cents — die zählen also als
 *    Reduktion der Einnahmen (korrekt per § 17 UStG-Logik).
 *  - Zusatz-Einnahmen werden nur mit scope=business gefiltert; das macht der
 *    Aufrufer vor Übergabe. Wir summieren alles, was reinkommt.
 *  - Ausgaben mit is_deductible=false werden hier rausgefiltert (Privatanteil
 *    100 % → fallen raus).
 *  - private_share_pct (0-100) wird vom Brutto abgezogen, BEVOR gebucht wird —
 *    rounding via Math.round, damit der Cent-Saldo aufgeht.
 */
export function computeEur(input: EurInput): EurResult {
  const { year, invoices, extraIncome, expenses } = input

  const einnahmenUmsatzCents = invoices.reduce(
    (s, i) => s + Number(i.total_cents),
    0,
  )
  const einnahmenExtraCents = extraIncome.reduce(
    (s, e) => s + Number(e.amount_cents),
    0,
  )
  const einnahmenGesamtCents = einnahmenUmsatzCents + einnahmenExtraCents

  // Map (zeile → amount) — fester Insertion-Order, später sortiert
  const byZeile = new Map<number, number>()
  for (const e of expenses) {
    if (!e.is_deductible) continue
    const z = mapExpenseToZeile(e.category?.skr_code)
    const privateShare = Number(e.private_share_pct ?? 0) / 100
    const deductible = Math.round(Number(e.amount_cents) * (1 - privateShare))
    byZeile.set(z, (byZeile.get(z) ?? 0) + deductible)
  }

  const ausgabenByZeile: EurZeileBucket[] = [...byZeile.entries()]
    .map(([zeile, amountCents]) => ({
      zeile,
      label: ZEILE_LABELS[zeile] ?? "Sonstiges",
      amountCents,
    }))
    .sort((a, b) => a.zeile - b.zeile)

  const ausgabenGesamtCents = ausgabenByZeile.reduce(
    (s, v) => s + v.amountCents,
    0,
  )
  const gewinnCents = einnahmenGesamtCents - ausgabenGesamtCents

  return {
    year,
    einnahmenUmsatzCents,
    einnahmenExtraCents,
    einnahmenGesamtCents,
    ausgabenByZeile,
    ausgabenGesamtCents,
    gewinnCents,
  }
}
