/**
 * GET /api/license/status
 *
 * Zeigt die License + aktive Geräte für den eingeloggten User.
 * Wird für die Settings-Seite "Mein Lizenzschlüssel" benutzt.
 */

import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { data: license } = await supabase
    .from("license_keys")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (!license) {
    return NextResponse.json({ error: "no_license" }, { status: 404 })
  }

  const { data: machines } = await supabase
    .from("machine_activations")
    .select("*")
    .eq("license_id", license.id)
    .order("last_seen_at", { ascending: false })

  return NextResponse.json({ license, machines: machines ?? [] })
}
