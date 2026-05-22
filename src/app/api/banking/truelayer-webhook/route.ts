/**
 * POST /api/banking/truelayer-webhook
 *
 * Echtzeit-Push von TrueLayer bei neuen Transaktionen.
 *
 * Doc: https://docs.truelayer.com/docs/data-api-webhooks
 *
 * Header:
 *   x-tl-signature  — JWS-Signature über den raw body, validierbar via JWKS
 *
 * Body (events):
 *   { type: "transactions.added", account_id, user_id (TL ours), provider, ... }
 *
 * Wir:
 *   1. Validieren Signature (in Prod) — in Dev übersprungen, falls TRUELAYER_WEBHOOK_SKIP_SIG=1
 *   2. Persistieren raw event in banking_webhook_events
 *   3. Triggern sync für betroffene Konto via Service-Client
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

/**
 * In Prod: validiere die JWS-Signatur via TrueLayer's JWKS.
 * https://docs.truelayer.com/docs/data-api-webhooks#verifying-webhook-signatures
 *
 * Für Dev: TRUELAYER_WEBHOOK_SKIP_SIG=1 setzen → wir vertrauen dem POST.
 * Für Prod: implementiere die Validierung mit `jose` oder ähnlich.
 */
async function verifySignature(
  request: NextRequest,
  rawBody: string
): Promise<boolean> {
  if (process.env.TRUELAYER_WEBHOOK_SKIP_SIG === "1") return true
  const sig = request.headers.get("x-tl-signature")
  if (!sig) return false
  // TODO: production validation via JWKS — outline:
  //   1. Fetch JWKS from https://webhooks.truelayer.com/.well-known/jwks
  //   2. Validate JWS over rawBody using `jose` library
  //   3. Check kid, alg, iss, jti for replay-protection
  // Für jetzt: return true wenn signature header vorhanden ist (DEV-mode).
  return Boolean(sig && rawBody)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const valid = await verifySignature(request, rawBody)
  if (!valid) {
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 401 }
    )
  }

  let payload: TLWebhookEvent
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Persist event for audit + replay
  const { data: eventRow } = await supabase
    .from("banking_webhook_events")
    .insert({
      provider: "truelayer",
      event_type: payload.type,
      payload_jsonb: payload as unknown as Record<string, unknown>,
      signature: request.headers.get("x-tl-signature"),
    })
    .select()
    .single()

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
        // Update invoice
        const { data: inv } = await supabase
          .from("invoices")
          .select("paid_cents, total_cents")
          .eq("id", match.invoice_id)
          .single()
        if (inv) {
          const newPaid = (inv.paid_cents ?? 0) + cents
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
