import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateOrigin } from "@/lib/api/csrf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * DSGVO Art. 17 — right to erasure.
 * Deletes all user data except records with legal retention obligation
 * (GoBD: 8 years for finalized invoices). Those remain but are anonymized.
 *
 * Note: this is irreversible. Client should prompt hard confirmation.
 */
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
  const admin = createAdminClient()

  // 1. Delete non-retention records
  const userId = user.id
  const deletions: Array<{ table: string; count: number | null }> = []

  // Order: reverse FK (children first)
  const tablesInOrder = [
    "mahnungen",
    "line_items",
    "payments",
    "income_entries",
    "expense_entries",
    "jobcenter_reports",
    "attachments",
    "onboarding_progress",
    "categories",
    "clients",
    "quotes",
    // invoices + document_archive kept (GoBD 8-year retention)
  ]

  for (const table of tablesInOrder) {
    const { count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .eq("user_id", userId)
    deletions.push({ table, count: count ?? 0 })
  }

  // 2. Anonymize invoices (required to keep by AO/HGB §257) — replace PII
  await admin
    .from("invoices")
    .update({
      notes: null,
      internal_notes: null,
    })
    .eq("user_id", userId)

  // 3. Remove settings (but keep the auth.users record is done by delete-user)
  await admin.from("settings").delete().eq("user_id", userId)
  await admin.from("number_sequences").delete().eq("user_id", userId)

  // 4. Delete auth.users record (cascades cookies)
  await admin.auth.admin.deleteUser(userId)

  return NextResponse.json({
    ok: true,
    deletions,
    retention_notice:
      "Finalisierte Rechnungen und Archive bleiben gemäß §147 AO 8 Jahre anonymisiert erhalten.",
  })
}
