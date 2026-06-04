/**
 * GET /api/export/steuerberater-zip?year=2026
 *
 * Erstellt ein ZIP-Paket für den Steuerberater mit:
 *   /rechnungen/RE-2026-NNNN.pdf       — alle finalisierten Rechnungen
 *   /belege/{filename}.{ext}            — alle Belege
 *   /datev/buchungen-2026.csv           — DATEV EXTF 700 Export
 *   /eur/eur-2026.pdf                   — Anlage EÜR PDF
 *   /eks/                               — Anlage EKS PDFs (wenn Aufstocker)
 *   README.txt                          — Was ist drin + Anleitung
 *
 * Output-Streaming (Stand 2026-06-04)
 * -----------------------------------
 * Vorher: `zip.generateAsync({type:"nodebuffer"})` baute den ganzen Archiv
 * zuerst im RAM zusammen, danach sandte man `new NextResponse(buffer)` —
 * d.h. Peak-Memory war ≈ 2× Archivgröße (alle Eingabe-Buffer im JSZip-Tree
 * PLUS der finale Output-Buffer). Bei einem Jahres-Paket mit ~1000 PDFs
 * + Belegen knackte das die 1-GB-Hobby-Grenze von Vercel.
 *
 * Jetzt: `zip.generateNodeStream({streamFiles:true})` emittiert Chunks,
 * sobald sie komprimiert sind. Wir wickeln den Node-Readable in einen
 * Web-ReadableStream (`Readable.toWeb`) und geben den direkt an die
 * Response zurück. Damit:
 *   - kein nodebuffer-Assembly mehr → Output-Peak entfällt
 *   - Chunked Transfer-Encoding → Browser kann progress-bar zeigen
 *   - Memory-Peak halbiert (nur noch die Eingabe-Buffer im JSZip-Tree)
 *
 * Echte Entry-by-Entry-Streaming (so dass nicht mal alle PDFs auf einmal
 * im RAM sind) erfordert `archiver`/`zip-stream` und ist in
 * `.planning/REMAINING-TODOS.md` TODO 2 dokumentiert. Reicht für Vasyls
 * aktuelles Datenvolumen + Vercel-Hobby; ab ~5000 Belegen pro Jahr lohnt
 * sich der vollständige Refactor.
 */

import { NextResponse, type NextRequest } from "next/server"
import { Readable } from "node:stream"
import JSZip from "jszip"
import { renderToStream } from "@react-pdf/renderer"

