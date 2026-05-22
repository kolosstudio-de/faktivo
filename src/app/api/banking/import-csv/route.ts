/**
 * POST /api/banking/import-csv
 *
 * Body: multipart/form-data mit Feld "file" (CSV) und optional "account_id"
 *       (UUID einer existierenden bank_accounts-Zeile).
 *
 * Wenn account_id fehlt, wird ein "Manuelle CSV"-Account angelegt (oder
 * wiederverwendet).
 *
 * Auto-Match auf offene Rechnungen + Vendor-Kategorisierung — gleiche Logik
 * wie /api/banking/sync.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import { parseBankCsv } from "@/lib/banking/csv-parsers"
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
import type { Invoice, Settings } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

interface Summary {
  format: string
  total_in_csv: number
  inserted: number
  duplicates: number
  payments_matched: number
  ai_classified: number
  expenses_auto_imported: number
  warnings: string[]
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

  const ct = request.headers.get("content-type") ?? ""
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "expected multipart/form-data" },
      { status: 400 }
    )
  }

  const form = await request.formData()
  const file = form.get("file") as File | null
  const accountIdInput = form.get("account_id") as string | null
  if (!file) {
    return NextResponse.json({ error: "no file" }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (>10MB)" }, { status: 413 })
  }

  const text = await file.text()
  const parsed = parseBankCsv(text)

  // Find or create bank_account
  let accountId = accountIdInput
  if (!accountId) {
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("account_id", "manual-csv-import")
      .maybeSingle()

    if (existing) {
      accountId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from("bank_accounts")
        .insert({
          user_id: user.id,
          connection_id: null,
          account_id: "manual-csv-import",
          display_name: "Manueller CSV-Import",
          currency: "EUR",
          scope: "business",
        })
        .select("id")
        .single()
      if (error || !created) {
        // bank_accounts.connection_id is NOT NULL — fall back to error
        return NextResponse.json(
          {
            error:
              "bank_accounts erfordert connection_id. Bitte erst eine (Demo-)Bank verbinden, dann CSV importieren.",
          },
          { status: 400 }
        )
      }
      accountId = created.id
    }
  }

  // Open invoices for matching
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, number, total_cents, paid_cents")
    .eq("user_id", user.id)
    .in("status", ["sent", "partially_paid", "overdue"])

  const candidates: InvoiceMatchCandidate[] = (
    (openInvoices ?? []) as unknown as Invoice[]
  ).map((inv) => ({
    invoice_id: inv.id,
    number: inv.number,
    outstanding_cents: outstandingFromInvoice(inv),
    client_iban: null,
  }))

  const summary: Summary = {
    format: parsed.formatLabel,
    total_in_csv: parsed.transactions.length,
    inserted: 0,
    duplicates: 0,
    payments_matched: 0,
    ai_classified: 0,
    expenses_auto_imported: 0,
    warnings: parsed.warnings,
  }

  // Settings for AI context
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("legal_form, branche_label, is_kleinunternehmer, receives_buergergeld")
    .eq("user_id", user.id)
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

  // Track inserted tx-ids to AI-classify in batch afterwards
  const insertedTxs: Array<{
    id: string
    isPayment: boolean
    classifyInput: ClassifyInput
  }> = []

  for (const tx of parsed.transactions) {
    // Idempotency check
    const { data: existing } = await supabase
      .from("bank_transactions")
      .select("id")
      .eq("account_id", accountId)
      .eq("external_id", tx.externalId)
      .maybeSingle()
    if (existing) {
      summary.duplicates++
      continue
    }

    const match = matchTransaction(
      {
        amount_cents: tx.amountCents,
        remittance_info: tx.remittanceInfo,
        counterparty_name: tx.counterpartyName,
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
          user_id: user.id,
          invoice_id: match.invoice_id,
          paid_at: tx.bookingDate,
          amount_cents: tx.amountCents,
          method: "bank_transfer",
          notes: `Auto-Match aus CSV-Import · ${match.reasoning.join("; ")}`,
        })
        .select("id")
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

    const { data: insRow, error } = await supabase
      .from("bank_transactions")
      .insert({
        user_id: user.id,
        account_id: accountId,
        external_id: tx.externalId,
        status: "booked",
        booking_date: tx.bookingDate,
        value_date: tx.valueDate,
        amount_cents: tx.amountCents,
        currency: tx.currency,
        remittance_info: tx.remittanceInfo,
        counterparty_name: tx.counterpartyName,
        counterparty_iban: tx.counterpartyIban,
        category_hint: match.category_hint ?? null,
        payment_id,
        is_business: true,
      })
      .select("id")
      .single()
    if (!error && insRow) {
      summary.inserted++
      insertedTxs.push({
        id: insRow.id,
        isPayment: payment_id !== null,
        classifyInput: {
          amountCents: tx.amountCents,
          remittanceInfo: tx.remittanceInfo,
          counterpartyName: tx.counterpartyName,
          bookingDate: tx.bookingDate,
        },
      })
    }
  }

  // ─── AI-Klassifikation für ausgehende Transaktionen ohne Invoice-Match ─
  // Eingänge mit payment_id sind bereits matched — keine AI nötig.
  // Eingänge ohne match → income_entry-Kandidaten (auch klassifizieren).
  // Ausgänge → expense_entry-Kandidaten (klassifizieren + ggf. auto-import).
  const toClassify = insertedTxs.filter((t) => !t.isPayment)
  if (toClassify.length > 0) {
    const inputs = toClassify.map((t) => t.classifyInput)
    const results = await classifyTransactions(inputs, aiContext)

    for (let i = 0; i < toClassify.length; i++) {
      const tx = toClassify[i]
      const r = results[i]
      summary.ai_classified++

      // Persist AI classification
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

      // Auto-import as expense_entry if confidence high + scope business + outgoing
      const isOutgoing = tx.classifyInput.amountCents < 0
      if (
        r.confidence >= AUTO_IMPORT_THRESHOLD &&
        r.scope === "business" &&
        isOutgoing
      ) {
        const { data: exp } = await supabase
          .from("expense_entries")
          .insert({
            user_id: user.id,
            scope: "business",
            kind: "expense",
            occurred_on: tx.classifyInput.bookingDate,
            amount_cents: Math.abs(tx.classifyInput.amountCents),
            vendor: tx.classifyInput.counterpartyName,
            description: tx.classifyInput.remittanceInfo,
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

  return NextResponse.json(summary)
}
