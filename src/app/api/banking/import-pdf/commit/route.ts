/**
 * POST /api/banking/import-pdf/commit
 *
 * Body: JSON
 *   {
 *     bank_name?: string,
 *     account_iban?: string,
 *     transactions: CommitTransaction[]
 *   }
 *
 * Each transaction may carry the user's chosen category + scope plus the
 * `accepted_suggestion` flag — used to learn / reinforce categorization rules.
 *
 * Creates (if missing) a stub bank_connection + bank_account for
 * "manual PDF import" and bulk-inserts the transactions into
 * `bank_transactions` with idempotent external_ids.
 *
 * Returns:
 *   { ok, inserted, duplicates, account_id, rules_upserted }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import type { ParsedTransaction } from "@/lib/banking/pdf-statement-parser"
import {
  detectAndPairTransfers,
  detectAndMarkIntraAccountTransfers,
} from "@/lib/banking/transfer-detector"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface CommitTransaction extends ParsedTransaction {
  category_id?: string | null
  scope?: "business" | "personal"
  accepted_suggestion?: boolean
  suggestion_source?: "rule" | "ai" | "none"
  suggested_category_id?: string | null
  is_buergergeld?: boolean
  source_file?: string
}

interface CommitBody {
  bank_name?: string
  account_iban?: string
  transactions: CommitTransaction[]
}

function makeExternalId(tx: ParsedTransaction): string {
  const ref = (tx.reference ?? tx.description ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 60)
  return `pdf:${tx.occurred_on}:${tx.amount_cents}:${ref}`
}

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

  let body: CommitBody
  try {
    body = (await request.json()) as CommitBody
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
    return NextResponse.json(
      { error: "no_transactions" },
      { status: 400 }
    )
  }

  // ─── 1. Ensure stub bank_connection exists ───────────────────────────
  const STUB_REF = "manual-pdf-import"
  let connectionId: string | null = null
  {
    const { data: existing } = await supabase
      .from("bank_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("reference", STUB_REF)
      .maybeSingle()
    if (existing) {
      connectionId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from("bank_connections")
        .insert({
          user_id: user.id,
          requisition_id: `pdf-${user.id.slice(0, 8)}-${Date.now()}`,
          institution_id: "MANUAL_PDF_IMPORT",
          institution_name: body.bank_name ?? "Manueller PDF-Import",
          status: "linked",
          reference: STUB_REF,
          consented_at: new Date().toISOString(),
        })
        .select("id")
        .single()
      if (error || !created) {
        return NextResponse.json(
          { error: error?.message ?? "could not create connection stub" },
          { status: 500 }
        )
      }
      connectionId = created.id
    }
  }

  // ─── 2. Ensure stub bank_account exists ──────────────────────────────
  // Deduplication strategy:
  //   1. If we have an IBAN → look for existing user account with same IBAN
  //      (regardless of how it was created — TrueLayer, CSV, or another PDF).
  //      Reuse it. This prevents 5× "Sparkasse Regensburg (PDF)" stubs from
  //      a user who imports the same account from 5 monthly PDFs.
  //   2. Else fall back to the legacy account_key lookup.
  const cleanIban = (body.account_iban ?? "").replace(/\s+/g, "").toUpperCase()
  const accountKey = `manual-pdf-${cleanIban || "default"}`
  let accountId: string | null = null
  {
    // 2a. Try IBAN-based dedup first.
    if (cleanIban) {
      const { data: byIban } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("iban", cleanIban)
        .maybeSingle()
      if (byIban) {
        accountId = byIban.id
      }
    }

    // 2b. Fallback: legacy account_id lookup.
    if (!accountId) {
      const { data: existing } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("account_id", accountKey)
        .maybeSingle()
      if (existing) accountId = existing.id
    }

    // 2c. Create stub if still missing.
    if (!accountId) {
      const last4 = cleanIban ? cleanIban.slice(-4) : null
      const { data: created, error } = await supabase
        .from("bank_accounts")
        .insert({
          user_id: user.id,
          connection_id: connectionId,
          account_id: accountKey,
          iban: cleanIban || null,
          last_4: last4,
          currency: "EUR",
          display_name:
            body.bank_name && cleanIban
              ? `${body.bank_name} (PDF)`
              : "PDF-Import",
          scope: "business",
        })
        .select("id")
        .single()
      if (error || !created) {
        return NextResponse.json(
          { error: error?.message ?? "could not create account stub" },
          { status: 500 }
        )
      }
      accountId = created.id
    }
  }

  // ─── 3. Bulk insert transactions, skipping duplicates ────────────────
  let inserted = 0
  let duplicates = 0
  let rulesUpserted = 0
  let buergergeldCount = 0
  let buergergeldSumCents = 0

  for (const tx of body.transactions) {
    if (tx.is_buergergeld === true) {
      buergergeldCount++
      buergergeldSumCents += tx.amount_cents
    }

    const externalId = makeExternalId(tx)
    const { data: dup } = await supabase
      .from("bank_transactions")
      .select("id")
      .eq("account_id", accountId)
      .eq("external_id", externalId)
      .maybeSingle()
    if (dup) {
      duplicates++
      continue
    }

    const chosenCategory = tx.category_id ?? null
    const chosenScope: "business" | "personal" = tx.scope ?? "business"

    const { data: insertedTx, error } = await supabase
      .from("bank_transactions")
      .insert({
        user_id: user.id,
        account_id: accountId,
        external_id: externalId,
        status: "booked",
        booking_date: tx.occurred_on,
        value_date: tx.occurred_on,
        amount_cents: tx.amount_cents,
        currency: tx.currency || "EUR",
        remittance_info: tx.reference ?? tx.description ?? null,
        counterparty_name: tx.counterparty ?? null,
        counterparty_iban: tx.iban ?? null,
        is_business: chosenScope === "business",
        suggested_category_id: tx.suggested_category_id ?? null,
        suggested_scope: chosenScope,
        suggestion_source: tx.suggestion_source ?? "none",
        is_buergergeld: tx.is_buergergeld === true,
      })
      .select("id")
      .single()
    if (error || !insertedTx) continue
    inserted++

    // ─── Auto-materialize: create expense_entry or income_entry ───────
    // Without this, transactions stay in raw "bank_transactions" and don't
    // flow into Cash Flow / EÜR / EKS / analytics. The user already chose
    // category + scope in the preview — we materialize it here so it just
    // works without any extra clicks.
    if (chosenCategory) {
      const isCredit = tx.amount_cents > 0
      const isBuergergeld = tx.is_buergergeld === true
      const description = (tx.reference ?? tx.description ?? "").slice(0, 500)

      if (isCredit) {
        // Income entry (positive amount). Bürgergeld also goes here but
        // marked is_buergergeld=true and jobcenter_relevant=false (it's
        // social aid, not income — see EKS rules § 11b SGB II).
        const { data: incomeRow } = await supabase
          .from("income_entries")
          .insert({
            user_id: user.id,
            scope: chosenScope,
            occurred_on: tx.occurred_on,
            amount_cents: Math.abs(tx.amount_cents),
            currency: tx.currency || "EUR",
            category_id: chosenCategory,
            source: tx.counterparty ?? "Bank-Eingang",
            description,
            jobcenter_relevant: !isBuergergeld && chosenScope === "business",
          })
          .select("id")
          .single()
        if (incomeRow) {
          await supabase
            .from("bank_transactions")
            .update({ income_entry_id: incomeRow.id })
            .eq("id", insertedTx.id)
        }
      } else {
        // Expense entry (negative amount).
        const { data: expRow } = await supabase
          .from("expense_entries")
          .insert({
            user_id: user.id,
            scope: chosenScope,
            occurred_on: tx.occurred_on,
            amount_cents: Math.abs(tx.amount_cents),
            currency: tx.currency || "EUR",
            category_id: chosenCategory,
            vendor: tx.counterparty ?? null,
            description,
            // Business expenses are deductible by default; user can later
            // toggle private_share_pct in the entry detail view.
            is_deductible: chosenScope === "business",
          })
          .select("id")
          .single()
        if (expRow) {
          await supabase
            .from("bank_transactions")
            .update({ expense_entry_id: expRow.id })
            .eq("id", insertedTx.id)
        }
      }
    }

    // ─── Rule learning ──────────────────────────────────────────────
    // Only learn if user picked a category AND we have a pattern source
    // (counterparty preferred, fallback to first 40 chars of reference).
    const pattern = (tx.counterparty ?? "").trim().toLowerCase()
    if (chosenCategory && pattern.length >= 2) {
      const accepted = tx.accepted_suggestion === true
      const fromAi = tx.suggestion_source === "ai"
      const userChanged = !accepted

      // Cases:
      //  - accepted AI suggestion → upsert rule (source=suggested, conf=85)
      //  - user changed category   → upsert rule (source=manual,    conf=95)
      //  - accepted rule           → bump hit_count + last_used_at
      //  - kept "none" / no chosen → skip (already filtered)

      if (userChanged) {
        const upsert = await upsertRule(
          supabase,
          user.id,
          pattern,
          chosenCategory,
          chosenScope,
          "manual",
          95,
        )
        if (upsert) rulesUpserted++
      } else if (fromAi) {
        const upsert = await upsertRule(
          supabase,
          user.id,
          pattern,
          chosenCategory,
          chosenScope,
          "suggested",
          85,
        )
        if (upsert) rulesUpserted++
      } else if (tx.suggestion_source === "rule") {
        // Just bump usage stats on the existing rule.
        await bumpRuleUsage(supabase, user.id, pattern)
      }
    }
  }

  // ─── 4a. Intra-account (crypto / exchange) transfer detection ─────────
  // Catches Coinbase-style "Converted X USDC to Y EURC", "Sold EURC for EUR",
  // "Withdrawal to <bank>" rows. These are NOT income/expense — pure
  // balance-form changes within the user's own wallet. We mark them as
  // is_transfer=true AND delete any auto-materialized expense/income
  // entries to prevent inflated EKS / EÜR numbers.
  let intraAccountMarked = 0
  try {
    const res = await detectAndMarkIntraAccountTransfers(user.id, supabase)
    intraAccountMarked = res.marked
  } catch (err) {
    console.warn(
      "[import-pdf/commit] intra-account transfer-detector failed:",
      err
    )
  }

  // ─── 4b. Self-transfer pair detection (bank↔bank) ─────────────────────
  // After every commit, scan for newly-importable self-transfer pairs.
  // This catches the common pattern where a user uploads two PDFs (e.g.
  // N26 + Sparkasse) where one debit lines up with one credit.
  let transferPairs = 0
  let transferLegs = 0
  try {
    const res = await detectAndPairTransfers(user.id, supabase)
    transferPairs = res.pairs
    transferLegs = res.legs
  } catch (err) {
    console.warn("[import-pdf/commit] transfer-detector failed:", err)
  }

  return NextResponse.json({
    ok: true,
    inserted,
    duplicates,
    account_id: accountId,
    rules_upserted: rulesUpserted,
    buergergeld_count: buergergeldCount,
    buergergeld_sum_cents: buergergeldSumCents,
    transfer_pairs: transferPairs,
    transfer_legs: transferLegs,
    intra_account_marked: intraAccountMarked,
  })
}

// ─── Rule upsert helpers ───────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js"

async function upsertRule(
  supabase: SupabaseClient,
  userId: string,
  pattern: string,
  categoryId: string,
  scope: "business" | "personal",
  source: "manual" | "suggested" | "auto",
  confidence: number,
): Promise<boolean> {
  // Check existing
  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("id, hit_count")
    .eq("user_id", userId)
    .eq("match_field", "counterparty")
    .ilike("match_pattern", pattern)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from("categorization_rules")
      .update({
        category_id: categoryId,
        scope,
        source,
        confidence,
        hit_count: (existing.hit_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
    return !error
  }

  const { error } = await supabase.from("categorization_rules").insert({
    user_id: userId,
    match_pattern: pattern,
    match_field: "counterparty",
    category_id: categoryId,
    scope,
    source,
    confidence,
    hit_count: 1,
    last_used_at: new Date().toISOString(),
  })
  return !error
}

async function bumpRuleUsage(
  supabase: SupabaseClient,
  userId: string,
  pattern: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("categorization_rules")
    .select("id, hit_count")
    .eq("user_id", userId)
    .eq("match_field", "counterparty")
    .ilike("match_pattern", pattern)
    .maybeSingle()
  if (!existing) return
  await supabase
    .from("categorization_rules")
    .update({
      hit_count: (existing.hit_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
}
