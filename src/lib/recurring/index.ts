/**
 * Recurring expenses (Verträge, Abos, Kredite, Mieten).
 *
 * - detectFromTransactions: scannt 90 Tage Bank-Tx und findet wiederkehrende
 *   Muster (3+ Postings same Vendor + same/ähnliche Amount + ~30 Tage Abstand).
 * - postDueRecurrings: erzeugt expense_entries für alle fälligen Recurrings
 *   (Cron 1-mal pro Tag aufrufen).
 * - advanceNextDue: berechnet next_due_date abhängig von frequency.
 */

import type {
  RecurringExpense,
  RecurringFrequency,
  RecurringKind,
} from "@/types/database.types"

export interface DetectedRecurring {
  vendor: string
  amountCents: number
  frequency: RecurringFrequency
  occurrences: number
  firstSeen: string
  lastSeen: string
  /** Confidence 0..1 — wie regelmäßig sind die Postings */
  confidence: number
  scope: "business" | "personal"
  kind: RecurringKind
  matchedTxIds: string[]
}

export interface BankTxLite {
  id: string
  amount_cents: number
  counterparty_name: string | null
  remittance_info: string | null
  booking_date: string
  /** AI scope in DB ist "business" | "private" — wir mappen private → personal */
  ai_scope?: "business" | "private" | null
}

const DAY_MS = 86400 * 1000

/**
 * Naive Erkennung: gruppiere TX nach (vendor, ±5% amount), zähle, schaue Abstand.
 * Liefert Kandidaten ab 2 Vorkommen.
 */
