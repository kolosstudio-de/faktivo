/**
 * GET /api/reports/eks-vorlaeufig
 *
 * Generates the Vorläufige Anlage EKS PDF (start of BWZ).
 *
 * Two modes:
 *
 *   1. `?report_id=UUID` — load a saved vorläufig report from
 *      `jobcenter_reports` (kind='vorlaeufig'). Period + months come from
 *      that row.
 *
 *   2. `?from=YYYY-MM-DD&to=YYYY-MM-DD` — derive period from query and use
 *      the latest vorläufig report whose period matches (or fall back to
 *      settings.vorlaeufige_prognose_jsonb if no saved row).
 *
 *   3. No params — use the user's current BWZ from settings + the most
 *      recently saved vorläufig report for that BWZ.
 */

import { NextResponse, type NextRequest } from "next/server"
import { renderToStream } from "@react-pdf/renderer"

import { createClient } from "@/lib/supabase/server"
import { EksVorlaeufigPdf } from "@/lib/pdf/eks-vorlaeufig-pdf"
import type {
  EksPrognoseMonth,
  EksPrognosePayload,
  JobcenterReport,
  Settings,
} from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get("report_id")
  const fromParam = searchParams.get("from")
  const toParam = searchParams.get("to")

  // ─── Load settings (we always need them for header). ────────────────────
  const settingsRes = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
  const settings = settingsRes.data as Settings | null
  if (!settings) {
    return NextResponse.json({ error: "settings_missing" }, { status: 400 })
  }

  // ─── Resolve period + months ────────────────────────────────────────────
  let periodStart: string | null = null
  let periodEnd: string | null = null
  let months: EksPrognoseMonth[] = []

  if (reportId) {
    const r = await supabase
      .from("jobcenter_reports")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", reportId)
      .single()
    if (!r.data) {
      return NextResponse.json({ error: "report_not_found" }, { status: 404 })
    }
    const row = r.data as JobcenterReport
    periodStart = row.period_start
    periodEnd = row.period_end
    months = (row.prognose_payload as EksPrognosePayload | null)?.months ?? []
  } else if (fromParam && toParam && ISO_DATE.test(fromParam) && ISO_DATE.test(toParam)) {
    periodStart = fromParam
    periodEnd = toParam
  } else if (
    settings.bewilligungszeitraum_start &&
    settings.bewilligungszeitraum_end
  ) {
    periodStart = settings.bewilligungszeitraum_start
    periodEnd = settings.bewilligungszeitraum_end
  }

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      { error: "period_unresolved" },
      { status: 400 }
    )
  }

  // If months still empty, try to load the latest saved vorläufig report for
  // this period — that's the user's most recent prognose.
  if (months.length === 0) {
    const r = await supabase
      .from("jobcenter_reports")
      .select("*")
      .eq("user_id", user.id)
      .eq("kind", "vorlaeufig")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (r.data) {
      months =
        ((r.data as JobcenterReport).prognose_payload as
          | EksPrognosePayload
          | null
        )?.months ?? []
    }
  }

  // Final fallback: derive prognose from settings.vorlaeufige_prognose_jsonb
  // (legacy storage used by JobcenterRechner). Treat ausgaben as 0.
  if (months.length === 0) {
    const monthsIso = bwzMonths(periodStart, periodEnd)
    const legacy = (settings.vorlaeufige_prognose_jsonb ?? {}) as Record<
      string,
      number
    >
    months = monthsIso.map((m) => ({
      month: m,
      einnahmenCents: legacy[m] ?? 0,
      ausgabenCents: 0,
    }))
  }

  // Ensure months are sorted ascending.
  months = [...months].sort((a, b) => a.month.localeCompare(b.month))

  const stream = await renderToStream(
    EksVorlaeufigPdf({
      settings,
      bwzStart: periodStart,
      bwzEnd: periodEnd,
      months,
    })
  )
  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  const buffer = Buffer.concat(chunks)

  const filename = `Vorlaeufige-EKS-${periodStart}-${periodEnd}.pdf`
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
