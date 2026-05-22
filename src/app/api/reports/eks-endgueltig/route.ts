/**
 * GET /api/reports/eks-endgueltig
 *
 * Generiert den Endgültigen-EKS-Bescheid-Anhang als PDF für den BWZ aus den
 * Settings. Vergleicht Prognose (settings.vorlaeufige_prognose_jsonb) mit
 * Ist-Einkünften (Rechnungen + income_entries − jobcenter-relevant expenses).
 */

import { NextResponse, type NextRequest } from "next/server"
import { renderToStream } from "@react-pdf/renderer"

import { createClient } from "@/lib/supabase/server"
import { EksEndgueltigPdf } from "@/lib/pdf/eks-endgueltig-pdf"
import { calcRueckforderung, type MonthlyEinkommen } from "@/lib/jobcenter"
import type { Settings } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function bwzMonths(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(start + "T00:00:00Z")
  const e = new Date(end + "T00:00:00Z")
  const cursor = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1))
  while (cursor <= e) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return out
}

export async function GET(request: NextRequest) {
  void request

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const settingsRes = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
  const settings = settingsRes.data as Settings | null

  if (
    !settings?.bewilligungszeitraum_start ||
    !settings?.bewilligungszeitraum_end
  ) {
    return NextResponse.json(
      { error: "Bewilligungszeitraum nicht hinterlegt" },
      { status: 400 }
    )
  }
  if (!settings.buergergeld_bedarf_monatlich_cents) {
    return NextResponse.json(
      { error: "Monatlicher Bedarf nicht hinterlegt" },
      { status: 400 }
    )
  }

  const bwzStart = settings.bewilligungszeitraum_start
  const bwzEnd = settings.bewilligungszeitraum_end
  const months = bwzMonths(bwzStart, bwzEnd)

  // Ist-Einkommen: Rechnungen + income_entries − jobcenter-relevante Ausgaben
  const [invRes, incomeRes, expenseRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("issue_date, total_cents, status")
      .eq("user_id", user.id)
      .gte("issue_date", bwzStart)
      .lte("issue_date", bwzEnd)
      .not("status", "in", '("draft","cancelled")'),
    supabase
      .from("income_entries")
      .select("occurred_on, amount_cents")
      .eq("user_id", user.id)
      .eq("scope", "business")
      .eq("jobcenter_relevant", true)
      .gte("occurred_on", bwzStart)
      .lte("occurred_on", bwzEnd),
    supabase
      .from("expense_entries")
      .select(
        "occurred_on, amount_cents, is_deductible, category:categories(is_jobcenter_relevant)"
      )
      .eq("user_id", user.id)
      .eq("scope", "business")
      .gte("occurred_on", bwzStart)
      .lte("occurred_on", bwzEnd),
  ])

  type ExpRow = {
    occurred_on: string
    amount_cents: number
    is_deductible: boolean
    category: { is_jobcenter_relevant: boolean } | null
  }

  const monthKey = (d: string) => d.slice(0, 7) + "-01"
  const istMap = new Map<string, number>(months.map((m) => [m, 0]))

  for (const i of invRes.data ?? []) {
    const k = monthKey(i.issue_date as string)
    if (istMap.has(k)) {
      istMap.set(k, (istMap.get(k) ?? 0) + (i.total_cents as number))
    }
  }
  for (const e of incomeRes.data ?? []) {
    const k = monthKey(e.occurred_on as string)
    if (istMap.has(k)) {
      istMap.set(k, (istMap.get(k) ?? 0) + (e.amount_cents as number))
    }
  }
  for (const e of (expenseRes.data ?? []) as unknown as ExpRow[]) {
    if (!e.is_deductible) continue
    if (e.category && e.category.is_jobcenter_relevant === false) continue
    const k = monthKey(e.occurred_on)
    if (istMap.has(k)) {
      istMap.set(k, (istMap.get(k) ?? 0) - e.amount_cents)
    }
  }

  const ist: MonthlyEinkommen[] = months.map((m) => ({
    month: m,
    einkommenCents: Math.max(0, istMap.get(m) ?? 0),
  }))

  const prognoseRaw = (settings.vorlaeufige_prognose_jsonb ?? {}) as Record<
    string,
    number
  >
  const prognose: MonthlyEinkommen[] = months.map((m) => ({
    month: m,
    einkommenCents: prognoseRaw[m] ?? 0,
  }))

  const rueckforderung = calcRueckforderung({
    bedarfMonatlichCents: settings.buergergeld_bedarf_monatlich_cents,
    prognose,
    ist,
    hasMinorChildren: settings.has_minor_children,
  })

  const stream = await renderToStream(
    EksEndgueltigPdf({
      settings,
      bwzStart,
      bwzEnd,
      rueckforderung,
      hasMinorChildren: settings.has_minor_children,
    })
  )
  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  const buffer = Buffer.concat(chunks)

  const filename = `Endgueltige-EKS-${bwzStart}-${bwzEnd}.pdf`
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
