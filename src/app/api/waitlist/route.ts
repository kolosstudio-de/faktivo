import { NextResponse, type NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  let payload: {
    email?: string
    locale?: string
    segment?: string
    referrer?: string
    utm?: Record<string, unknown>
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const email = (payload.email ?? "").trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from("waitlist").insert({
    email,
    locale: payload.locale ?? null,
    segment: payload.segment ?? null,
    referrer: payload.referrer ?? null,
    utm: payload.utm ?? {},
  })

  // Unique-violation = already on list — still return success
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
