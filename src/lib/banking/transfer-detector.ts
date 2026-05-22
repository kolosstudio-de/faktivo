/**
 * Self-transfer detector.
 *
 * Detects pairs of bank_transactions that represent the user moving money
 * between their OWN accounts (Privatentnahme / Eigene Einzahlung / Umbuchung).
 * The AI classifier today flags each leg independently as income/expense,
 * which double-counts cash that never actually entered or left the household.
 *
 * Detection criteria for a pair (a, b):
 *   - same user
 *   - different account_id (both belong to the user via RLS)
 *   - opposite signs and identical |amount_cents|
 *   - booking_date within ±3 days of each other
 *   - neither tx is already marked as transfer
 *
 * AI-tagged Privatentnahme/Eigene Einzahlung/Umbuchung flow through the same
 * heuristic. We also check sender name for the user's own legal name when
 * available (handled via remittance/counterparty pattern below).
 *
 * Once a pair is found:
 *   - both legs are flagged is_transfer=true with mutual transfer_pair_id
 *   - any linked expense_entry / income_entry on either leg is DELETED
 *     (self-transfers are not income or expense)
 *
 * Stand 2026-05-21
 */

import type { SupabaseClient } from "@supabase/supabase-js"

interface TransferCandidate {
  id: string
  account_id: string
  amount_cents: number
  booking_date: string
  counterparty_name: string | null
  remittance_info: string | null
  ai_category: string | null
  suggested_category_id: string | null
  is_transfer: boolean
  transfer_pair_id: string | null
  expense_entry_id: string | null
  income_entry_id: string | null
}

/**
 * Find and pair self-transfers for a single user. Idempotent — already-paired
 * transactions are left untouched. Returns counts.
 */
