/**
 * DELETE /api/jobcenter/documents/[id]/delete
 *
 * Deletes the file from storage and the row from jobcenter_documents.
 * Does NOT cascade-delete an applied_to_report_id row — that's the user's
 * data and survives the document deletion.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/api/csrf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(
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

  // Fetch the row first so we know the storage path.
  const { data: doc } = await supabase
    .from("jobcenter_documents")
    .select("id, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: "document not found" },
      { status: 404 },
    )
  }

  // Best-effort storage delete — we still want to remove the row even if
  // the file was already gone.
  const { error: storageError } = await supabase.storage
    .from("jobcenter-docs")
    .remove([doc.storage_path])
  if (storageError) {
    console.warn("[jc-docs/delete] storage remove failed:", storageError)
  }

  const { error: dbError } = await supabase
    .from("jobcenter_documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (dbError) {
    return NextResponse.json(
      { ok: false, error: "DB_DELETE_FAILED", message: dbError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
