/**
 * POST /api/banking/detect-transfers
 *
 * Backfill helper: scan all of the current user's bank_transactions for
 * self-transfer pairs (Konto → eigenes Konto) and mark them as such.
 * Any materialized expense/income entries on either leg are deleted, so
 * EKS / EÜR / analytics no longer double-count the move.
 *
 * Triggered manually from the Banking page button "Eigentransfers erkennen"
 * or as part of the post-PDF-commit flow.
 *
 * Returns: { ok: true, pairs, legs }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import { detectAndPairTransfers } from "@/lib/banking/transfer-detector"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

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

  try {
    const { pairs, legs } = await detectAndPairTransfers(user.id, supabase)
    return NextResponse.json({ ok: true, pairs, legs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "detect failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
