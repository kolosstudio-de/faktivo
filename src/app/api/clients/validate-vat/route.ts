/**
 * GET /api/clients/validate-vat?vat_id=DE123456789
 *
 * Server-side Proxy für VIES — vermeidet CORS-Probleme im Browser und cached
 * Ergebnisse in `vies_cache` (DB).
 *
 * Auth: requires authenticated user (we don't want to be a free VIES proxy).
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateViesVat } from "@/lib/validators/vies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const vatId = searchParams.get("vat_id")
  if (!vatId) {
    return NextResponse.json({ error: "vat_id required" }, { status: 400 })
  }

  const result = await validateViesVat(vatId)
  return NextResponse.json(result, { status: 200 })
}
