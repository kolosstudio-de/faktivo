/**
 * POST /api/license/validate
 *
 * Heartbeat: Desktop-App ruft 1× am Tag (oder beim Start). Wenn die App
 * länger als 14 Tage offline → Lizenz wird auf dem Client als "expired"
 * markiert und der Login-Screen erscheint.
 *
 * Body: { key, machine_fingerprint }
 * Antwort: { ok, license: { plan, expires_at, status }, current_time }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    key: string
    machine_fingerprint: string
  } | null

  if (!body?.key || !body.machine_fingerprint) {
    return NextResponse.json(
      { ok: false, error: "key and machine_fingerprint required" },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  const { data: license } = await supabase
    .from("license_keys")
    .select("*")
    .eq("key", body.key.toUpperCase().trim())
    .single()

  if (!license) {
    return NextResponse.json(
      { ok: false, error: "license_not_found" },
      { status: 404 }
    )
  }
  if (license.status === "revoked") {
    return NextResponse.json(
      { ok: false, error: "license_revoked", reason: license.revoke_reason },
      { status: 403 }
    )
  }
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return NextResponse.json(
      { ok: false, error: "license_expired", expired_at: license.expires_at },
      { status: 403 }
    )
  }

  const { data: activation } = await supabase
    .from("machine_activations")
    .select("*")
    .eq("license_id", license.id)
    .eq("machine_fingerprint", body.machine_fingerprint)
    .is("deactivated_at", null)
    .maybeSingle()

  if (!activation) {
    return NextResponse.json(
      {
        ok: false,
        error: "device_not_activated",
        hint: "Bitte erst über /api/license/activate registrieren",
      },
      { status: 403 }
    )
  }

  // Bump last_seen
  await supabase
    .from("machine_activations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", activation.id)

  return NextResponse.json({
    ok: true,
    license: {
      key: license.key,
      plan: license.plan,
      status: license.status,
      expires_at: license.expires_at,
      max_devices: license.max_devices,
    },
    current_time: new Date().toISOString(),
  })
}