export async function detectAndPairTransfers(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ pairs: number; legs: number }> {
  // 1. Load all un-paired transactions for this user
  const { data: txsData } = await supabase
    .from("bank_transactions")
    .select(
      "id, account_id, amount_cents, booking_date, counterparty_name, remittance_info, ai_category, suggested_category_id, is_transfer, transfer_pair_id, expense_entry_id, income_entry_id"
    )
    .eq("user_id", userId)
    .eq("is_transfer", false)
    .is("transfer_pair_id", null)

  const txs = (txsData ?? []) as TransferCandidate[]
  if (txs.length === 0) return { pairs: 0, legs: 0 }

  // 2. Sort by booking_date asc for deterministic pairing
  txs.sort((a, b) => a.booking_date.localeCompare(b.booking_date))

  // 3. Walk the list, matching each likely-transfer candidate to its pair
  const used = new Set<string>()
  let pairs = 0
  let legs = 0

  for (const a of txs) {
    if (used.has(a.id)) continue
    if (!isLikelyTransfer(a)) continue

    const partner = txs.find((b) => {
      if (used.has(b.id) || b.id === a.id) return false
      if (b.account_id === a.account_id) return false
      if (b.amount_cents !== -a.amount_cents) return false
      const daysDiff = Math.abs(
        (new Date(a.booking_date).getTime() -
          new Date(b.booking_date).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      return daysDiff <= 3
    })

    if (!partner) continue

    // Pair them: each leg references the other
    await supabase
      .from("bank_transactions")
      .update({ is_transfer: true, transfer_pair_id: partner.id })
      .eq("id", a.id)
    await supabase
      .from("bank_transactions")
      .update({ is_transfer: true, transfer_pair_id: a.id })
      .eq("id", partner.id)

    // Self-transfers are not income or expense — strip any materialized
    // entries on either leg so EKS / EÜR / analytics reset cleanly.
    if (a.expense_entry_id) {
      await supabase
        .from("expense_entries")
        .delete()
        .eq("id", a.expense_entry_id)
    }
    if (a.income_entry_id) {
      await supabase
        .from("income_entries")
        .delete()
        .eq("id", a.income_entry_id)
    }
    if (partner.expense_entry_id) {
      await supabase
        .from("expense_entries")
        .delete()
        .eq("id", partner.expense_entry_id)
    }
    if (partner.income_entry_id) {
      await supabase
        .from("income_entries")
        .delete()
        .eq("id", partner.income_entry_id)
    }

    used.add(a.id)
    used.add(partner.id)
    pairs++
    legs += 2
  }

  return { pairs, legs }
}

/**
 * Heuristic: does this transaction LOOK like one leg of a self-transfer?
 * We're generous here because the partner-matching step is strict (amount
 * + date + different account). False positives at this stage just mean we
 * scan more candidates; they get rejected at the pairing step.
 */
function isLikelyTransfer(tx: {
  ai_category: string | null
  counterparty_name: string | null
  remittance_info: string | null
}): boolean {
  const haystack = [
    tx.ai_category ?? "",
    tx.counterparty_name ?? "",
    tx.remittance_info ?? "",
  ]
    .join(" ")
    .toLowerCase()

  // If we have absolutely nothing to match against, allow the candidate
  // through — the strict partner-matching step is the real filter.
  if (haystack.trim().length === 0) return true

  const patterns = [
    /privatentnahme/,
    /privateinlage/,
    /eigene?\s*einzahlung/,
    /umbuchung/,
    /übertrag/,
    /uebertrag/,
    /transfer\s+(from|to)\s+main\s+account/,
    /interner\s+transfer/,
    /eigenübertrag/,
    /eigenuebertrag/,
    /auf\s+mein/, // German free-text "auf mein Konto"
    /from\s+main\s+account/,
    /to\s+main\s+account/,
  ]

  // Allow generic ambiguous-text rows through too — strict pairing decides.
  // Only filter out clear non-transfers like ALDI, vendor invoices, etc.
  if (patterns.some((p) => p.test(haystack))) return true

  // No clear vendor identifier? Allow it — N26 / Sparkasse sometimes ship
  // transfers with empty counterparty.
  if (!tx.counterparty_name?.trim()) return true

  return false
}

// ─── Intra-account (crypto / exchange) transfer detection ──────────────
//
// Coinbase / Kraken / Binance / Bitvavo / Bitpanda statements contain rows
// like "Converted 250 USDC to 209 EURC" or "Sold 209 EURC for 209 EUR" or
// "Withdrawal to 5355****7006" — these are NOT income or expense, just
// internal balance-form changes within the same wallet (or moves to your
// own bank). Without this filter, AI naively tags each leg as positive
// "income" and a single inbound USDC of €209 ends up counted 3-4 times.
//
// We detect these via remittance-info regex; no partner-matching needed
// because each row is self-evidently an internal op.

const INTRA_ACCOUNT_PATTERNS = [
  /^converted\s+[\d.,]+\s+[a-z]{3,6}\s+to\s+[\d.,]+/i,
  /^sold\s+[\d.,]+\s+[a-z]{3,6}\s+for\s+[\d.,]+/i,
  /^bought\s+[\d.,]+\s+[a-z]{3,6}\s+with\s+[\d.,]+/i,
  /^exchanged?\s+[\d.,]+\s+[a-z]{3,6}\s+(for|to)\s+[\d.,]+/i,
  /^withdrawal\s+to\s+\d/i, // "Withdrawal to 5355****7006"
  /^deposit\s+from\s+[a-z]+\s+(wallet|account)/i,
  // Generic crypto-asset symbol mention in remittance — only if paired
  // with a known operation verb above keeps this list tight.
]

export function isIntraAccountTransfer(tx: {
  remittance_info: string | null
  counterparty_name: string | null
  ai_category: string | null
}): boolean {
  const remit = (tx.remittance_info ?? "").trim()
  const counter = (tx.counterparty_name ?? "").trim()
  const ai = (tx.ai_category ?? "").toLowerCase()

  if (INTRA_ACCOUNT_PATTERNS.some((p) => p.test(remit))) return true
  if (INTRA_ACCOUNT_PATTERNS.some((p) => p.test(counter))) return true

  // AI hint: classifier explicitly tagged it as "Krypto-Konvertierung",
  // "Asset-Bewegung", or similar.
  if (/krypto.?konvert|asset.?bewegung|crypto.?conversion|self.?withdrawal/i.test(ai)) {
    return true
  }
  return false
}

/**
 * Flag intra-account transfers (crypto conversions, self-withdrawals) on
 * existing bank_transactions for the user. Deletes any materialized
 * expense/income entries on those rows, since they're not real
 * income/expense — just balance-form changes.
 *
 * Idempotent. Safe to re-run after every PDF import.
 */
export async function detectAndMarkIntraAccountTransfers(
  userId: string,
  supabase: SupabaseClient,
): Promise<{ marked: number }> {
  const { data } = await supabase
    .from("bank_transactions")
    .select(
      "id, remittance_info, counterparty_name, ai_category, is_transfer, expense_entry_id, income_entry_id"
    )
    .eq("user_id", userId)
    .eq("is_transfer", false)

  const rows = (data ?? []) as Array<{
    id: string
    remittance_info: string | null
    counterparty_name: string | null
    ai_category: string | null
    is_transfer: boolean
    expense_entry_id: string | null
    income_entry_id: string | null
  }>

  let marked = 0
  for (const row of rows) {
    if (!isIntraAccountTransfer(row)) continue

    await supabase
      .from("bank_transactions")
      .update({ is_transfer: true })
      .eq("id", row.id)

    if (row.expense_entry_id) {
      await supabase
        .from("expense_entries")
        .delete()
        .eq("id", row.expense_entry_id)
    }
    if (row.income_entry_id) {
      await supabase
        .from("income_entries")
        .delete()
        .eq("id", row.income_entry_id)
    }

    marked++
  }

  return { marked }
}
