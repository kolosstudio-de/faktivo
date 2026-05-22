import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * DSGVO Art. 15 + 20 — data access & portability.
 * Returns a JSON dump of all user data as a file download.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const tables = [
    "settings",
    "number_sequences",
    "clients",
    "quotes",
    "invoices",
    "line_items",
    "payments",
    "categories",
    "income_entries",
    "expense_entries",
    "jobcenter_reports",
    "document_archive",
    "audit_log",
    "attachments",
    "mahnungen",
    "onboarding_progress",
  ]

  const result: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    exported_by: {
      user_id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    format_version: 1,
    dsgvo_basis: "Art. 15 + Art. 20 DSGVO",
    tables: {},
  }

  for (const table of tables) {
    const { data } = await supabase.from(table).select("*").eq("user_id", user.id)
    ;(result.tables as Record<string, unknown>)[table] = data ?? []
  }

  const json = JSON.stringify(result, null, 2)
  const filename = `kolos-data-export-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
