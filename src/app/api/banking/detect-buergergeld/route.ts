/**
 * POST /api/banking/detect-buergergeld
 *
 * Backfill helper: re-runs the Bürgergeld detector across ALL of the user's
 * bank_transactions and updates `is_buergergeld` accordingly. Also auto-
 * materializes any newly-flagged credits that have no linked income_entry yet,
 * so the EKS Vergleich tab has data to compare against.
 *
 * Why this exists: when the AI mis-classified a Jobcenter credit at import
 * time, or when the user dismissed it before the column was added, the
 * `is_buergergeld` flag stayed false even though the counterparty / reference
 * make the truth obvious. This endpoint fixes that without re-importing PDFs.
 *
 * Returns: { ok: true, flagged: number, materialized: number }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { isBuergergeldCandidate } from "@/lib/banking/transaction-classifier"
import { validateOrigin } from "@/lib/api/csrf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // 1. Find the personal/income "Bürgergeld" category for materialization.
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("scope", "personal")
    .eq("kind", "income")
  const buergergeldCat =
    (cats ?? []).find((c) => /b[üu]rgergeld/i.test(c.name as string)) ?? null

  // 2. Load all of the user's bank_transactions (cap defensively).
  const { data: txs } = await supabase
    .from("bank_transactions")
    .select(
      "id, amount_cents, counterparty_name, remittance_info, booking_date, currency, is_buergergeld, is_transfer, income_entry_id, expense_entry_id, payment_id"
    )
    .eq("user_id", user.id)
    .limit(5000)

  let flagged = 0
  let materialized = 0

  for (const tx of txs ?? []) {
    // Skip self-transfers — they're never Bürgergeld.
    if (tx.is_transfer) continue

    const isCandidate = isBuergergeldCandidate({
      amount_cents: tx.amount_cents,
      counterparty: tx.counterparty_name ?? undefined,
      reference: tx.remittance_info ?? undefined,
    })

    // (a) Flag rows that should be Bürgergeld but aren't.
    if (isCandidate && !tx.is_buergergeld) {
      await supabase
        .from("bank_transactions")
        .update({ is_buergergeld: true })
        .eq("id", tx.id)
      flagged++
    }

    // (b) Materialize any Bürgergeld credit that has no linked entry yet
    //     (only if a Bürgergeld category exists for this user).
    const shouldHaveEntry =
      (isCandidate || tx.is_buergergeld) &&
      tx.amount_cents > 0 &&
      !tx.income_entry_id &&
      !tx.expense_entry_id &&
      !tx.payment_id

    if (shouldHaveEntry && buergergeldCat) {
      const { data: incomeRow } = await supabase
        .from("income_entries")
        .insert({
          user_id: user.id,
          scope: "personal",
          occurred_on: tx.booking_date,
          amount_cents: Math.abs(tx.amount_cents),
          currency: tx.currency || "EUR",
          category_id: buergergeldCat.id,
          source: tx.counterparty_name ?? "Jobcenter",
          description: (tx.remittance_info ?? "").slice(0, 500),
          jobcenter_relevant: false,
        })
        .select("id")
        .single()
      if (incomeRow) {
        await supabase
          .from("bank_transactions")
          .update({ income_entry_id: incomeRow.id })
          .eq("id", tx.id)
        materialized++
      }
    }
  }

  return NextResponse.json({ ok: true, flagged, materialized })
}
