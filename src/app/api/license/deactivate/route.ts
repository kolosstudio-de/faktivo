/**
 * POST /api/license/deactivate
 *
 * Body: { key, machine_fingerprint }
 *
 * Trennt das Gerät von der Lizenz (z.B. wenn User sein altes Mac verkauft).
 * Free-License bekommt damit den 1 Geräteplatz wieder frei.
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
    .select("id")
    .eq("key", body.key.toUpperCase().trim())
    .single()

  if (!license) {
    return NextResponse.json(
      { ok: false, error: "license_not_found" },
      { status: 404 }
    )
  }

  await supabase
    .from("machine_activations")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("license_id", license.id)
    .eq("machine_fingerprint", body.machine_fingerprint)

  return NextResponse.json({ ok: true })
}