import { createClient } from "@/lib/supabase/server"
import { DocumentPdf } from "@/lib/pdf/document-pdf"
import type {
  Client,
  ExpenseEntry,
  Invoice,
  LineItem,
  Settings,
} from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function streamToBuffer(
  stream: AsyncIterable<Buffer | string>
): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const yearStr = url.searchParams.get("year") ?? String(new Date().getFullYear())
  const year = Number(yearStr)
  if (!year) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 })
  }
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const zip = new JSZip()

  // ─── README ──────────────────────────────────────────────────────────
  zip.file(
    "README.txt",
    `Steuerberater-Paket ${year}
========================================

Inhalt:
  /rechnungen/  — alle finalisierten Ausgangsrechnungen (PDF)
  /belege/      — Eingangs-Belege (Quittungen, Rechnungen)
  /datev/       — DATEV-CSV (EXTF 700) für Import in Datev Rechnungswesen
  /eur/         — Anlage EÜR (Einnahmen-Überschuss-Rechnung) PDF
  /eks/         — Anlage EKS für Jobcenter (wenn Aufstocker)

Erstellt mit Kolos Digital Finanzen am ${new Date().toLocaleDateString("de-DE")}.

§14 UStG / §147 AO / GoBD-konform.
`
  )

  // ─── Settings + Identität ───────────────────────────────────────────
  const { data: settingsData } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
  const settings = settingsData as Settings | null

  // ─── Rechnungen + PDFs ──────────────────────────────────────────────
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .gte("issue_date", yearStart)
    .lte("issue_date", yearEnd)
    .not("status", "in", '("draft","cancelled")')
    .order("issue_date")

  let rechnungenCount = 0
  for (const inv of (invoices ?? []) as Invoice[]) {
    if (!inv.number) continue
    try {
      const [linesRes, clientRes] = await Promise.all([
        supabase
          .from("line_items")
          .select("*")
          .eq("parent_id", inv.id)
          .eq("parent_kind", "invoice")
          .order("position"),
        supabase.from("clients").select("*").eq("id", inv.client_id).single(),
      ])
      const lines = (linesRes.data ?? []) as LineItem[]
      const client = clientRes.data as Client | null
      if (!client || !settings) continue

      const stream = await renderToStream(
        DocumentPdf({
          kind: "invoice",
          doc: inv,
          lines,
          client,
          settings,
        })
      )
      const buf = await streamToBuffer(
        stream as unknown as AsyncIterable<Buffer | string>
      )
      zip.file(`rechnungen/${inv.number}.pdf`, buf)
      rechnungenCount++
    } catch (e) {
      console.warn("ZIP: skip invoice", inv.number, e)
    }
  }

  // ─── Belege (Storage download) ──────────────────────────────────────
  const { data: expenses } = await supabase
    .from("expense_entries")
    .select("id, occurred_on, vendor, amount_cents, attachment_url")
    .eq("user_id", user.id)
    .eq("scope", "business")
    .gte("occurred_on", yearStart)
    .lte("occurred_on", yearEnd)
    .not("attachment_url", "is", null)

  let belegeCount = 0
  for (const e of (expenses ?? []) as Pick<
    ExpenseEntry,
    "id" | "occurred_on" | "vendor" | "amount_cents" | "attachment_url"
  >[]) {
    if (!e.attachment_url) continue
    try {
      const { data: blob } = await supabase.storage
        .from("belege")
        .download(e.attachment_url)
      if (!blob) continue
      const ext = e.attachment_url.split(".").pop() ?? "pdf"
      const safe = (e.vendor ?? "beleg").replace(/[^a-z0-9]/gi, "_").slice(0, 30)
      const filename = `belege/${e.occurred_on}_${safe}_${e.id.slice(0, 8)}.${ext}`
      const buf = Buffer.from(await blob.arrayBuffer())
      zip.file(filename, buf)
      belegeCount++
    } catch (err) {
      console.warn("ZIP: skip beleg", e.id, err)
    }
  }

  // ─── DATEV-CSV ──────────────────────────────────────────────────────
  try {
    const datevRes = await fetch(
      `${url.origin}/api/export/datev?year=${year}`,
      { headers: { cookie: request.headers.get("cookie") ?? "" } }
    )
    if (datevRes.ok) {
      const csvText = await datevRes.text()
      zip.file(`datev/buchungen-${year}.csv`, csvText)
    }
  } catch (e) {
    console.warn("ZIP: skip DATEV", e)
  }

  // ─── EÜR-PDF ────────────────────────────────────────────────────────
  try {
    const eurRes = await fetch(
      `${url.origin}/api/reports/eur?year=${year}`,
      { headers: { cookie: request.headers.get("cookie") ?? "" } }
    )
    if (eurRes.ok) {
      const buf = Buffer.from(await eurRes.arrayBuffer())
      zip.file(`eur/eur-${year}.pdf`, buf)
    }
  } catch (e) {
    console.warn("ZIP: skip EÜR", e)
  }

  // ─── EKS-PDFs (12 Monate) wenn Aufstocker ───────────────────────────
  if (settings?.receives_buergergeld) {
    for (let m = 1; m <= 12; m++) {
      const month = `${year}-${String(m).padStart(2, "0")}-01`
      try {
        const eksRes = await fetch(
          `${url.origin}/api/reports/eks?month=${month}`,
          { headers: { cookie: request.headers.get("cookie") ?? "" } }
        )
        if (eksRes.ok) {
          const buf = Buffer.from(await eksRes.arrayBuffer())
          zip.file(`eks/eks-${year}-${String(m).padStart(2, "0")}.pdf`, buf)
        }
      } catch {
        /* skip */
      }
    }
  }

  // ─── Generate ZIP (streaming) ───────────────────────────────────────
  // generateNodeStream emittiert Chunks während die Komprimierung läuft.
  // streamFiles=true bewirkt, dass JSZip pro Eingabe-Buffer NICHT erst die
  // CRC32 vor-berechnet (was den ganzen Buffer einmal durchlesen würde,
  // bevor irgendetwas raus geht) — stattdessen ZIP64-Trailer-Modus mit
  // data-descriptors. Trade-off: leicht größere Headers, dafür echtes
  // sliding-window Streaming.
  const nodeStream = zip.generateNodeStream({
    type: "nodebuffer",
    streamFiles: true,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  // Fehler im Stream (z. B. zerstörte Eingabe-Buffer) sollen die Response
  // sauber abbrechen statt unhandled-rejection in den Logs zu lassen.
  // Der Browser sieht einen abgebrochenen Download, was korrekter ist
  // als ein hängender 200 mit Truncation-Risiko.
  nodeStream.on("error", (err) => {
    console.error("[steuerberater-zip] stream error", err)
  })

  const filename = `Steuerberater-Paket-${year}-${user.id.slice(0, 8)}.zip`

  // Sample-Counter im Header — Steuerberater + Audit sehen sofort, wieviele
  // Items im Archiv sind, ohne erst entpacken zu müssen.
  const counterHeaders = {
    "X-Faktivo-Rechnungen": String(rechnungenCount),
    "X-Faktivo-Belege": String(belegeCount),
  }

  // Readable.toWeb seit Node 17 stabil. Web-ReadableStream funktioniert
  // direkt als BodyInit, Next.js + Vercel propagieren Chunked-Encoding
  // transparent. JSZip typisiert seinen `NodeStream` als generischen
  // `NodeJS.ReadableStream`, nicht als die konkrete Klasse `stream.Readable`
  // — daher der Cast.
  const webStream = Readable.toWeb(
    nodeStream as unknown as Readable,
  ) as unknown as ReadableStream

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      // KEIN Content-Length — wir wissen die Endgröße erst nach Compression.
      // Chunked-Encoding setzt der HTTP/1.1-Server automatisch.
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      ...counterHeaders,
    },
  })
}
