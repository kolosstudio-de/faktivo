import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/billing/stripe"
import { validateOrigin } from "@/lib/api/csrf"
import type { Settings } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe ist noch nicht konfiguriert. Setze STRIPE_SECRET_KEY in .env.local." },
      { status: 503 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { priceId } = await request.json().catch(() => ({ priceId: undefined }))
  if (!priceId) {
    return NextResponse.json({ error: "priceId fehlt" }, { status: 400 })
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
  const s = settings as Settings | null

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // Create/reuse Stripe customer
  let customerId = s?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id
    const admin = createAdminClient()
    await admin
      .from("settings")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", user.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/de/billing?success=1`,
    cancel_url: `${origin}/de/billing?canceled=1`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { user_id: user.id },
    },
    // For DE customers
    locale: "de",
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: false },
  })

  return NextResponse.json({ url: session.url })
}
