/**
 * Beleg-OCR via Anthropic Claude Vision.
 *
 * Flow:
 *   1. Client lädt Bild (multipart/form-data → "file") oder schickt URL
 *      ("storage_path" eines bereits hochgeladenen Belegs).
 *   2. Server lädt Bild → schickt an Claude Vision mit struktur. Prompt.
 *   3. Antwort = JSON mit { amount_eur, vat_rate, vendor, date, category_hint,
 *      description, confidence }.
 *   4. Persistiert in `belege`-Tabelle, gibt Vorschlag zurück.
 *
 * Wenn ANTHROPIC_API_KEY fehlt → "stub" Response für Dev (heuristic).
 */

import { NextResponse, type NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface ExtractResult {
  amount_cents: number | null
  vat_rate: number | null
  vendor: string | null
  date: string | null
  category_hint: string | null
  description: string | null
  confidence: number
  raw: unknown
  source: "claude-vision" | "stub-dev"
}

// ─── Vision-Prompt ─────────────────────────────────────────────────────────
// Few-shot examples decken die häufigsten DE-Bon-Formate ab: Tankstelle,
// Supermarkt (Lidl/Edeka/Rewe), Restaurant, Drogerie (dm/Rossmann), Saturn/MediaMarkt,
// Apotheke, Telekom-Rechnung, Handwerker-Rechnung mit zwei USt-Sätzen.
const SYSTEM_PROMPT = `Du bist ein deutscher Buchhaltungs-Assistent. Aus einem Quittungs- oder Rechnungsfoto extrahierst du strukturierte Buchhaltungs-Daten für die EÜR / DATEV-SKR03.

Antworte AUSSCHLIESSLICH mit reinem JSON-Objekt — KEIN Markdown, KEINE Code-Fences, KEIN Erklärungstext drum herum.

Schema:
{
  "amount_eur": <Gesamtbetrag/Zahlbetrag in Euro als Dezimalzahl, z.B. 49.99 — null wenn nicht erkennbar>,
  "vat_rate": <Numeric: 0 | 7 | 19. Bei mehreren Sätzen: der dominante (höchste Netto-Anteil). null wenn keine USt ausgewiesen.>,
  "vendor": <Geschäft/Lieferant als String, z.B. "Aral Tankstelle Berlin Mitte". null wenn nicht erkennbar.>,
  "date": <Belegdatum als ISO YYYY-MM-DD. null wenn nicht erkennbar.>,
  "category_hint": <Eines aus dem Katalog unten — bestmögliche Schätzung>,
  "description": <Kurzbeschreibung auf Deutsch (5-10 Wörter), z.B. "Diesel 42,3 Liter">,
  "confidence": <0..1 — wie sicher bist du, niedriger bei unscharfem Foto>
}

Kategorie-Katalog (DATEV-SKR03 Hinweis in Klammern, intern):
- "kfz"             — Tankstelle, Werkstatt, Pkw-Reparatur, Autoteile (4530-4576)
- "buero"           — Büromaterial, Drucker, Toner, Möbel < 800€ (4980)
- "telefon"         — Mobilfunk, Festnetz, ohne Internet (4920)
- "internet"        — Hosting, Domain, VPN, ISP-Rechnung (4920)
- "essen-bewirtung" — Geschäftsessen mit Kunden, Bewirtung 70% absetzbar (4650)
- "fortbildung"     — Seminare, Kurse, Bücher, Konferenzen (4945)
- "software"        — SaaS-Abos, App-Store, GitHub, Adobe (4940)
- "marketing"       — Werbung, Online-Ads, Druckkosten, Visitenkarten (4610)
- "porto"           — DHL, DPD, Hermes, Briefmarken (4910)
- "bank"            — Kontoführung, Kartengebühren (4970)
- "miete"           — Büromiete, Coworking, Lager (4210)
- "strom"           — Stromrechnung, Heizung (4240)
- "andere"          — Wenn nichts Obiges passt

Wichtige Regeln:
1. Beträge: Punkt als Dezimal-Trennzeichen → "1234.56", NICHT "1.234,56".
2. Mehrere USt-Sätze auf der Quittung: nimm den, der den größten Netto-Anteil hat.
3. Bei "Brutto" / "Gesamt" / "Zahlbetrag" / "Endsumme" → das ist amount_eur.
4. Keine Spekulation: wenn unsicher, lieber null + niedrige confidence (0.2-0.4).
5. Bei privaten Quittungen ohne USt-Ausweis (z.B. Lidl-Bon ohne Detail-Steuern): vat_rate = 19 (Standardannahme), confidence ≤ 0.6.
6. Restaurant-Rechnung mit Trinkgeld: amount_eur = inkl. Trinkgeld (= tatsächlich gezahlt).

Beispiel 1 — Aral Tankstelle:
{
  "amount_eur": 78.45,
  "vat_rate": 19,
  "vendor": "Aral Tankstelle 1234",
  "date": "2026-04-15",
  "category_hint": "kfz",
  "description": "Diesel 47,2 Liter",
  "confidence": 0.95
}

Beispiel 2 — Restaurant-Bewirtung:
{
  "amount_eur": 124.50,
  "vat_rate": 19,
  "vendor": "Restaurant Sole Mio",
  "date": "2026-03-22",
  "category_hint": "essen-bewirtung",
  "description": "Bewirtung 3 Personen Mittagessen",
  "confidence": 0.9
}

Beispiel 3 — Lidl-Kassenbon ohne USt-Detail:
{
  "amount_eur": 12.49,
  "vat_rate": 19,
  "vendor": "Lidl Berlin",
  "date": "2026-04-20",
  "category_hint": "andere",
  "description": "Lebensmittel Selbstverpflegung",
  "confidence": 0.5
}

Beispiel 4 — Telekom-Rechnung Mobilfunk:
{
  "amount_eur": 39.95,
  "vat_rate": 19,
  "vendor": "Deutsche Telekom",
  "date": "2026-04-01",
  "category_hint": "telefon",
  "description": "Mobilfunk-Tarif April",
  "confidence": 0.92
}

Beispiel 5 — unleserliches Foto:
{
  "amount_eur": null,
  "vat_rate": null,
  "vendor": null,
  "date": null,
  "category_hint": "andere",
  "description": null,
  "confidence": 0.1
}`

async function extractWithClaude(
  imageBase64: string,
  mediaType: string
): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      amount_cents: null,
      vat_rate: null,
      vendor: null,
      date: null,
      category_hint: null,
      description: null,
      confidence: 0,
      raw: { error: "no ANTHROPIC_API_KEY in env — stub response" },
      source: "stub-dev",
    }
  }

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              // Allowed: image/jpeg | image/png | image/gif | image/webp
              media_type: (mediaType === "image/jpg"
                ? "image/jpeg"
                : mediaType) as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Extrahiere die Buchhaltungs-Daten aus diesem Beleg.",
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : ""

  // Parse JSON aus der Antwort
  let parsed: Record<string, unknown> = {}
  try {
    // Claude antwortet manchmal mit ```json ... ``` — strip.
    const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim()
    parsed = JSON.parse(jsonStr)
  } catch {
    return {
      amount_cents: null,
      vat_rate: null,
      vendor: null,
      date: null,
      category_hint: null,
      description: null,
      confidence: 0,
      raw: { parse_error: true, text: raw },
      source: "claude-vision",
    }
  }

  const amount = typeof parsed.amount_eur === "number" ? parsed.amount_eur : null
  const cents = amount !== null ? Math.round(amount * 100) : null
  const vat = typeof parsed.vat_rate === "number" ? parsed.vat_rate : null
  const conf =
    typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5

  return {
    amount_cents: cents,
    vat_rate: vat,
    vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
    date: typeof parsed.date === "string" ? parsed.date : null,
    category_hint:
      typeof parsed.category_hint === "string" ? parsed.category_hint : null,
    description:
      typeof parsed.description === "string" ? parsed.description : null,
    confidence: conf,
    raw: parsed,
    source: "claude-vision",
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const ct = request.headers.get("content-type") ?? ""
  let imageBase64: string
  let mediaType: string
  let fileSize: number

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "no file" }, { status: 400 })
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "file too large (>8MB)" },
        { status: 413 }
      )
    }
    const buf = Buffer.from(await file.arrayBuffer())
    imageBase64 = buf.toString("base64")
    mediaType = file.type || "image/jpeg"
    fileSize = file.size
  } else {
    const body = await request.json()
    if (!body.base64 || !body.media_type) {
      return NextResponse.json(
        { error: "expected { base64, media_type }" },
        { status: 400 }
      )
    }
    imageBase64 = body.base64
    mediaType = body.media_type
    fileSize = (imageBase64.length * 3) / 4
  }

  const result = await extractWithClaude(imageBase64, mediaType)

  // Persistiere in `belege`-Tabelle (mit minimalem Storage-Pfad-Stub —
  // echter Storage-Upload geschieht im UI über supabase.storage)
  const { data: belegRow, error: insErr } = await supabase
    .from("belege")
    .insert({
      user_id: user.id,
      storage_path: `tmp/${Date.now()}.${mediaType.split("/")[1] ?? "jpg"}`,
      mime_type: mediaType,
      file_size_bytes: Math.round(fileSize),
      ocr_amount_cents: result.amount_cents,
      ocr_vat_rate: result.vat_rate,
      ocr_vendor: result.vendor,
      ocr_date: result.date,
      ocr_category_hint: result.category_hint,
      ocr_description: result.description,
      ocr_raw_jsonb: result.raw as Record<string, unknown>,
      ocr_confidence: result.confidence,
      ocr_processed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insErr) {
    return NextResponse.json(
      { error: insErr.message, ocr: result },
      { status: 500 }
    )
  }

  return NextResponse.json({
    beleg: belegRow,
    ocr: result,
  })
}
