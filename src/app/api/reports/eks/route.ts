import { NextResponse, type NextRequest } from "next/server"
import { renderToStream } from "@react-pdf/renderer"
import { endOfMonth, startOfMonth } from "date-fns"

import { createClient } from "@/lib/supabase/server"
import { EksPdf } from "@/lib/pdf/eks-pdf"
import type {
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
  const monthParam = searchParams.get("month") // YYYY-MM-01
  const fromParam = searchParams.get("from") // YYYY-MM-DD
  const toParam = searchParams.get("to") // YYYY-MM-DD

  let periodStart: string
  let periodEnd: string
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (fromParam && toParam && ymd.test(fromParam) && ymd.test(toParam)) {
    periodStart = fromParam
    periodEnd = toParam
  } else {
    const base = monthParam ? new Date(monthParam) : new Date()
    periodStart = startOfMonth(base).toISOString().slice(0, 10)
    periodEnd = endOfMonth(base).toISOString().slice(0, 10)
  }

  const [settingsRes, invRes, incomeRes, expensesRes] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd)
      .not("status", "in", '("draft","cancelled")'),
    supabase
      .from("income_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("scope", "business")
      .eq("jobcenter_relevant", true)
      .gte("occurred_on", periodStart)
      .lte("occurred_on", periodEnd),
    supabase
      .from("expense_entries")
      .select("*, category:categories(name, is_jobcenter_relevant)")
      .eq("user_id", user.id)
      .eq("scope", "business")
      .gte("occurred_on", periodStart)
      .lte("occurred_on", periodEnd),
  ])

  if (!settingsRes.data) {
    return NextResponse.json({ error: "no settings" }, { status: 500 })
  }

  const stream = await renderToStream(
    EksPdf({
      settings: settingsRes.data as Settings,
      periodStart,
      periodEnd,
      invoices: (invRes.data ?? []) as Invoice[],
      extraIncome: (incomeRes.data ?? []) as IncomeEntry[],
      expenses: (expensesRes.data ?? []) as (ExpenseEntry & {
        category?: {
          name?: string
          is_jobcenter_relevant?: boolean
        } | null
      })[],
    })
  )

  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  const buffer = Buffer.concat(chunks)

  const filename =
    periodStart.slice(0, 7) === periodEnd.slice(0, 7)
      ? `Anlage-EKS-${periodStart.slice(0, 7)}.pdf`
      : `Anlage-EKS-${periodStart.slice(0, 7)}_to_${periodEnd.slice(0, 7)}.pdf`

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
