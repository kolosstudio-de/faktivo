import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
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
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
  const s = settings as Settings | null

  if (!s?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Kein Stripe-Kunde. Bitte erst ein Abo abschließen." },
      { status: 400 }
    )
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const session = await stripe.billingPortal.sessions.create({
    customer: s.stripe_customer_id,
    return_url: `${origin}/de/billing`,
  })

  return NextResponse.json({ url: session.url })
}
