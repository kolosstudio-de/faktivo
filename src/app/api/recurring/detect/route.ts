/**
 * GET /api/recurring/detect
 *
 * Scannt die letzten 90 Tage Bank-Transaktionen und findet wiederkehrende
 * Muster (Spotify, Miete, Kredit, etc.). Gibt Vorschläge zurück — User kann
 * sie als Recurring übernehmen via POST /api/recurring.
 */

import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { detectRecurringPatterns, type BankTxLite } from "@/lib/recurring"

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

  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  const { data: txs, error } = await supabase
    .from("bank_transactions")
    .select("id, amount_cents, counterparty_name, remittance_info, booking_date, ai_scope")
    .eq("user_id", user.id)
    .gte("booking_date", cutoff)
    .lt("amount_cents", 0)
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out tx that already belong to a known recurring
  const { data: existing } = await supabase
    .from("recurring_expenses")
    .select("id, vendor, amount_cents")
    .eq("user_id", user.id)
    .eq("active", true)

  const known = new Set(
    (existing ?? []).map(
      (r) => `${(r.vendor ?? "").toLowerCase()}|${r.amount_cents}`
    )
  )

  const candidates = detectRecurringPatterns((txs ?? []) as BankTxLite[]).filter(
    (c) => {
      const key = `${c.vendor.toLowerCase()}|${c.amountCents}`
      return !known.has(key)
    }
  )

  return NextResponse.json({ candidates })
}
