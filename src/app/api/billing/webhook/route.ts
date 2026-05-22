import { NextResponse, type NextRequest } from "next/server"
import type Stripe from "stripe"

import { getStripe, STRIPE_WEBHOOK_SECRET } from "@/lib/billing/stripe"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Stripe webhook handler. Updates settings.plan + stripe_subscription_id.
 * To test locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe()
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid signature" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id
      if (userId) {
        const priceId = sub.items.data[0]?.price.id
        const plan = resolvePlanFromPriceId(priceId)
        await admin
          .from("settings")
          .update({
            plan,
            stripe_subscription_id: sub.id,
            trial_ends_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
          })
          .eq("user_id", userId)
      }
      break
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id
      if (userId) {
        await admin
          .from("settings")
          .update({ plan: "free", stripe_subscription_id: null })
          .eq("user_id", userId)
      }
      break
    }

    // ─── Invoice-Zahlung via Stripe Payment Link ──────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const invoiceId = session.metadata?.invoice_id
      const userId = session.metadata?.user_id
      const amountTotal = session.amount_total ?? 0

      if (invoiceId && userId && amountTotal > 0 && session.payment_status === "paid") {
        // Fetch invoice
        const { data: inv } = await admin
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .eq("user_id", userId)
          .single()

        if (inv) {
          // Create payment row (idempotent via session.id stored in reference)
          const { data: existing } = await admin
            .from("payments")
            .select("id")
            .eq("reference", session.id)
            .maybeSingle()

          if (!existing) {
            const { error: payErr } = await admin
              .from("payments")
              .insert({
                user_id: userId,
                invoice_id: invoiceId,
                paid_at: new Date().toISOString().slice(0, 10),
                amount_cents: amountTotal,
                method: "stripe_payment_link",
                reference: session.id,
                notes: `Stripe Payment Link ${session.payment_link ?? ""} · Customer ${session.customer_email ?? "—"}`,
              })

            if (!payErr) {
              const newPaid = (inv.paid_cents ?? 0) + amountTotal
              const status =
                newPaid >= inv.total_cents
                  ? "paid"
                  : newPaid > 0
                    ? "partially_paid"
                    : inv.status

              await admin
                .from("invoices")
                .update({ paid_cents: newPaid, status })
                .eq("id", invoiceId)

              // Deactivate the Payment Link if fully paid
              if (newPaid >= inv.total_cents && inv.stripe_payment_link_id) {
                const stripe = getStripe()
                if (stripe) {
                  await stripe.paymentLinks
                    .update(inv.stripe_payment_link_id, { active: false })
                    .catch(() => null)
                }
              }
            }
          }
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

function resolvePlanFromPriceId(priceId?: string): "pro" | "business" | "free" {
  if (!priceId) return "free"
  const pro = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY,
  ]
  const business = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY,
  ]
  if (pro.includes(priceId)) return "pro"
  if (business.includes(priceId)) return "business"
  return "free"
}
