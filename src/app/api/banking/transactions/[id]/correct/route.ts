/**
 * POST /api/banking/transactions/{id}/correct
 *
 * User korrigiert die AI-Klassifikation einer Tx. Wir:
 *   1. Update bank_transaction mit den neuen Werten
 *   2. Speichern eine category_rule basierend auf counterparty (Vendor),
 *      sodass beim nächsten REWE/Spotify die Regel automatisch greift.
 *
 * Body: { scope: "business" | "personal", category_label: string, vat_rate?: number }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const originError = validateOrigin(request)
  if (originError) return originError
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const scope = body.scope as "business" | "personal"
  const categoryLabel = body.category_label as string | null
  const vatRate =
    typeof body.vat_rate === "number" ? body.vat_rate : 19
  if (!scope || !["business", "personal"].includes(scope)) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 })
  }

  // Load bank_transaction
  const { data: tx } = await supabase
    .from("bank_transactions")
    .select("counterparty_name, remittance_info")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()
  if (!tx) {
    return NextResponse.json({ error: "tx not found" }, { status: 404 })
  }

  // Update tx ai fields (treat user-correction as classifier output)
  await supabase
    .from("bank_transactions")
    .update({
      ai_scope: scope === "business" ? "business" : "private",
      ai_category: categoryLabel,
      ai_vat_rate: vatRate,
      ai_confidence: 1.0,
      ai_reasoning: "User-Korrektur",
      ai_classified_at: new Date().toISOString(),
      is_business: scope === "business",
    })
    .eq("id", id)

  // Save / bump category_rule on counterparty pattern
  if (tx.counterparty_name) {
    const pattern = tx.counterparty_name.toLowerCase().slice(0, 30)
    // Upsert with hit-count
    const { data: existing } = await supabase
      .from("category_rules")
      .select("id, hits")
      .eq("user_id", user.id)
      .eq("pattern", pattern)
      .eq("match_field", "counterparty_name")
      .maybeSingle()

    if (existing) {
      await supabase
        .from("category_rules")
        .update({
          scope,
          category_label: categoryLabel,
          vat_rate: vatRate,
          is_deductible: scope === "business",
          jobcenter_relevant: scope === "business",
          hits: existing.hits + 1,
        })
        .eq("id", existing.id)
    } else {
      await supabase.from("category_rules").insert({
        user_id: user.id,
        pattern,
        match_field: "counterparty_name",
        scope,
        category_label: categoryLabel,
        vat_rate: vatRate,
        is_deductible: scope === "business",
        jobcenter_relevant: scope === "business",
        hits: 1,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
