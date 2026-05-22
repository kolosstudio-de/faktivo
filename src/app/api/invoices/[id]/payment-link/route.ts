/**
 * POST /api/invoices/{id}/payment-link
 *   → erstellt einen Stripe Payment Link für die Rechnung. Idempotent:
 *     wenn stripe_payment_link_id schon existiert, wird die existierende URL
 *     zurückgegeben.
 *
 * DELETE /api/invoices/{id}/payment-link
 *   → deaktiviert den Payment Link (wenn z.B. Rechnung storniert wird).
 *
 * Webhook (separater Endpoint /api/billing/webhook): bei checkout.session.completed
 * mit metadata.invoice_id → automatisch payment-Zeile + invoice.paid_cents.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/billing/stripe"
import type { Invoice } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      {
        error: "Stripe nicht konfiguriert",
        hint: "Setze STRIPE_SECRET_KEY in .env.local. Free signup: https://dashboard.stripe.com/register",
      },
      { status: 503 }
    )
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  const inv = invoice as Invoice | null

  if (!inv) {
    return NextResponse.json({ error: "Rechnung nicht gefunden" }, { status: 404 })
  }
  if (!inv.locked_at) {
    return NextResponse.json(
      { error: "Rechnung muss erst finalisiert sein" },
      { status: 400 }
    )
  }
  if (inv.status === "paid" || inv.status === "cancelled") {
    return NextResponse.json(
      { error: "Rechnung bereits bezahlt oder storniert" },
      { status: 400 }
    )
  }

  // Idempotency: if link exists and outstanding hasn't changed, return existing
  if (inv.stripe_payment_link_url && inv.stripe_payment_link_id) {
    return NextResponse.json({
      url: inv.stripe_payment_link_url,
      id: inv.stripe_payment_link_id,
      reused: true,
    })
  }

  const outstanding = inv.total_cents - inv.paid_cents
  if (outstanding <= 0) {
    return NextResponse.json(
      { error: "Keine offene Forderung" },
      { status: 400 }
    )
  }

  // Need a Price object (Payment Links can't take ad-hoc prices directly)
  // Strategy: create one-off Product+Price for this invoice.
  const product = await stripe.products.create({
    name: `Rechnung ${inv.number ?? inv.id.slice(0, 8)}`,
    description: `Zahlung an ${user.email ?? "—"} · Fällig ${inv.due_date ?? "—"}`,
    metadata: {
      invoice_id: inv.id,
      user_id: user.id,
    },
  })
  const price = await stripe.prices.create({
    product: product.id,
    currency: (inv.currency ?? "eur").toLowerCase(),
    unit_amount: outstanding,
    metadata: { invoice_id: inv.id },
  })

  // Build success URL (back to invoice page)
  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      invoice_id: inv.id,
      user_id: user.id,
      invoice_number: inv.number ?? "",
    },
    payment_intent_data: {
      metadata: {
        invoice_id: inv.id,
        user_id: user.id,
        invoice_number: inv.number ?? "",
      },
    },
    after_completion: {
      type: "redirect",
      redirect: { url: `${origin}/de/invoices/${inv.id}?paid=1` },
    },
    // Allow promotional code? skip
    allow_promotion_codes: false,
    // Single-use → false: we want it shareable until expires
  })

  await supabase
    .from("invoices")
    .update({
      stripe_payment_link_id: link.id,
      stripe_payment_link_url: link.url,
      stripe_payment_link_created_at: new Date().toISOString(),
    })
    .eq("id", inv.id)

  return NextResponse.json({
    url: link.url,
    id: link.id,
    reused: false,
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 503 })
  }

  const { data: inv } = await supabase
    .from("invoices")
    .select("stripe_payment_link_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (inv?.stripe_payment_link_id) {
    await stripe.paymentLinks.update(inv.stripe_payment_link_id, {
      active: false,
    })
    await supabase
      .from("invoices")
      .update({
        stripe_payment_link_id: null,
        stripe_payment_link_url: null,
      })
      .eq("id", id)
  }
  return NextResponse.json({ ok: true })
}
