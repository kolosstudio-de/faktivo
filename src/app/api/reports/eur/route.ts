import { NextResponse, type NextRequest } from "next/server"
import { renderToStream } from "@react-pdf/renderer"

import { createClient } from "@/lib/supabase/server"
import { EurPdf } from "@/lib/pdf/eur-pdf"
import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
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
  const yearParam = searchParams.get("year")
  const year = yearParam ? Number(yearParam) : new Date().getFullYear()
  const from = `${year}-01-01`
  const to = `${year}-12-31`

  const [settingsRes, invRes, incomeRes, expensesRes] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .gte("issue_date", from)
      .lte("issue_date", to)
      .not("status", "in", '("draft","cancelled")'),
    supabase
      .from("income_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("scope", "business")
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("expense_entries")
      .select("*, category:categories(*)")
      .eq("user_id", user.id)
      .eq("scope", "business")
      .gte("occurred_on", from)
      .lte("occurred_on", to),
  ])

  if (!settingsRes.data) {
    return NextResponse.json({ error: "no settings" }, { status: 500 })
  }

  const stream = await renderToStream(
    EurPdf({
      settings: settingsRes.data as Settings,
      year,
      invoices: (invRes.data ?? []) as Invoice[],
      extraIncome: (incomeRes.data ?? []) as IncomeEntry[],
      expenses: (expensesRes.data ?? []) as (ExpenseEntry & {
        category?: Category | null
      })[],
    })
  )

  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  const buffer = Buffer.concat(chunks)

  const filename = `Anlage-EUER-${year}.pdf`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
