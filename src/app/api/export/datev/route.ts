import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { generateExtf700 } from "@/lib/datev/extf700"
import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
  Payment,
  Settings,
} from "@/types/database.types"

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
  const today = new Date()
  const currentYear = today.getFullYear()
  const from = searchParams.get("from") ?? `${currentYear}-01-01`
  const to = searchParams.get("to") ?? `${currentYear}-12-31`

  const [settingsRes, invRes, payRes, expRes, incRes, catRes] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .gte("issue_date", from)
      .lte("issue_date", to)
      .not("locked_at", "is", null),
    supabase
      .from("payments")
      .select("*, invoice:invoices(number)")
      .eq("user_id", user.id)
      .gte("paid_at", from)
      .lte("paid_at", to),
    supabase
      .from("expense_entries")
      .select("*, category:categories(*)")
      .eq("user_id", user.id)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("income_entries")
      .select("*, category:categories(*)")
      .eq("user_id", user.id)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase.from("categories").select("*").eq("user_id", user.id),
  ])

  if (!settingsRes.data) {
    return NextResponse.json({ error: "no settings" }, { status: 500 })
  }

  const csv = generateExtf700({
    settings: settingsRes.data as Settings,
    invoices: (invRes.data ?? []) as Invoice[],
    payments: (payRes.data ?? []) as (Payment & {
      invoice?: { number: string | null } | null
    })[],
    expenses: (expRes.data ?? []) as (ExpenseEntry & {
      category?: Category | null
    })[],
    extraIncome: (incRes.data ?? []) as (IncomeEntry & {
      category?: Category | null
    })[],
    from,
    to,
  })

  const filename = `DATEV-EXTF700-${from}_${to}.csv`

  // BOM for Excel + DATEV Rechnungswesen
  const body = "\uFEFF" + csv

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
  // NOTE: `catRes` is fetched but not directly used by generator — categories
  // come embedded in the expense/income rows via the Supabase select().
  void catRes
}
