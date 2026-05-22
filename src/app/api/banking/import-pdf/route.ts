/**
 * POST /api/banking/import-pdf
 *
 * Body: multipart/form-data with "pdf" (File).
 *
 * Flow:
 *   1. Auth check.
 *   2. Read file → Buffer; reject if > 5 MB or not application/pdf.
 *   3. Extract text via pdfjs-dist.
 *   4. If text length < 200 → respond with PDF_TEXT_TOO_SHORT (likely
 *      a scan without OCR layer; OCR fallback is Phase 2).
 *   5. Send text to Claude Haiku → ParsedStatement.
 *   6. Return preview to client. Persistence happens client-side
 *      after the user confirms (mirrors the CSV-import flow).
 *
 * The route NEVER writes to bank_transactions. The client uses the
 * supabase JS client to bulk-insert after the user confirms in the
 * preview UI.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import { extractPdfText } from "@/lib/banking/pdf-extractor"
import { parseStatementWithClaude } from "@/lib/banking/pdf-statement-parser"
import { classifyTransactions } from "@/lib/banking/transaction-classifier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const MIN_EXTRACTED_CHARS = 200

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

  const ct = request.headers.get("content-type") ?? ""
  if (!ct.includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST", message: "expected multipart/form-data" },
      { status: 400 }
    )
  }

  const form = await request.formData()
  const file = form.get("pdf") as File | null
  if (!file) {
    return NextResponse.json(
      { ok: false, error: "NO_FILE", message: "missing 'pdf' field" },
      { status: 400 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "PDF_TOO_LARGE",
        message: `PDF too large (${Math.round(file.size / 1024 / 1024)}MB > 5MB)`,
      },
      { status: 413 }
    )
  }
  // Some browsers send "application/octet-stream" or empty type; check by name too.
  const looksPdf =
    file.type === "application/pdf" ||
    file.type === "application/x-pdf" ||
    file.name?.toLowerCase().endsWith(".pdf")
  if (!looksPdf) {
    return NextResponse.json(
      {
        ok: false,
        error: "NOT_A_PDF",
        message: `expected application/pdf, got ${file.type || "unknown"}`,
      },
      { status: 415 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let extracted
  try {
    extracted = await extractPdfText(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PDF_EXTRACTION_FAILED"
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        message: "PDF konnte nicht gelesen werden",
      },
      { status: 422 }
    )
  }

  if (extracted.text.trim().length < MIN_EXTRACTED_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        error: "PDF_TEXT_TOO_SHORT",
        message:
          "PDF appears to be a scan without text layer. OCR not yet supported.",
        pages: extracted.pages,
      },
      { status: 422 }
    )
  }

  let statement
  try {
    statement = await parseStatementWithClaude(extracted.text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI_PARSE_FAILED"
    const status =
      msg === "ANTHROPIC_API_KEY_MISSING"
        ? 503
        : msg === "AI_RATE_LIMIT"
          ? 429
          : 502
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        message:
          msg === "ANTHROPIC_API_KEY_MISSING"
            ? "Server misconfigured — ANTHROPIC_API_KEY missing"
            : msg === "AI_RATE_LIMIT"
              ? "AI rate limit hit — please retry in a few seconds"
              : "AI could not understand the PDF",
      },
      { status }
    )
  }

  // ─── Classify transactions (rules → AI fallback) ──────────────────────
  let enrichedTxs = statement.transactions as Array<
    (typeof statement.transactions)[number] & {
      suggested_category_id?: string | null
      suggested_category_name?: string
      suggested_scope?: "business" | "personal"
      suggestion_source?: "rule" | "ai" | "none"
      suggestion_confidence?: number
      suggestion_reason?: string
      is_buergergeld?: boolean
    }
  >
  try {
    const classifications = await classifyTransactions(
      user.id,
      statement.transactions.map((tx) => ({
        counterparty: tx.counterparty,
        reference: tx.reference,
        amount_cents: tx.amount_cents,
        description: tx.description,
      })),
      supabase,
    )
    enrichedTxs = statement.transactions.map((tx, i) => {
      const c = classifications[i]
      return {
        ...tx,
        suggested_category_id: c?.category_id ?? null,
        suggested_category_name: c?.category_name,
        suggested_scope: c?.scope,
        suggestion_source: c?.source,
        suggestion_confidence: c?.confidence,
        suggestion_reason: c?.reason,
        is_buergergeld: c?.is_buergergeld === true,
      }
    })
  } catch (err) {
    console.warn("[import-pdf] classification failed, returning raw:", err)
  }

  return NextResponse.json({
    ok: true,
    pages: extracted.pages,
    statement: { ...statement, transactions: enrichedTxs },
  })
}