export function detectRecurringPatterns(
  txs: BankTxLite[]
): DetectedRecurring[] {
  // Nur ausgehende (negative) Transaktionen — Eingänge sind nicht Verpflichtungen
  const outgoing = txs.filter((tx) => tx.amount_cents < 0)

  // Group by normalized vendor
  const groups = new Map<string, BankTxLite[]>()
  for (const tx of outgoing) {
    const vendor = normalizeVendor(tx.counterparty_name ?? tx.remittance_info)
    if (!vendor) continue
    if (!groups.has(vendor)) groups.set(vendor, [])
    groups.get(vendor)!.push(tx)
  }

  const candidates: DetectedRecurring[] = []
  for (const [vendor, vendorTxs] of groups) {
    // Sort by date asc
    vendorTxs.sort((a, b) =>
      a.booking_date.localeCompare(b.booking_date)
    )
    if (vendorTxs.length < 2) continue

    // Bucket by amount (within ±10 % to handle Strom-Abschlag fluctuations)
    const buckets = bucketByAmount(vendorTxs)
    for (const bucket of buckets) {
      if (bucket.length < 2) continue

      const intervals: number[] = []
      for (let i = 1; i < bucket.length; i++) {
        const a = new Date(bucket[i - 1].booking_date).getTime()
        const b = new Date(bucket[i].booking_date).getTime()
        intervals.push(Math.round((b - a) / DAY_MS))
      }
      const avgInterval =
        intervals.reduce((a, b) => a + b, 0) / intervals.length
      const variance =
        intervals.reduce((s, i) => s + Math.pow(i - avgInterval, 2), 0) /
        intervals.length
      const stdev = Math.sqrt(variance)

      const frequency = inferFrequency(avgInterval)
      if (!frequency) continue

      // Confidence: hoch wenn stdev klein und ≥ 3 occurrences
      let confidence = Math.min(1, bucket.length / 6) // 6 occurrences = 1.0
      if (stdev < 5) confidence = Math.min(1, confidence + 0.2)
      if (bucket.length >= 3 && stdev < 3) confidence = Math.min(1, confidence + 0.1)

      // Average amount in bucket
      const avgAmount = Math.round(
        bucket.reduce((s, t) => s + Math.abs(t.amount_cents), 0) / bucket.length
      )

      // Scope: prefer ai_scope wenn vorhanden, sonst default personal (sicherer)
      // ai_scope is "business" | "private" in DB → map private → personal
      const aiScopes = bucket
        .map((t) => t.ai_scope)
        .filter((s): s is "business" | "private" => Boolean(s))
      const scopeCount = { business: 0, personal: 0 }
      for (const s of aiScopes) {
        if (s === "business") scopeCount.business++
        else scopeCount.personal++
      }
      const scope: "business" | "personal" =
        scopeCount.business > scopeCount.personal
          ? "business"
          : "personal"

      candidates.push({
        vendor: bucket[0].counterparty_name ?? vendor,
        amountCents: avgAmount,
        frequency,
        occurrences: bucket.length,
        firstSeen: bucket[0].booking_date,
        lastSeen: bucket[bucket.length - 1].booking_date,
        confidence,
        scope,
        kind: inferKind(vendor),
        matchedTxIds: bucket.map((t) => t.id),
      })
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence)
}

function normalizeVendor(s: string | null): string {
  if (!s) return ""
  return s
    .toLowerCase()
    .replace(/[0-9]+/g, "")
    .replace(/[^a-zäöüß ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
}

function bucketByAmount(txs: BankTxLite[]): BankTxLite[][] {
  // Sort by amount desc (abs)
  const sorted = [...txs].sort(
    (a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents)
  )
  const buckets: BankTxLite[][] = []
  for (const tx of sorted) {
    const amt = Math.abs(tx.amount_cents)
    const fit = buckets.find((b) => {
      const bAvg =
        b.reduce((s, t) => s + Math.abs(t.amount_cents), 0) / b.length
      return Math.abs(bAvg - amt) / bAvg < 0.1
    })
    if (fit) fit.push(tx)
    else buckets.push([tx])
  }
  return buckets
}

function inferFrequency(avgIntervalDays: number): RecurringFrequency | null {
  if (avgIntervalDays >= 25 && avgIntervalDays <= 35) return "monthly"
  if (avgIntervalDays >= 85 && avgIntervalDays <= 95) return "quarterly"
  if (avgIntervalDays >= 350 && avgIntervalDays <= 380) return "yearly"
  return null
}

const KIND_PATTERNS: Array<{
  re: RegExp
  kind: RecurringKind
}> = [
  { re: /spotify|netflix|disney|prime video|apple tv|youtube premium|hbo|paramount/i, kind: "subscription" },
  { re: /github|gitlab|adobe|microsoft|google workspace|slack|notion|figma|jetbrains|claude|anthropic|openai/i, kind: "subscription" },
  { re: /miete|rent|wohnung|hausgeld/i, kind: "rent" },
  { re: /vattenfall|eon|enbw|stadtwerke|naturstrom|lichtblick|tibber|octopus|gas|strom/i, kind: "utility" },
  { re: /telekom|vodafone|o2|telefonica|1&1|congstar|aldi talk|fritz|magenta|kabel/i, kind: "utility" },
  { re: /kredit|darlehen|tilgung|raten|finanz|santander|targo|comdirect kredit|deutsche kredit/i, kind: "loan" },
  { re: /versicherung|allianz|huk|axa|signal iduna|gothaer|barmenia|generali|haftpflicht/i, kind: "insurance" },
  { re: /fitnessstudio|fitness|gym|mcfit|fitx|kieser|verein|mitgliedschaft/i, kind: "subscription" },
  { re: /leasing|sixt leasing|alphabet|leaseplan|arval/i, kind: "leasing" },
]

function inferKind(vendorNormalized: string): RecurringKind {
  for (const { re, kind } of KIND_PATTERNS) {
    if (re.test(vendorNormalized)) return kind
  }
  return "other"
}

// ─── Schedule advancement ────────────────────────────────────────────────

export function advanceNextDue(
  current: string,
  frequency: RecurringFrequency
): string {
  const d = new Date(current + "T00:00:00Z")
  if (frequency === "monthly") {
    d.setUTCMonth(d.getUTCMonth() + 1)
  } else if (frequency === "quarterly") {
    d.setUTCMonth(d.getUTCMonth() + 3)
  } else if (frequency === "yearly") {
    d.setUTCFullYear(d.getUTCFullYear() + 1)
  }
  return d.toISOString().slice(0, 10)
}

/**
 * Sucht alle recurrings, deren next_due_date ≤ today und active=true,
 * und gibt sie zurück (Caller erstellt expense_entries).
 */
export function isDue(rec: RecurringExpense, today: string): boolean {
  if (!rec.active) return false
  if (rec.paused_until && rec.paused_until > today) return false
  if (rec.end_date && rec.end_date < today) return false
  return rec.next_due_date <= today
}

// ─── Cash Flow Forecast ──────────────────────────────────────────────────

export interface ForecastInput {
  currentBalanceCents: number
  recurrings: RecurringExpense[]
  /** monthly Bürgergeld income, optional */
  monthlyIncomeCents?: number
  /** known expected income (e.g. open invoices likely to be paid) */
  expectedIncomeCents?: number
  daysAhead: number
}

export interface ForecastResult {
  daysAhead: number
  startBalanceCents: number
  endBalanceCents: number
  totalRecurringExpensesCents: number
  totalExpectedIncomeCents: number
  monthlyRecurringTotalCents: number
  byKind: Record<string, number>
}

export function forecastCashFlow(input: ForecastInput): ForecastResult {
  const today = new Date()
  const horizon = new Date(today.getTime() + input.daysAhead * DAY_MS)

  let totalOutgoing = 0
  const byKind: Record<string, number> = {}
  let monthlyTotal = 0

  for (const rec of input.recurrings) {
    if (!rec.active) continue
    let due = new Date(rec.next_due_date + "T00:00:00Z")
    while (due <= horizon) {
      if (rec.end_date && due > new Date(rec.end_date + "T00:00:00Z")) break
      totalOutgoing += rec.amount_cents
      byKind[rec.kind] = (byKind[rec.kind] ?? 0) + rec.amount_cents
      // Monthly equivalent
      if (rec.frequency === "monthly") monthlyTotal += rec.amount_cents
      else if (rec.frequency === "yearly") monthlyTotal += Math.round(rec.amount_cents / 12)
      else if (rec.frequency === "quarterly") monthlyTotal += Math.round(rec.amount_cents / 3)
      // Advance
      due = new Date(advanceNextDue(due.toISOString().slice(0, 10), rec.frequency) + "T00:00:00Z")
    }
  }
  // Monthly accumulator double-counts because we already accumulate ALL within horizon.
  // Reset and compute monthlyTotal on a per-record basis only once.
  monthlyTotal = 0
  for (const rec of input.recurrings) {
    if (!rec.active) continue
    if (rec.frequency === "monthly") monthlyTotal += rec.amount_cents
    else if (rec.frequency === "yearly") monthlyTotal += Math.round(rec.amount_cents / 12)
    else if (rec.frequency === "quarterly") monthlyTotal += Math.round(rec.amount_cents / 3)
  }

  const monthsAhead = input.daysAhead / 30
  const totalIncome =
    (input.monthlyIncomeCents ?? 0) * monthsAhead +
    (input.expectedIncomeCents ?? 0)

  const endBalance =
    input.currentBalanceCents + Math.round(totalIncome) - totalOutgoing

  return {
    daysAhead: input.daysAhead,
    startBalanceCents: input.currentBalanceCents,
    endBalanceCents: endBalance,
    totalRecurringExpensesCents: totalOutgoing,
    totalExpectedIncomeCents: Math.round(totalIncome),
    monthlyRecurringTotalCents: monthlyTotal,
    byKind,
  }
}
