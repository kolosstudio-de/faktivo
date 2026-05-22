/**
 * POST /api/jobcenter/documents/upload
 *
 * Body: multipart/form-data with:
 *   - file: File (PDF / JPG / PNG / WEBP / HEIC, ≤ 10 MB)
 *   - kind: "bewilligung" | "wba" | "eks_vorlaeufig" | "eks_endgueltig" | "vermoegen" | "other"
 *
 * Flow:
 *   1. CSRF + auth
 *   2. Validate file (size, mime)
 *   3. Upload to jobcenter-docs bucket
 *   4. INSERT row into jobcenter_documents
 *   5. Run AI parser (synchronous, ~10-30s)
 *   6. UPDATE row with parsed_data, parse_confidence, parse_warnings
 *   7. Return { ok, document_id, parsed_data, parse_confidence, warnings }
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"
import {
  parseJobcenterDocument,
  type DocumentKind,
  type ParsedDocument,
} from "@/lib/jobcenter/document-parser"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/x-pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
])
const ALLOWED_KINDS: DocumentKind[] = [
  "bewilligung",
  "wba",
  "eks_vorlaeufig",
  "eks_endgueltig",
  "vermoegen",
  "other",
]

function extFromName(name: string, fallback: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : fallback
}

function overallConfidence(parsed: ParsedDocument): number {
  const vals = Object.values(parsed.field_confidence ?? {})
  if (vals.length === 0) return 0
  const sum = vals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  return Math.round((sum / vals.length) * 100) / 100
}

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
      { status: 400 },
    )
  }

  const form = await request.formData()
  const file = form.get("file") as File | null
  const kindRaw = form.get("kind") as string | null

  if (!file) {
    return NextResponse.json(
      { ok: false, error: "NO_FILE", message: "missing 'file' field" },
      { status: 400 },
    )
  }
  if (!kindRaw || !ALLOWED_KINDS.includes(kindRaw as DocumentKind)) {
    return NextResponse.json(
      { ok: false, error: "BAD_KIND", message: `kind must be one of: ${ALLOWED_KINDS.join(", ")}` },
      { status: 400 },
    )
  }
  const kind = kindRaw as DocumentKind

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "FILE_TOO_LARGE",
        message: `File too large (${Math.round(file.size / 1024 / 1024)}MB > 10MB)`,
      },
      { status: 413 },
    )
  }

  const mime =
    file.type ||
    (file.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "application/octet-stream")
  if (!ALLOWED_MIMES.has(mime)) {
    return NextResponse.json(
      {
        ok: false,
        error: "WRONG_MIME",
        message: `Unsupported file type: ${mime}. Allowed: PDF, JPG, PNG, WEBP, HEIC.`,
      },
      { status: 415 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // ─── 1. Insert row to get an ID for the storage path ──────────────────
  const documentId = crypto.randomUUID()
  const ext = extFromName(file.name, mime === "application/pdf" ? "pdf" : "bin")
  const storagePath = `${user.id}/${documentId}.${ext}`

  // ─── 2. Upload to storage ─────────────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from("jobcenter-docs")
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: false,
    })

  if (uploadError) {
    console.error("[jc-docs/upload] storage upload failed:", uploadError)
    return NextResponse.json(
      {
        ok: false,
        error: "STORAGE_UPLOAD_FAILED",
        message: uploadError.message,
      },
      { status: 500 },
    )
  }

  // ─── 3. Insert DB row ─────────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from("jobcenter_documents")
    .insert({
      id: documentId,
      user_id: user.id,
      kind,
      filename: file.name,
      file_size_bytes: file.size,
      storage_path: storagePath,
    })

  if (insertError) {
    console.error("[jc-docs/upload] DB insert failed:", insertError)
    // Best-effort cleanup
    await supabase.storage.from("jobcenter-docs").remove([storagePath])
    return NextResponse.json(
      { ok: false, error: "DB_INSERT_FAILED", message: insertError.message },
      { status: 500 },
    )
  }

  // ─── 4. Run AI parser ─────────────────────────────────────────────────
  let parsed: ParsedDocument
  try {
    parsed = await parseJobcenterDocument(buffer, mime, kind)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI_PARSE_FAILED"
    const status =
      msg === "ANTHROPIC_API_KEY_MISSING"
        ? 503
        : msg === "AI_RATE_LIMIT"
          ? 429
          : msg === "UNSUPPORTED_MIME"
            ? 415
            : 502

    // Persist the failure so the user can see what they uploaded.
    await supabase
      .from("jobcenter_documents")
      .update({
        parsed_at: new Date().toISOString(),
        parse_warnings: [msg],
      })
      .eq("id", documentId)

    return NextResponse.json(
      {
        ok: false,
        error: msg,
        message:
          msg === "ANTHROPIC_API_KEY_MISSING"
            ? "Server misconfigured — ANTHROPIC_API_KEY missing"
            : msg === "AI_RATE_LIMIT"
              ? "AI rate limit hit — please retry in a few seconds"
              : msg === "UNSUPPORTED_MIME"
                ? "This file format is not supported by AI vision yet. Try PDF, JPG, or PNG."
                : "AI could not read the document",
        document_id: documentId,
      },
      { status },
    )
  }

  const confidence = overallConfidence(parsed)

  // ─── 5. Persist parse result ──────────────────────────────────────────
  const { error: updateError } = await supabase
    .from("jobcenter_documents")
    .update({
      parsed_at: new Date().toISOString(),
      parsed_data: parsed as unknown as Record<string, unknown>,
      parse_confidence: confidence,
      parse_warnings: parsed.warnings,
    })
    .eq("id", documentId)

  if (updateError) {
    console.error("[jc-docs/upload] DB update failed:", updateError)
    return NextResponse.json(
      {
        ok: false,
        error: "DB_UPDATE_FAILED",
        message: updateError.message,
        document_id: documentId,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    document_id: documentId,
    kind,
    parsed_data: parsed,
    parse_confidence: confidence,
    warnings: parsed.warnings,
  })
}
