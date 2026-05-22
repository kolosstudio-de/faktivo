/**
 * Bank-Transaktion → Rechnung / expense_entry / income_entry Matching.
 *
 * Strategie (in der Reihenfolge):
 *   1. Eingang (positiv) → invoice payment match:
 *        a) Verwendungszweck enthält Rechnungsnummer (z.B. "RE-2026-0001")
 *        b) Betrag stimmt mit invoice.total_cents - paid_cents überein
 *        c) Optional: counterparty_iban matcht client.iban (falls hinterlegt)
 *   2. Eingang ohne Match → income_entry-Vorschlag
 *   3. Ausgang (negativ) → expense_entry-Vorschlag mit Kategorisierung
 *      via creditor_name (Aral → kfz, Telekom → telefon, ...)
 *
 * Output: nur Vorschläge — Anwender muss bestätigen.
 */

import type { Invoice } from "@/types/database.types"

export interface MatchableTransaction {
  amount_cents: number
  remittance_info: string | null
  counterparty_name: string | null
  counterparty_iban: string | null
  booking_date: string
}

export interface InvoiceMatchCandidate {
  invoice_id: string
  number: string | null
  outstanding_cents: number
  client_iban?: string | null
}

export interface MatchResult {
  type: "invoice_payment" | "income_suggestion" | "expense_suggestion"
  confidence: number // 0..1
  invoice_id?: string
  category_hint?: string
  reasoning: string[]
}

const NUMBER_REGEX = /\b(?:RE|Q|IN|INV|RECH(?:NUNG)?)[ -]?(\d{4})[ -]?(\d{3,5})\b/i

/** Extract Rechnungsnummer from Verwendungszweck. */
export function extractInvoiceNumber(text: string | null): string | null {
  if (!text) return null
  const m = text.match(NUMBER_REGEX)
  if (!m) return null
  return `${m[0].split(/[ -]/)[0].toUpperCase()}-${m[1]}-${m[2].padStart(4, "0")}`
}

// ─── Vendor → Category map (DE-typische Geschäfte) ─────────────────────────

const VENDOR_CATEGORIES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /aral|shell|esso|jet|tankstelle|total|hem|orlen|raiffeisen tank/i, category: "kfz" },
  { pattern: /telekom|vodafone|o2|telefonica|fritz|magenta|congstar|aldi talk/i, category: "telefon" },
  { pattern: /1&1|ionos|hetzner|aws|netlify|vercel|cloudflare|hosting/i, category: "internet" },
  { pattern: /mcdonald|kfc|burger king|nordsee|subway|starbucks|tim hort|pizza|sushi|asia/i, category: "essen-bewirtung" },
  { pattern: /dpd|dhl|hermes|gls|ups|fedex|deutsche post/i, category: "porto" },
  { pattern: /rewe|edeka|aldi|lidl|netto|penny|kaufland/i, category: "andere" }, // Privat-Hint
  { pattern: /github|gitlab|jetbrains|adobe|figma|notion|slack|asana|trello|microsoft 365|google workspace|claude\.ai|anthropic|openai/i, category: "software" },
  { pattern: /linkedin ads|google ads|meta ads|facebook ads|tiktok ads|x.*ads|amazon ads/i, category: "marketing" },
  { pattern: /vodafone vor|kabel deutschland|deutsche glasfaser|1und1|1&1|easybell/i, category: "internet" },
  { pattern: /vattenfall|eon|enbw|stadtwerke|naturstrom|lichtblick|tibber|octopus/i, category: "strom" },
  { pattern: /dkb|n26|sparkasse|deutsche bank|commerzbank|hypovereinsbank|targobank|comdirect|consorsbank|ing-diba|postbank/i, category: "bank" },
  { pattern: /coworking|wework|mindspace|impacthub|design offices/i, category: "miete" },
  { pattern: /udemy|coursera|edx|linkedin learning|masterclass|skillshare|seminar/i, category: "fortbildung" },
  { pattern: /büro|office|staples|conrad|reichelt|amazon business/i, category: "buero" },
]

export function categorizeFromVendor(name: string | null): string | null {
  if (!name) return null
  for (const { pattern, category } of VENDOR_CATEGORIES) {
    if (pattern.test(name)) return category
  }
  return null
}

// ─── Main matching ────────────────────────────────────────────────────────

export function matchTransaction(
  tx: MatchableTransaction,
  invoiceCandidates: InvoiceMatchCandidate[]
): MatchResult {
  const isIncoming = tx.amount_cents > 0
  const reasoning: string[] = []

  if (isIncoming) {
    // 1a. Match by extracted invoice number in Verwendungszweck
    const extractedNumber = extractInvoiceNumber(tx.remittance_info)
    if (extractedNumber) {
      reasoning.push(`Rechnungsnummer ${extractedNumber} im Verwendungszweck`)
      const byNumber = invoiceCandidates.find((c) => c.number === extractedNumber)
      if (byNumber) {
        const amountMatches =
          Math.abs(byNumber.outstanding_cents - tx.amount_cents) <= 100
        return {
          type: "invoice_payment",
          confidence: amountMatches ? 0.98 : 0.7,
          invoice_id: byNumber.invoice_id,
          reasoning: [
            ...reasoning,
            amountMatches
              ? "Betrag stimmt überein (≤ 1 € Toleranz)"
              : `Betrag weicht ab (${byNumber.outstanding_cents} vs ${tx.amount_cents})`,
          ],
        }
      }
    }

    // 1b. Match by exact amount + open invoice (most-recent issued)
    const sameAmount = invoiceCandidates.filter(
      (c) => c.outstanding_cents === tx.amount_cents
    )
    if (sameAmount.length === 1) {
      const candidate = sameAmount[0]
      reasoning.push("Eindeutiger Betrag-Match auf offene Rechnung")
      // IBAN bonus
      if (
        tx.counterparty_iban &&
        candidate.client_iban &&
        normalizeIban(tx.counterparty_iban) === normalizeIban(candidate.client_iban)
      ) {
        reasoning.push("Gegenpartei-IBAN matcht hinterlegte Kunden-IBAN")
        return {
          type: "invoice_payment",
          confidence: 0.95,
          invoice_id: candidate.invoice_id,
          reasoning,
        }
      }
      return {
        type: "invoice_payment",
        confidence: 0.75,
        invoice_id: candidate.invoice_id,
        reasoning,
      }
    }

    // 2. Income suggestion (no invoice matched)
    return {
      type: "income_suggestion",
      confidence: 0.5,
      reasoning: ["Eingang ohne Rechnungs-Match → Vorschlag: sonstige Einnahme"],
    }
  }

  // 3. Outgoing → expense suggestion
  const cat = categorizeFromVendor(tx.counterparty_name)
  return {
    type: "expense_suggestion",
    confidence: cat ? 0.7 : 0.4,
    category_hint: cat ?? undefined,
    reasoning: [
      cat
        ? `Vendor "${tx.counterparty_name}" → Kategorie "${cat}"`
        : "Ausgang ohne Vendor-Match → Kategorie manuell wählen",
    ],
  }
}

function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase()
}

/**
 * Hilfsfunktion: outstanding_cents = total_cents − paid_cents (>=0).
 */
export function outstandingFromInvoice(inv: Invoice): number {
  return Math.max(0, inv.total_cents - inv.paid_cents)
}
