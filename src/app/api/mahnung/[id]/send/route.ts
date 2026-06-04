/**
 * POST /api/mahnung/[id]/send — Mahnung per E-Mail an Kunden senden.
 *
 * - Same-Origin CSRF-Guard (`validateOrigin`).
 * - Authentifizierter User benötigt.
 * - Idempotenz: wenn `mahnungen.sent_at` bereits gesetzt ist, lehnt der Route
 *   den Versand mit 409 ab, ausser der Aufrufer schickt `{ force: true }`.
 *   So vermeiden wir doppelten Versand bei versehentlichem Doppelklick.
 *
 * Stand 2026-06-03
 */

import { NextResponse, type NextRequest } from "next/server"

import { validateOrigin } from "@/lib/api/csrf"
import { createClient } from "@/lib/supabase/server"
import { sendMahnungEmail } from "@/lib/email/send-mahnung"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface SendBody {
  customMessage?: unknown
  bcc?: unknown
  force?: unknown
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const originError = validateOrigin(request)
  if (originError) return originError

  const { id } = await ctx.params

  // Optionales Body (alle Felder optional). Wenn parsing scheitert (leerer
  // Body) — nehmen wir Defaults statt 400 zu werfen.
  let body: SendBody = {}
  try {
    body = (await request.json()) as SendBody
  } catch {
    body = {}
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Idempotenz-Check: bereits gesendet?
  const { data: existing } = await supabase
    .from("mahnungen")
    .select("id, sent_at, status, invoice_id")
    .eq("id", id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const force = body.force === true
  if (existing.sent_at && !force) {
    return NextResponse.json(
      {
        ok: false,
        error: "already_sent",
        sent_at: existing.sent_at,
        message:
          "Diese Mahnung wurde bereits gesendet. Mit { force: true } erneut senden.",
      },
      { status: 409 },
    )
  }

  const customMessage =
    typeof body.customMessage === "string" ? body.customMessage : undefined
  const bcc = typeof body.bcc === "string" ? body.bcc : undefined

  const result = await sendMahnungEmail(id, { customMessage, bcc })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, provider: result.provider },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    id: result.id ?? null,
    previewText: result.previewText,
  })
}
