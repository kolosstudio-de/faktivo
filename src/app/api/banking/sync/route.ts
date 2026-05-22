/**
 * POST /api/banking/sync — holt neue Transaktionen für alle Konten des Users.
 *
 * Mit X-Cron-Secret → service-mode (sync für ALLE Users).
 *
 * Pro bank_account:
 *   - GoCardless polling-Aggregator → Demo-data
 *   - TrueLayer → /data/v1/accounts/{id}/transactions  (mit refresh_token)
 *
 * Auto-Match gegen offene Rechnungen + Vendor-Kategorisierung.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import {
  listTransactions,
  refreshAccessToken,
  amountToCents,
  txExternalId,
  txCounterpartyName,
} from "@/lib/banking/truelayer"
import {
  matchTransaction,
  outstandingFromInvoice,
  type InvoiceMatchCandidate,
} from "@/lib/banking/match"
import {
  AUTO_IMPORT_THRESHOLD,
  classifyTransactions,
  type ClassifyContext,
  type ClassifyInput,
} from "@/lib/banking/ai-classifier"
import type { BankConnection, Invoice, Settings } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface SyncSummary {
  accounts_synced: number
  transactions_inserted: number
  payments_matched: number
  ai_classified: number
  expenses_auto_imported: number
  errors: { account_id: string; error: string }[]
}

type Db =
  | ReturnType<typeof createServiceClient>
  | Awaited<ReturnType<typeof createClient>>

async function ensureFreshToken(
  supabase: Db,
  conn: BankConnection
): Promise<string | null> {
  if (conn.provider !== "truelayer") return null
  if (!conn.access_token) return null

  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0
  // refresh wenn < 5min Gültigkeit
  if (expiresAt - Date.now() > 5 * 60_000) {
    return conn.access_token
  }
  if (!conn.refresh_token) return conn.access_token

  try {
    const tokens = await refreshAccessToken(conn.refresh_token)
    await supabase
      .from("bank_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
      })
      .eq("id", conn.id)
    return tokens.access_token
  } catch {
    await supabase
      .from("bank_connections")
      .update({ status: "expired" })
      .eq("id", conn.id)
    return null
  }
}

async function syncAccountsForUser(
  supabase: Db,
  userId: string,
  summary: SyncSummary
) {
  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("sync_enabled", true)

  // Open invoices for matching
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, number, total_cents, paid_cents")
    .eq("user_id", userId)
    .in("status", ["sent", "partially_paid", "overdue"])

  const candidates: InvoiceMatchCandidate[] = (
    (openInvoices ?? []) as unknown as Invoice[]
  ).map((inv) => ({
    invoice_id: inv.id,
    number: inv.number,
    outstanding_cents: outstandingFromInvoice(inv),
    client_iban: null,
  }))

  // Cache connections by id
  const connIds = [...new Set((accounts ?? []).map((a) => a.connection_id).filter(Boolean))]
  const { data: connsData } = await supabase
    .from("bank_connections")
    .select("*")
    .in("id", connIds)
  const connMap = new Map<string, BankConnection>()
  for (const c of (connsData ?? []) as BankConnection[]) connMap.set(c.id, c)

  for (const acct of accounts ?? []) {
    try {
      const conn = acct.connection_id ? connMap.get(acct.connection_id) : null

      type NormalizedTx = {
        externalId: string
        bookingDate: string
        valueDate: string | null
        amountCents: number
        currency: string
        remittance: string | null
        counterparty: string | null
        counterpartyIban: string | null
      }

      // TrueLayer-only: ohne Connection → CSV-Import-Account, kein Auto-Sync
      if (!conn || conn.provider !== "truelayer") {
        continue
      }

      const accessToken = await ensureFreshToken(supabase, conn)
      if (!accessToken) {
        throw new Error("Token abgelaufen — bitte Bank neu verbinden")
      }
      const dateFrom = acct.last_synced_at
        ? new Date(
            new Date(acct.last_synced_at).getTime() - 30 * 86400_000
          )
            .toISOString()
            .slice(0, 10)
        : undefined

      const txs = await listTransactions(accessToken, acct.account_id, {
        from: dateFrom,
      })

      const normalizedTxs: NormalizedTx[] = txs.map((tx) => ({
        externalId: txExternalId(tx),
        bookingDate: tx.timestamp.slice(0, 10),
        valueDate: tx.timestamp.slice(0, 10),
        amountCents: amountToCents(tx.amount),
        currency: tx.currency,
        remittance: tx.description,
        counterparty: txCounterpartyName(tx),
        counterpartyIban: null, // TrueLayer Data API gibt counterparty IBAN nicht raus
      }))

      for (const tx of normalizedTxs) {
        const match = matchTransaction(
          {
            amount_cents: tx.amountCents,
            remittance_info: tx.remittance,
            counterparty_name: tx.counterparty,
            counterparty_iban: tx.counterpartyIban,
            booking_date: tx.bookingDate,
          },
          candidates
        )

        let payment_id: string | null = null
        if (
          match.type === "invoice_payment" &&
          match.invoice_id &&
          match.confidence >= 0.7
        ) {
          const { data: pay } = await supabase
            .from("payments")
            .insert({
              user_id: userId,
              invoice_id: match.invoice_id,
              paid_at: tx.bookingDate,
              amount_cents: tx.amountCents,
              method: "bank_transfer",
              notes: `Auto-Match aus Banking · ${match.reasoning.join("; ")}`,
            })
            .select()
            .single()
          if (pay) {
            payment_id = pay.id
            summary.payments_matched++

            // Update invoice paid_cents
            const { data: inv } = await supabase
              .from("invoices")
              .select("paid_cents, total_cents")
              .eq("id", match.invoice_id)
              .single()
            if (inv) {
              const newPaid = (inv.paid_cents ?? 0) + tx.amountCents
              const status =
                newPaid >= inv.total_cents
                  ? "paid"
                  : newPaid > 0
                    ? "partially_paid"
                    : "sent"
              await supabase
                .from("invoices")
                .update({ paid_cents: newPaid, status })
                .eq("id", match.invoice_id)
            }
          }
        }

        const { error: insErr } = await supabase
          .from("bank_transactions")
          .upsert(
            {
              user_id: userId,
              account_id: acct.id,
              external_id: tx.externalId,
              status: "booked",
              booking_date: tx.bookingDate,
              value_date: tx.valueDate,
              amount_cents: tx.amountCents,
              currency: tx.currency,
              remittance_info: tx.remittance,
              counterparty_name: tx.counterparty,
              counterparty_iban: tx.counterpartyIban,
              category_hint: match.category_hint ?? null,
              payment_id,
              is_business: acct.scope === "business",
            },
            { onConflict: "account_id,external_id", ignoreDuplicates: false }
          )
        if (!insErr) summary.transactions_inserted++
      }

      await supabase
        .from("bank_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", acct.id)

      summary.accounts_synced++
    } catch (e) {
      summary.errors.push({
        account_id: acct.account_id,
        error: e instanceof Error ? e.message : "unknown",
      })
    }
  }

  // ─── AI-Klassifikation für neue, ungeprüfte Transaktionen ─────────────
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("legal_form, branche_label, is_kleinunternehmer, receives_buergergeld")
    .eq("user_id", userId)
    .single()
  const settings = settingsRow as Pick<
    Settings,
    "legal_form" | "branche_label" | "is_kleinunternehmer" | "receives_buergergeld"
  > | null

  const aiContext: ClassifyContext = {
    userProfession: settings?.branche_label ?? undefined,
    isKleinunternehmer: settings?.is_kleinunternehmer ?? false,
    isFreelancer:
      settings?.legal_form === "freiberufler" ||
      settings?.legal_form === "einzelunternehmen",
    receivesBuergergeld: settings?.receives_buergergeld ?? false,
  }

  const { data: unclassified } = await supabase
    .from("bank_transactions")
    .select("id, amount_cents, remittance_info, counterparty_name, booking_date, payment_id")
    .eq("user_id", userId)
    .is("ai_classified_at", null)
    .is("payment_id", null) // Eingänge mit invoice-Match überspringen
    .limit(100)

  if (unclassified && unclassified.length > 0) {
    const inputs: ClassifyInput[] = unclassified.map((u) => ({
      amountCents: u.amount_cents,
      remittanceInfo: u.remittance_info,
      counterpartyName: u.counterparty_name,
      bookingDate: u.booking_date,
    }))
    const results = await classifyTransactions(inputs, aiContext)

    for (let i = 0; i < unclassified.length; i++) {
      const tx = unclassified[i]
      const r = results[i]
      summary.ai_classified++

      await supabase
        .from("bank_transactions")
        .update({
          ai_scope: r.scope,
          ai_category: r.category,
          ai_skr03: r.skr03,
          ai_vat_rate: r.vatRate,
          ai_confidence: r.confidence,
          ai_reasoning: r.reasoning,
          ai_classified_at: new Date().toISOString(),
          is_business: r.scope === "business",
        })
        .eq("id", tx.id)

      const isOutgoing = tx.amount_cents < 0
      if (
        r.confidence >= AUTO_IMPORT_THRESHOLD &&
        r.scope === "business" &&
        isOutgoing
      ) {
        const { data: exp } = await supabase
          .from("expense_entries")
          .insert({
            user_id: userId,
            scope: "business",
            kind: "expense",
            occurred_on: tx.booking_date,
            amount_cents: Math.abs(tx.amount_cents),
            vendor: tx.counterparty_name,
            description: tx.remittance_info,
            vat_rate: r.vatRate,
            is_deductible: true,
            jobcenter_relevant: true,
          })
          .select("id")
          .single()
        if (exp) {
          await supabase
            .from("bank_transactions")
            .update({
              expense_entry_id: exp.id,
              ai_auto_imported_at: new Date().toISOString(),
            })
            .eq("id", tx.id)
          summary.expenses_auto_imported++
        }
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const summary: SyncSummary = {
    accounts_synced: 0,
    transactions_inserted: 0,
    payments_matched: 0,
    ai_classified: 0,
    expenses_auto_imported: 0,
    errors: [],
  }

  const cronSecret = process.env.CRON_SECRET
  const provided = request.headers.get("x-cron-secret")

  if (cronSecret && provided === cronSecret) {
    // Cron mode — secret-protected, skip origin check.
    const supabase = createServiceClient()
    const { data: users } = await supabase
      .from("bank_accounts")
      .select("user_id")
      .eq("sync_enabled", true)
    const uniqueUsers = [...new Set((users ?? []).map((u) => u.user_id))]
    for (const uid of uniqueUsers) {
      await syncAccountsForUser(supabase, uid, summary)
    }
    return NextResponse.json(summary)
  }

  // Browser-mode → enforce same-origin.
  const originError = validateOrigin(request)
  if (originError) return originError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  await syncAccountsForUser(supabase, user.id, summary)
  return NextResponse.json(summary)
}
