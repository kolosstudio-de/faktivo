/**
 * POST /api/banking/connect — startet eine TrueLayer-Bank-Verbindung.
 *
 * Body kann leer sein — TrueLayer zeigt seinen eigenen Bank-Picker mit allen
 * deutschen PSD2-Banken (Sparkasse, N26, DKB, Commerzbank, ING, Postbank,
 * comdirect, Volksbanken, Targobank, Revolut, Tomorrow, Wise, etc.).
 *
 * Body (optional): { provider_id: "de-ob-sparkasse-fyrst" } — Direktwahl,
 * skippt TrueLayer's Picker.
 *
 * Antwort: { redirect: "https://auth.truelayer.com/?..." }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import {
  buildAuthorizationUrl,
  hasCredentials,
} from "@/lib/banking/truelayer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  if (!hasCredentials()) {
    return NextResponse.json(
      {
        error: "TrueLayer nicht konfiguriert",
        hint: "Setze TRUELAYER_CLIENT_ID + TRUELAYER_CLIENT_SECRET in .env.local. Free signup: https://console.truelayer.com/signup",
      },
      { status: 503 }
    )
  }

  let providerId: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    providerId = body?.provider_id ?? null
  } catch {
    // empty body OK
  }

  // Pre-create connection row
  const reference = crypto.randomUUID()

  const { data: connRow, error: insErr } = await supabase
    .from("bank_connections")
    .insert({
      user_id: user.id,
      requisition_id: `pending-${reference}`,
      institution_id: providerId ?? "de-ob-all",
      provider: "truelayer",
      status: "pending",
      reference,
    })
    .select()
    .single()
  if (insErr || !connRow) {
    return NextResponse.json(
      { error: insErr?.message ?? "DB insert failed" },
      { status: 500 }
    )
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  const redirectUri = `${origin}/api/banking/callback`

  try {
    const state = `${reference}|${connRow.id}`
    const authUrl = buildAuthorizationUrl({
      redirectUri,
      state,
    })
    return NextResponse.json({
      redirect: authUrl,
      reference,
    })
  } catch (e) {
    await supabase.from("bank_connections").delete().eq("id", connRow.id)
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "TrueLayer error",
      },
      { status: 500 }
    )
  }
}
