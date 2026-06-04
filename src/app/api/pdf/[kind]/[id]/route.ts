import { NextResponse, type NextRequest } from "next/server"
import { renderToStream } from "@react-pdf/renderer"
import { createHash } from "node:crypto"

import { createClient } from "@/lib/supabase/server"
import { DocumentPdf } from "@/lib/pdf/document-pdf"
import { generateGirocodeDataUrl } from "@/lib/pdf/sepa-girocode"
import { normalizeInvoiceLocale } from "@/lib/vat"
import type {
  Client,
  Invoice,
  LineItem,
  Quote,
  Settings,
} from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ kind: string; id: string }> }
) {
  const { kind, id } = await ctx.params
  if (kind !== "invoice" && kind !== "quote") {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const table = kind === "invoice" ? "invoices" : "quotes"

  const [docRes, linesRes, settingsRes] = await Promise.all([
    supabase.from(table).select("*").eq("id", id).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("parent_id", id)
      .eq("parent_kind", kind as "invoice" | "quote")
      .order("position"),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ])

  if (!docRes.data || !settingsRes.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const doc = docRes.data as Invoice | Quote
  const settings = settingsRes.data as Settings
  const lines = (linesRes.data ?? []) as LineItem[]

  // If an original PDF was uploaded (imported historical document),
  // serve that file verbatim instead of regenerating.
  if (doc.pdf_url && doc.pdf_url.startsWith(`${user.id}/`)) {
    const { data: blob, error } = await supabase.storage
      .from("documents")
      .download(doc.pdf_url)
    if (!error && blob) {
      const arrayBuf = await blob.arrayBuffer()
      const buf = Buffer.from(arrayBuf)
      const filename = `${kind === "invoice" ? "Rechnung" : "Angebot"}-${
        doc.number ?? "Import"
      }.pdf`
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(buf.length),
          "Content-Disposition": `inline; filename="${filename}"`,
          "Cache-Control": "no-store",
          "X-Source": "uploaded-original",
        },
      })
    }
    // If download failed, fall through to regeneration below.
  }

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", doc.client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: "client missing" }, { status: 500 })
  }

  // Generate SEPA-Girocode (DE-Standard QR für mobile Banking-Apps).
  // Nur für Rechnungen mit Betrag > 0 € und konfigurierter IBAN.
  let girocodeDataUrl: string | undefined
  if (kind === "invoice" && settings.iban && doc.total_cents > 0) {
    try {
      const issuerName =
        [settings.first_name, settings.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || settings.company_name
      girocodeDataUrl = await generateGirocodeDataUrl({
        name: issuerName,
        iban: settings.iban,
        bic: settings.bic ?? undefined,
        amount: doc.total_cents / 100,
        reference: doc.number ?? "Rechnung",
      })
    } catch {
      // Wenn QR-Generierung scheitert (z. B. ungültige IBAN) → einfach weglassen
      girocodeDataUrl = undefined
    }
  }

  // ─── Branding: logo / signature / stamp ────────────────────────────────
  // Logo lives in public bucket → URL is already public.
  // Signature + Stamp live in private buckets → if `signature_url`/`stamp_url`
  // is a stored public-bucket URL we use it; if it's a long-lived signed URL
  // (1y from upload) we use it; otherwise we attempt to derive a fresh signed
  // URL (1h) for react-pdf to fetch. Fail-soft: missing/invalid → just skip.
  const logoUrl = settings.logo_url ?? undefined

  let signatureDataUrl: string | undefined
  if (settings.signature_url && (doc as Invoice | Quote).show_signature) {
    signatureDataUrl = await freshenIfPrivate(
      supabase,
      "signatures",
      settings.signature_url
    )
  }

  let stampDataUrl: string | undefined
  if (settings.stamp_url && (doc as Invoice | Quote).show_stamp) {
    stampDataUrl = await freshenIfPrivate(
      supabase,
      "stamps",
      settings.stamp_url
    )
  }

  // Locale-Priorität: Query-Param `?locale=` (z. B. wenn Frontend einen Test-
  // Render in anderer Sprache anstößt) > `settings.invoice_language_default`
  // > "de" (Default per Gesetz). normalizeInvoiceLocale fängt Garbage ab.
  const localeFromQuery = new URL(request.url).searchParams.get("locale")
  const invoiceLocale = normalizeInvoiceLocale(
    localeFromQuery ?? settings.invoice_language_default
  )

  const pdfStream = await renderToStream(
    DocumentPdf({
      kind: kind as "invoice" | "quote",
      doc,
      lines,
      client: client as Client,
      settings,
      girocodeDataUrl,
      logoUrl,
      signatureDataUrl,
      showSignature: Boolean((doc as Invoice | Quote).show_signature),
      stampDataUrl,
      showStamp: Boolean((doc as Invoice | Quote).show_stamp),
      locale: invoiceLocale,
    })
  )

  // Collect into buffer so we can hash + send known content-length
  const chunks: Buffer[] = []
  for await (const chunk of pdfStream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  const buffer = Buffer.concat(chunks)
  const hash = createHash("sha256").update(buffer).digest("hex")

  // For locked invoices, persist the hash (fire-and-forget)
  if (kind === "invoice") {
    const inv = doc as Invoice
    if (inv.locked_at && !inv.pdf_hash) {
      void supabase
        .from("invoices")
        .update({ pdf_hash: hash })
        .eq("id", inv.id)
    }
  }

  const filename = `${kind === "invoice" ? "Rechnung" : "Angebot"}-${
    doc.number ?? "Entwurf"
  }.pdf`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-PDF-Sha256": hash,
    },
  })
}

/**
 * Refresh a possibly-expired signed URL for a private bucket asset.
 *
 * `storedUrl` may be:
 *  - a long-lived signed URL (created at upload time, 1 year validity) →
 *    we extract the path inside the bucket and create a fresh 1h signed URL
 *    so react-pdf can fetch the image during PDF render.
 *  - any other URL we don't recognise → we return it verbatim. If react-pdf
 *    fails to fetch it, the image is silently omitted (no crash).
 */
async function freshenIfPrivate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  bucket: "signatures" | "stamps",
  storedUrl: string
): Promise<string | undefined> {
  try {
    const m = storedUrl.match(new RegExp(`/${bucket}/([^?]+)`))
    if (!m || !m[1]) return storedUrl
    const path = decodeURIComponent(m[1])
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) return storedUrl
    return data.signedUrl as string
  } catch {
    return storedUrl
  }
}
