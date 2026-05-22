import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  ipFromRequest,
  rateLimit,
  tooManyRequests,
} from "@/lib/api/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEMO_EMAIL = "demo@kolos.local"
const DEMO_PASSWORD = "demo1234"

// Demo-Account-Provisioning braucht admin.auth-Aufrufe (teuer). 5 / 15 min pro IP.
const demoLimit = rateLimit("auth-demo", {
  tokensPerInterval: 5,
  intervalMs: 15 * 60_000,
})

/**
 * Server-side demo-account provisioning.
 * Idempotent: if demo user exists, ensures the password is the well-known one
 * (so client can always sign in). Sets onboarding = completed + sample profile.
 *
 * Local-dev only — gate by NODE_ENV in production.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO !== "true") {
    return NextResponse.json(
      { error: "Demo-Login ist im Produktivbetrieb deaktiviert." },
      { status: 403 }
    )
  }

  const limited = demoLimit(ipFromRequest(request))
  if (limited) return tooManyRequests(limited.retryAfterSeconds)

  const admin = createAdminClient()

  // 1. Find existing demo user
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  })
  const existing = list?.users.find((u) => u.email === DEMO_EMAIL)

  let userId: string
  if (existing) {
    // Reset password to known value
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    userId = existing.id
  } else {
    // Create fresh
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { is_demo: true },
    })
    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "Demo-Erstellung fehlgeschlagen" },
        { status: 500 }
      )
    }
    userId = data.user.id
  }

  // 2. Pre-fill settings so user lands on dashboard, not onboarding
  await admin
    .from("settings")
    .update({
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: 7,
      first_name: "Demo",
      last_name: "User",
      company_name: "Demo Agency GmbH",
      legal_form: "freiberufler",
      tax_regime: "kleinunternehmer",
      is_kleinunternehmer: true,
      tax_id: "12/345/67890",
      address: {
        street: "Demostraße 1",
        zip: "10115",
        city: "Berlin",
        country: "DE",
      },
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      bank_name: "Demo-Bank",
      branche_wz_code: "73.11",
      branche_label: "Werbeagentur / Marketing",
      is_ksk_abgabepflichtig: true,
    })
    .eq("user_id", userId)

  return NextResponse.json({
    ok: true,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
}
