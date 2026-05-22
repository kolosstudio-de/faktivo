/**
 * POST /api/banking/truelayer-webhook
 *
 * Echtzeit-Push von TrueLayer bei neuen Transaktionen.
 *
 * Doc: https://docs.truelayer.com/docs/data-api-webhooks
 *
 * Header:
 *   Tl-Signature   — JWS-Compact (ES512, detached payload) über den raw body
 *   Tl-Webhook-Id  — eindeutige Event-ID (Replay-Schutz)
 *
 * Body (events):
 *   { type: "transactions.added", event_id, account_id, connection_id, ... }
 *
 * Wir:
 *   1. Validieren Signature via JWKS (siehe truelayer-signature.ts)
 *   2. Deduplizieren via event_id (DB unique-constraint)
 *   3. Persistieren raw event in banking_webhook_events
 *   4. Triggern sync für betroffene Konto via Service-Client
 */

import { NextResponse, type NextRequest } from "next/server"

import { createServiceClient } from "@/lib/supabase/server"
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
  verifyTruelayerSignature,
  extractEventId,
} from "@/lib/banking/truelayer-signature"
import type { BankConnection, Invoice } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TLWebhookEvent {
  type: string // "transactions.added" | "balance.updated" | etc.
  event_id?: string
  event_timestamp?: string
  results_uri?: string
  account_id?: string
  /** Connection-Identifier von TrueLayer */
  connection_id?: string
  data?: {
    transactions?: Array<Record<string, unknown>>
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sigHeader =
    request.headers.get("tl-signature") ??
    request.headers.get("x-tl-signature")

  const sigResult = await verifyTruelayerSignature(rawBody, sigHeader)
  if (!sigResult.valid) {
    // Bewusst KEINE Details preisgeben — nur 401 zurück. Reason landet im Log.
    console.warn(
      "[truelayer-webhook] signature rejected:",
      sigResult.reason,
      sigResult.headerInfo,
    )
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  let payload: TLWebhookEvent
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Replay-Schutz: event_id aus Header (bevorzugt) oder Body
  const eventId = extractEventId(
    request.headers.get("tl-webhook-id"),
    payload,
  )

  // Insert mit ON CONFLICT-Verhalten via unique-Constraint (provider, event_id).
  // Bei Duplicate: PostgREST liefert 23505 → wir antworten idempotent 200.
  const { data: eventRow, error: insertErr } = await supabase
    .from("banking_webhook_events")
    .insert({
      provider: "truelayer",
      event_id: eventId,
      event_type: payload.type,
      payload_jsonb: payload as unknown as Record<string, unknown>,
      signature: sigHeader,
    })
    .select()
    .single()

  if (insertErr) {
    // 23505 = unique_violation → schon gesehen, idempotent ack
    const isDuplicate =
      "code" in insertErr && (insertErr as { code?: string }).code === "23505"
    if (isDuplicate) {
      return NextResponse.json({ ok: true, deduped: true })
    }
    console.error("[truelayer-webhook] insert error:", insertErr)
    // Nicht-fatal — wir machen weiter ohne Audit-Zeile
  }

  // Find connection by tl_connection_id
  const tlConnId = payload.connection_id ?? null
  if (!tlConnId) {
    return NextResponse.json({ ok: true, skipped: "no connection_id" })
  }
  const { data: connData } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("tl_connection_id", tlConnId)
    .maybeSingle()
  const conn = connData as BankConnection | null
  if (!conn || conn.provider !== "truelayer") {
    return NextResponse.json({ ok: true, skipped: "no matching connection" })
  }

  // Update event with user_id
  if (eventRow) {
    await supabase
      .from("banking_webhook_events")
      .update({ user_id: conn.user_id })
      .eq("id", eventRow.id)
  }

  // Find affected account
  const { data: acct } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("connection_id", conn.id)
    .eq("account_id", payload.account_id ?? "")
    .maybeSingle()

  if (!acct) {
    if (eventRow) {
      await supabase
        .from("banking_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          error: "account not found",
        })
        .eq("id", eventRow.id)
    }
    return NextResponse.json({ ok: true, skipped: "account not found" })
  }

  // Refresh token if needed
  const expiresAt = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : 0
  let accessToken = conn.access_token
  if (expiresAt - Date.now() < 5 * 60_000 && conn.refresh_token) {
    try {
      const tokens = await refreshAccessToken(conn.refresh_token)
      accessToken = tokens.access_token
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
    } catch {
      if (eventRow) {
        await supabase
          .from("banking_webhook_events")
          .update({
            processed_at: new Date().toISOString(),
            error: "token refresh failed",
          })
          .eq("id", eventRow.id)
      }
      return NextResponse.json({ ok: true, error: "token expired" })
    }
  }
  if (!accessToken) {
    return NextResponse.json({ ok: true, error: "no token" })
  }

  // Pull recent transactions (last 7 days)
  const dateFrom = new Date(Date.now() - 7 * 86400_000)
    .toISOString()
    .slice(0, 10)
  const txs = await listTransactions(accessToken, acct.account_id, {
    from: dateFrom,
  })

  // Open invoices for matching
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, number, total_cents, paid_cents")
    .eq("user_id", conn.user_id)
    .in("status", ["sent", "partially_paid", "overdue"])

  const candidates: InvoiceMatchCandidate[] = (
    (openInvoices ?? []) as unknown as Invoice[]
  ).map((inv) => ({
    invoice_id: inv.id,
    number: inv.number,
    outstanding_cents: outstandingFromInvoice(inv),
    client_iban: null,
  }))

  let inserted = 0
  let matched = 0

  for (const tx of txs) {
    const externalId = txExternalId(tx)
    const cents = amountToCents(tx.amount)
    const counterparty = txCounterpartyName(tx)

    // Idempotency check
    const { data: existing } = await supabase
      .from("bank_transactions")
      .select("id")
      .eq("account_id", acct.id)
      .eq("external_id", externalId)
      .maybeSingle()
    if (existing) continue

    const match = matchTransaction(
      {
        amount_cents: cents,
        remittance_info: tx.description,
        counterparty_name: counterparty,
        counterparty_iban: null,
        booking_date: tx.timestamp.slice(0, 10),
      },
      candidates
    )

    let payment_id: string | null = null
    if (
      match.type === "invoice_payment" &&
      match.invoice_id &&
      match.confidence >= 0.7
    ) {
      // Insert payment row only — the DB trigger `recalc_invoice_payment`
      // updates invoices.paid_cents + status atomically. Manual UPDATE here
      // would race against that trigger when multiple bank transactions
      // arrive in the same webhook batch.
      const { data: pay } = await supabase
        .from("payments")
        .insert({
          user_id: conn.user_id,
          invoice_id: match.invoice_id,
          paid_at: tx.timestamp.slice(0, 10),
          amount_cents: cents,
          method: "bank_transfer",
          notes: `Auto-Match TrueLayer Webhook · ${match.reasoning.join("; ")}`,
        })
        .select("id")
        .single()
      if (pay) {
        payment_id = pay.id
        matched++
      }
    }

    const { error: insErr } = await supabase.from("bank_transactions").insert({
      user_id: conn.user_id,
      account_id: acct.id,
      external_id: externalId,
      status: "booked",
      booking_date: tx.timestamp.slice(0, 10),
      value_date: tx.timestamp.slice(0, 10),
      amount_cents: cents,
      currency: tx.currency,
      remittance_info: tx.description,
      counterparty_name: counterparty,
      counterparty_iban: null,
      category_hint: match.category_hint ?? null,
      payment_id,
      is_business: acct.scope === "business",
    })
    if (!insErr) inserted++
  }

  await supabase
    .from("bank_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", acct.id)

  if (eventRow) {
    await supabase
      .from("banking_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRow.id)
  }

  return NextResponse.json({ ok: true, inserted, matched })
}
