/**
 * POST /api/license/activate
 *
 * Body: { key: "FAK-XXXX-...", machine_fingerprint: "<sha256>",
 *         machine_label: "MacBook M3", os_platform: "darwin",
 *         app_version: "1.0.0" }
 *
 * Bindet das Gerät (machine_fingerprint) an einen Lizenz-Schlüssel.
 *
 * Antwort: { ok: true, license: { plan, expires_at, status } }
 *   oder    { ok: false, error: "..." }
 *
 * Errors:
 *   - "license_not_found" — falscher Key
 *   - "license_revoked"
 *   - "license_expired"
 *   - "max_devices_reached" — z.B. Free 1 Gerät, schon belegt
 */

import { NextResponse, type NextRequest } from "next/server"

import { createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Body {
  key: string
  machine_fingerprint: string
  machine_label?: string
  os_platform?: string
  app_version?: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null
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

  // Already activated on this device? → just bump last_seen
  const { data: existing } = await supabase
    .from("machine_activations")
    .select("*")
    .eq("license_id", license.id)
    .eq("machine_fingerprint", body.machine_fingerprint)
    .maybeSingle()

  if (existing) {
    await supabase
      .from("machine_activations")
      .update({
        last_seen_at: new Date().toISOString(),
        deactivated_at: null,
        machine_label: body.machine_label ?? existing.machine_label,
        os_platform: body.os_platform ?? existing.os_platform,
        app_version: body.app_version ?? existing.app_version,
      })
      .eq("id", existing.id)
  } else {
    // Check device-limit
    const { count: activeCount } = await supabase
      .from("machine_activations")
      .select("*", { count: "exact", head: true })
      .eq("license_id", license.id)
      .is("deactivated_at", null)

    if ((activeCount ?? 0) >= license.max_devices) {
      return NextResponse.json(
        {
          ok: false,
          error: "max_devices_reached",
          max_devices: license.max_devices,
          hint: "Deaktiviere ein anderes Gerät unter app.faktivo.de oder upgrade dein Abo",
        },
        { status: 409 }
      )
    }

    await supabase.from("machine_activations").insert({
      license_id: license.id,
      user_id: license.user_id,
      machine_fingerprint: body.machine_fingerprint,
      machine_label: body.machine_label ?? "Mein Gerät",
      os_platform: body.os_platform ?? null,
      app_version: body.app_version ?? null,
    })
  }

  return NextResponse.json({
    ok: true,
    license: {
      key: license.key,
      plan: license.plan,
      status: license.status,
      expires_at: license.expires_at,
      max_devices: license.max_devices,
    },
  })
}
