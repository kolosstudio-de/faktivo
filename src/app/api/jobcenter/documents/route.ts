/**
 * GET /api/jobcenter/documents
 *
 * Returns the user's most recently uploaded jobcenter documents,
 * including signed URLs for in-browser preview (storage is private).
 *
 * Query params:
 *   ?limit=N  (default 10, max 50)
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PREVIEW_TTL_SEC = 60 * 5 // 5 min

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limitRaw = Number(url.searchParams.get("limit") ?? "10")
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 10))

  const { data, error } = await supabase
    .from("jobcenter_documents")
    .select(
      "id, kind, filename, file_size_bytes, storage_path, uploaded_at, parsed_at, parsed_data, parse_confidence, parse_warnings, applied_at, applied_to_report_id",
    )
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json(
      { ok: false, error: "DB_QUERY_FAILED", message: error.message },
      { status: 500 },
    )
  }

  // Build signed URLs in parallel — keeps the list lightweight.
  const docs = await Promise.all(
    (data ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage
        .from("jobcenter-docs")
        .createSignedUrl(d.storage_path, PREVIEW_TTL_SEC)
      return {
        ...d,
        preview_url: signed?.signedUrl ?? null,
      }
    }),
  )

  return NextResponse.json({ ok: true, documents: docs })
}
