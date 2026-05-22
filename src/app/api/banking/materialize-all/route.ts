/**
 * POST /api/banking/materialize-all
 *
 * Backfill helper: takes all *raw* bank_transactions for the current user
 * (rows that are not linked to a payment / expense_entry / income_entry and
 * not dismissed) and materializes them into expense_entries / income_entries
 * using the AI- or rule-based suggestions stored on the row.
 *
 * Without this endpoint, transactions imported before the auto-materialize
 * commit-step landed remain "raw" forever and never reach Cash Flow / EÜR /
 * EKS.
 *
 * Returns:
 *   { ok: true, materialized: N, skipped: M }
 *
 * Bürgergeld rows still go to income_entries with jobcenter_relevant=false
 * (social aid is never EKS-relevant — § 11b SGB II).
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import type { BankTransaction, Category } from "@/types/database.types"

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

  // Pull all raw rows for this user.
  // NB: `is_transfer=false` excludes self-transfer pairs — they are not
  // income or expense (see /api/banking/detect-transfers and § 11b SGB II).
  const { data: rawTxs, error: txErr } = await supabase
    .from("bank_transactions")
    .select(
      "id, user_id, account_id, booking_date, amount_cents, currency, counterparty_name, remittance_info, is_business, suggested_category_id, suggested_scope, suggestion_source, is_buergergeld, expense_entry_id, income_entry_id, payment_id, dismissed_at"
    )
    .eq("user_id", user.id)
    .eq("is_transfer", false)
    .is("expense_entry_id", null)
    .is("income_entry_id", null)
    .is("payment_id", null)
    .is("dismissed_at", null)

  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }
  const txs = (rawTxs ?? []) as Array<
    Pick<
      BankTransaction,
      | "id"
      | "user_id"
      | "account_id"
      | "booking_date"
      | "amount_cents"
      | "currency"
      | "counterparty_name"
      | "remittance_info"
      | "is_business"
      | "suggested_category_id"
      | "suggested_scope"
      | "suggestion_source"
      | "is_buergergeld"
    >
  >

  if (txs.length === 0) {
    return NextResponse.json({ ok: true, materialized: 0, skipped: 0 })
  }

  // Pre-load categories so we can pick fallbacks without one query per tx.
  const { data: cats } = await supabase
    .from("categories")
    .select("id, scope, kind, name, is_jobcenter_relevant")
    .eq("user_id", user.id)
  const categories = (cats ?? []) as Array<
    Pick<Category, "id" | "scope" | "kind" | "name" | "is_jobcenter_relevant">
  >

  function pickFallbackCategory(
    scope: "business" | "personal",
    kind: "income" | "expense"
  ): { id: string; is_jobcenter_relevant: boolean } | null {
    // Preferred fallback names by (scope, kind).
    const preferredNames: Record<string, string[]> = {
      "business:expense": ["Sonstige Betriebsausgaben", "Sonstiges"],
      "business:income": ["Sonstige betriebliche Erträge", "Sonstiges"],
      "personal:expense": ["Sonstiges"],
      "personal:income": ["Geschenke / Sonstiges", "Sonstiges"],
    }
    const names = preferredNames[`${scope}:${kind}`] ?? ["Sonstiges"]
    for (const name of names) {
      const hit = categories.find(
        (c) => c.scope === scope && c.kind === kind && c.name === name
      )
      if (hit)
        return { id: hit.id, is_jobcenter_relevant: hit.is_jobcenter_relevant }
    }
    // Last-resort: any category of matching scope+kind.
    const any = categories.find((c) => c.scope === scope && c.kind === kind)
    return any
      ? { id: any.id, is_jobcenter_relevant: any.is_jobcenter_relevant }
      : null
  }

  let materialized = 0
  let skipped = 0

  for (const tx of txs) {
    const isCredit = tx.amount_cents > 0
    const kind: "income" | "expense" = isCredit ? "income" : "expense"
    const scope: "business" | "personal" =
      tx.suggested_scope ?? (tx.is_business ? "business" : "personal")

    let categoryId = tx.suggested_category_id ?? null
    let categoryJobcenterRelevant = false

    if (categoryId) {
      const found = categories.find((c) => c.id === categoryId)
      if (found) {
        categoryJobcenterRelevant = found.is_jobcenter_relevant
      }
    } else {
      const fallback = pickFallbackCategory(scope, kind)
      if (!fallback) {
        skipped++
        continue
      }
      categoryId = fallback.id
      categoryJobcenterRelevant = fallback.is_jobcenter_relevant
    }

    const description = (tx.remittance_info ?? "").slice(0, 500)

    if (isCredit) {
      const isBuergergeld = tx.is_buergergeld === true
      const { data: incomeRow, error: incomeErr } = await supabase
        .from("income_entries")
        .insert({
          user_id: user.id,
          scope,
          occurred_on: tx.booking_date,
          amount_cents: Math.abs(tx.amount_cents),
          currency: tx.currency || "EUR",
          category_id: categoryId,
          source: tx.counterparty_name ?? "Bank-Eingang",
          description,
          jobcenter_relevant:
            !isBuergergeld && scope === "business" && categoryJobcenterRelevant,
        })
        .select("id")
        .single()
      if (incomeErr || !incomeRow) {
        skipped++
        continue
      }
      const { error: linkErr } = await supabase
        .from("bank_transactions")
        .update({ income_entry_id: incomeRow.id })
        .eq("id", tx.id)
      if (linkErr) {
        skipped++
        continue
      }
      materialized++
    } else {
      const { data: expRow, error: expErr } = await supabase
        .from("expense_entries")
        .insert({
          user_id: user.id,
          scope,
          occurred_on: tx.booking_date,
          amount_cents: Math.abs(tx.amount_cents),
          currency: tx.currency || "EUR",
          category_id: categoryId,
          vendor: tx.counterparty_name ?? null,
          description,
          is_deductible: scope === "business",
        })
        .select("id")
        .single()
      if (expErr || !expRow) {
        skipped++
        continue
      }
      const { error: linkErr } = await supabase
        .from("bank_transactions")
        .update({ expense_entry_id: expRow.id })
        .eq("id", tx.id)
      if (linkErr) {
        skipped++
        continue
      }
      materialized++
    }
  }

  return NextResponse.json({ ok: true, materialized, skipped })
}
