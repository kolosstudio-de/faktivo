/**
 * POST /api/jobcenter/documents/[id]/apply
 *
 * Body (optional JSON): { overrides?: Partial<ParsedDocument> }
 *   — lets the user edit AI-extracted values before applying.
 *
 * For kind=bewilligung:
 *   UPDATE settings with extracted fields (only when field_confidence > 70 OR override provided).
 *
 * For kind=eks_vorlaeufig / kind=eks_endgueltig:
 *   UPSERT jobcenter_reports row with kind='vorlaeufig' (or 'endgueltig')
 *   and the monthly prognose payload.
 *
 * Sets applied_at = now() and (for EKS) applied_to_report_id.
 *
 * Returns { ok, applied_fields: string[], report_id?: string }.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import type {
  ParsedBewilligung,
  ParsedEksVorlaeufig,
  DocumentKind,
} from "@/lib/jobcenter/document-parser"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HIGH_CONFIDENCE = 70

interface ApplyBody {
  overrides?: Record<string, unknown>
}

function pick<T>(
  override: unknown,
  fallback: T,
  confidence: number | undefined,
): { value: T; used: boolean } {
  if (override !== undefined && override !== null) {
    return { value: override as T, used: true }
  }
  if (
    fallback !== null &&
    fallback !== undefined &&
    typeof confidence === "number" &&
    confidence >= HIGH_CONFIDENCE
  ) {
    return { value: fallback, used: true }
  }
  return { value: fallback as T, used: false }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = validateOrigin(request)
  if (originError) return originError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST", message: "missing document id" },
      { status: 400 },
    )
  }

  let body: ApplyBody = {}
  try {
    const text = await request.text()
    if (text.trim().length > 0) {
      body = JSON.parse(text) as ApplyBody
    }
  } catch {
    body = {}
  }
  const overrides = body.overrides ?? {}

  // Fetch the document row
  const { data: doc, error: fetchError } = await supabase
    .from("jobcenter_documents")
    .select("id, user_id, kind, parsed_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError || !doc) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: "document not found" },
      { status: 404 },
    )
  }

  if (!doc.parsed_data) {
    return NextResponse.json(
      { ok: false, error: "NOT_PARSED", message: "document has no AI-extracted data" },
      { status: 409 },
    )
  }

  const parsed = doc.parsed_data as Record<string, unknown>
  const kind = doc.kind as DocumentKind
  const confidence =
    (parsed.field_confidence as Record<string, number> | undefined) ?? {}

  // ─── Branch 1: Bewilligungsbescheid → patch settings ──────────────────
  if (kind === "bewilligung" || kind === "wba") {
    const b = parsed as unknown as ParsedBewilligung
    const updates: Record<string, unknown> = {}
    const applied: string[] = []

    const bwzStart = pick(
      overrides.bewilligungszeitraum_start,
      b.bewilligungszeitraum_start,
      confidence.bewilligungszeitraum_start,
    )
    if (bwzStart.used && bwzStart.value) {
      updates.bewilligungszeitraum_start = bwzStart.value
      applied.push("bewilligungszeitraum_start")
    }

    const bwzEnd = pick(
      overrides.bewilligungszeitraum_end,
      b.bewilligungszeitraum_end,
      confidence.bewilligungszeitraum_end,
    )
    if (bwzEnd.used && bwzEnd.value) {
      updates.bewilligungszeitraum_end = bwzEnd.value
      applied.push("bewilligungszeitraum_end")
    }

    const stufe = pick(
      overrides.regelbedarf_stufe,
      b.regelbedarf_stufe,
      confidence.regelbedarf_stufe,
    )
    if (stufe.used && stufe.value) {
      updates.regelbedarf_stufe = stufe.value
      applied.push("regelbedarf_stufe")
    }

    const bedarf = pick(
      overrides.buergergeld_bedarf_monatlich_cents,
      b.buergergeld_bedarf_monatlich_cents,
      confidence.buergergeld_bedarf_monatlich_cents,
    )
    if (bedarf.used && bedarf.value) {
      updates.buergergeld_bedarf_monatlich_cents = bedarf.value
      applied.push("buergergeld_bedarf_monatlich_cents")
    }

    const bgNr = pick(
      overrides.bg_nummer,
      b.bg_nummer,
      confidence.bg_nummer,
    )
    if (bgNr.used && bgNr.value) {
      updates.jobcenter_bg_nummer = bgNr.value
      applied.push("jobcenter_bg_nummer")
    }

    const jcName = pick(
      overrides.jobcenter_name,
      b.jobcenter_name,
      confidence.jobcenter_name,
    )
    if (jcName.used && jcName.value) {
      updates.jobcenter_name = jcName.value
      applied.push("jobcenter_name")
    }

    const kids = pick(
      overrides.has_minor_children,
      b.has_minor_children,
      confidence.has_minor_children,
    )
    if (kids.used && kids.value !== null) {
      updates.has_minor_children = kids.value
      applied.push("has_minor_children")
    }

    // Always flip receives_buergergeld to true — they uploaded a notice.
    updates.receives_buergergeld = true

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        ok: true,
        applied_fields: [],
        message: "Nothing high-confidence to apply",
      })
    }

    const { error: settingsError } = await supabase
      .from("settings")
      .update(updates)
      .eq("user_id", user.id)

    if (settingsError) {
      return NextResponse.json(
        {
          ok: false,
          error: "SETTINGS_UPDATE_FAILED",
          message: settingsError.message,
        },
        { status: 500 },
      )
    }

    await supabase
      .from("jobcenter_documents")
      .update({ applied_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({
      ok: true,
      applied_fields: applied,
      kind: "bewilligung",
    })
  }

  // ─── Branch 2: EKS → upsert jobcenter_reports ────────────────────────
  if (kind === "eks_vorlaeufig" || kind === "eks_endgueltig") {
    const e = parsed as unknown as ParsedEksVorlaeufig

    // Allow user override for BWZ and monthly rows.
    const bwzStart =
      (overrides.bewilligungszeitraum_start as string | undefined) ??
      e.bewilligungszeitraum_start
    const bwzEnd =
      (overrides.bewilligungszeitraum_end as string | undefined) ??
      e.bewilligungszeitraum_end

    if (!bwzStart || !bwzEnd) {
      return NextResponse.json(
        {
          ok: false,
          error: "BWZ_MISSING",
          message: "Bewilligungszeitraum could not be extracted — please fill it in manually",
        },
        { status: 422 },
      )
    }

    const monthly =
      (overrides.monthly_prognose as ParsedEksVorlaeufig["monthly_prognose"] | undefined) ??
      e.monthly_prognose ??
      []

    const reportKind = kind === "eks_vorlaeufig" ? "vorlaeufig" : "endgueltig"

    const totalEinnahmen = monthly.reduce((s, r) => s + r.einnahmen_cents, 0)
    const totalAusgaben = monthly.reduce((s, r) => s + r.ausgaben_cents, 0)
    const totalSaldo = Math.max(0, totalEinnahmen - totalAusgaben)

    const prognosePayload = {
      months: monthly.map((r) => ({
        month: r.month,
        einnahmenCents: r.einnahmen_cents,
        ausgabenCents: r.ausgaben_cents,
      })),
    }

    // Upsert: try to find existing matching report first.
    const existing = await supabase
      .from("jobcenter_reports")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", reportKind)
      .eq("period_start", bwzStart)
      .eq("period_end", bwzEnd)
      .maybeSingle()

    let reportId: string | null = null
    if (existing.data?.id) {
      const { error: updError } = await supabase
        .from("jobcenter_reports")
        .update({
          income_cents: totalEinnahmen,
          expenses_cents: totalAusgaben,
          net_cents: totalSaldo,
          prognose_payload: prognosePayload,
          payload: {} as Record<string, unknown>,
          status: "draft",
        })
        .eq("id", existing.data.id)
      if (updError) {
        return NextResponse.json(
          { ok: false, error: "REPORT_UPDATE_FAILED", message: updError.message },
          { status: 500 },
        )
      }
      reportId = existing.data.id
    } else {
      const { data: ins, error: insError } = await supabase
        .from("jobcenter_reports")
        .insert({
          user_id: user.id,
          period_start: bwzStart,
          period_end: bwzEnd,
          kind: reportKind,
          income_cents: totalEinnahmen,
          expenses_cents: totalAusgaben,
          net_cents: totalSaldo,
          prognose_payload: prognosePayload,
          payload: {} as Record<string, unknown>,
          status: "draft",
        })
        .select("id")
        .single()
      if (insError || !ins) {
        return NextResponse.json(
          { ok: false, error: "REPORT_INSERT_FAILED", message: insError?.message },
          { status: 500 },
        )
      }
      reportId = ins.id as string
    }

    await supabase
      .from("jobcenter_documents")
      .update({
        applied_at: new Date().toISOString(),
        applied_to_report_id: reportId,
      })
      .eq("id", id)
      .eq("user_id", user.id)

    return NextResponse.json({
      ok: true,
      applied_fields: ["bewilligungszeitraum_start", "bewilligungszeitraum_end", "monthly_prognose"],
      kind: reportKind,
      report_id: reportId,
    })
  }

  // ─── Branch 3: other kinds (vermoegen, other) ────────────────────────
  // Nothing to apply automatically — just mark as reviewed.
  await supabase
    .from("jobcenter_documents")
    .update({ applied_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)

  return NextResponse.json({
    ok: true,
    applied_fields: [],
    kind,
    message: "Document acknowledged. No fields applied automatically for this kind.",
  })
}
