/**
 * Claude vision parser for German Jobcenter / Bürgergeld documents.
 *
 * Accepts a PDF or image buffer (scan/photo of a Bewilligungsbescheid,
 * WBA, vorläufige/endgültige Anlage EKS, Anlage VM, etc.) and returns
 * a strictly typed JSON object with the extracted fields.
 *
 * Cost: ~$0.01-0.03 per document (claude-haiku-4-5).
 *
 * Errors:
 *   - missing key  → throws Error("ANTHROPIC_API_KEY_MISSING")
 *   - rate limited → throws Error("AI_RATE_LIMIT")
 *   - bad JSON     → throws Error("AI_PARSE_FAILED")
 *   - vision soft-block on unsupported mime → throws Error("UNSUPPORTED_MIME")
 */

import Anthropic from "@anthropic-ai/sdk"

// ─── Public types ───────────────────────────────────────────────────────

export type DocumentKind =
  | "bewilligung"
  | "wba"
  | "eks_vorlaeufig"
  | "eks_endgueltig"
  | "vermoegen"
  | "other"

export interface ParsedBewilligung {
  kind: "bewilligung"
  bewilligungszeitraum_start: string | null  // YYYY-MM-DD
  bewilligungszeitraum_end: string | null
  regelbedarf_stufe: 1 | 2 | 3 | 4 | 5 | 6 | null
  regelbedarf_monatlich_cents: number | null
  kdu_monatlich_cents: number | null
  mehrbedarf_cents: number | null
  buergergeld_bedarf_monatlich_cents: number | null
  bg_nummer: string | null
  jobcenter_name: string | null
  has_minor_children: boolean | null
  field_confidence: Record<string, number>  // 0-100 per field
  warnings: string[]
}

export interface ParsedEksVorlaeufig {
  kind: "eks_vorlaeufig"
  bewilligungszeitraum_start: string | null
  bewilligungszeitraum_end: string | null
  monthly_prognose: Array<{
    month: string  // YYYY-MM-01
    einnahmen_cents: number
    ausgaben_cents: number
    saldo_cents: number
  }>
  field_confidence: Record<string, number>
  warnings: string[]
}

export interface ParsedGeneric {
  kind: Exclude<DocumentKind, "bewilligung" | "eks_vorlaeufig">
  raw_text: string
  warnings: string[]
  field_confidence: Record<string, number>
}

export type ParsedDocument =
  | ParsedBewilligung
  | ParsedEksVorlaeufig
  | ParsedGeneric

// ─── Allowed mime types ────────────────────────────────────────────────

const PDF_MIME = new Set(["application/pdf", "application/x-pdf"])
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
])

function isPdf(mime: string): boolean {
  return PDF_MIME.has(mime)
}
function isImage(mime: string): boolean {
  return IMAGE_MIMES.has(mime)
}

// Anthropic vision currently accepts jpeg/png/gif/webp. HEIC must be
// converted (not done in this MVP — we surface a warning).
function imageMediaTypeFor(mime: string): "image/jpeg" | "image/png" | "image/webp" | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "image/jpeg"
  if (mime === "image/png") return "image/png"
  if (mime === "image/webp") return "image/webp"
  return null
}

// ─── System prompt (single, kind-aware) ────────────────────────────────

function buildSystemPrompt(kind: DocumentKind): string {
  return `You are a precise extractor of German Jobcenter (Bürgergeld) documents.

You will receive a scanned or photographed document. Identify and extract specific fields based on the document kind: ${kind}.

DATE / MONEY FORMAT:
- Dates: convert German TT.MM.JJJJ → ISO YYYY-MM-DD.
- Money: convert "1.063,00 €" → 106300 (cents). Strip thousand-separators ("."), treat comma as decimal. Always integer cents.
- has_minor_children: true if the document mentions Mehrbedarf for "minderjährige Kinder" or names children under 18 in the BG.
- field_confidence: 0-100 per field — your confidence that the value is correctly extracted from clear text. Use 0 if not found.
- warnings: short strings noting unsure values, blurred parts, missing fields.

${
  kind === "bewilligung"
    ? `SCHEMA for "bewilligung":
{
  "kind": "bewilligung",
  "bewilligungszeitraum_start": "YYYY-MM-DD" | null,    // "von TT.MM.JJJJ"
  "bewilligungszeitraum_end":   "YYYY-MM-DD" | null,    // "bis TT.MM.JJJJ"
  "regelbedarf_stufe":          1|2|3|4|5|6 | null,     // "Regelbedarfsstufe"
  "regelbedarf_monatlich_cents": number | null,         // "Regelbedarf" or "Regelleistung" — base monthly need
  "kdu_monatlich_cents":         number | null,         // "Kosten der Unterkunft" / "KdU" / "Bedarf für Unterkunft und Heizung"
  "mehrbedarf_cents":            number | null,         // sum of "Mehrbedarf" lines if any, else null
  "buergergeld_bedarf_monatlich_cents": number | null,  // total monthly Bedarf — sum of Regelbedarf + KdU + Mehrbedarf, or "Gesamtbedarf" / "Bedarf gesamt" if printed
  "bg_nummer":                   string | null,         // BG-Nummer / Bedarfsgemeinschafts-Nummer
  "jobcenter_name":              string | null,         // e.g. "Jobcenter Regensburg"
  "has_minor_children":          boolean | null,
  "field_confidence":            { "bewilligungszeitraum_start": 95, "regelbedarf_stufe": 80, ... },
  "warnings":                    [ "string" ]
}`
    : kind === "eks_vorlaeufig" || kind === "eks_endgueltig"
      ? `SCHEMA for "eks_vorlaeufig":
{
  "kind": "eks_vorlaeufig",
  "bewilligungszeitraum_start": "YYYY-MM-DD" | null,
  "bewilligungszeitraum_end":   "YYYY-MM-DD" | null,
  "monthly_prognose": [
    {
      "month": "YYYY-MM-01",        // first day of month
      "einnahmen_cents": number,    // Betriebseinnahmen for that month
      "ausgaben_cents": number,     // Betriebsausgaben for that month
      "saldo_cents": number         // einnahmen - ausgaben
    }
  ],
  "field_confidence": { "bewilligungszeitraum_start": 95, "month_2026-01-01": 80, ... },
  "warnings": [ "string" ]
}
If the document is the *endgültige* EKS (final, with actual numbers), use the same schema — set kind to "eks_vorlaeufig" anyway (caller knows).`
      : `SCHEMA for "${kind}":
{
  "kind": "${kind}",
  "raw_text": "string — a concise human-readable summary of what the document says (≤500 chars). Include dates, amounts, BG-Nr., names if visible.",
  "field_confidence": { "raw_text": 85 },
  "warnings": [ "string" ]
}`
}

Output ONLY the JSON object. No markdown fences, no prose, no comments. Start with "{" and end with "}".`
}

// ─── Main exported function ────────────────────────────────────────────

export async function parseJobcenterDocument(
  buffer: Buffer,
  mimeType: string,
  kind: DocumentKind,
): Promise<ParsedDocument> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY_MISSING")
  }

  const base64 = buffer.toString("base64")

  // Build the user-content block. PDFs use Anthropic's "document" content
  // type (handles native PDF + does its own OCR for scans). Images use
  // the "image" content type.
  let mediaContent:
    | {
        type: "document"
        source: { type: "base64"; media_type: "application/pdf"; data: string }
      }
    | {
        type: "image"
        source: {
          type: "base64"
          media_type: "image/jpeg" | "image/png" | "image/webp"
          data: string
        }
      }

  if (isPdf(mimeType)) {
    mediaContent = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64,
      },
    }
  } else if (isImage(mimeType)) {
    const imgMime = imageMediaTypeFor(mimeType)
    if (!imgMime) {
      // HEIC etc. — vision can't accept it directly.
      throw new Error("UNSUPPORTED_MIME")
    }
    mediaContent = {
      type: "image",
      source: {
        type: "base64",
        media_type: imgMime,
        data: base64,
      },
    }
  } else {
    throw new Error("UNSUPPORTED_MIME")
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = buildSystemPrompt(kind)
  const userText =
    kind === "bewilligung"
      ? `Bitte extrahiere alle Felder des Bewilligungsbescheid laut Schema. Antworte nur mit JSON.`
      : kind === "eks_vorlaeufig"
        ? `Bitte extrahiere die monatliche Prognose der Vorläufigen Anlage EKS laut Schema. Antworte nur mit JSON.`
        : kind === "eks_endgueltig"
          ? `Bitte extrahiere die monatlichen Ist-Werte der Endgültigen Anlage EKS laut Schema. Antworte nur mit JSON.`
          : `Bitte fasse den Dokumentinhalt zusammen laut Schema. Antworte nur mit JSON.`

  let response
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            mediaContent,
            { type: "text", text: userText },
          ],
        },
        {
          // Prefill the assistant turn with "{" to force JSON output.
          role: "assistant",
          content: [{ type: "text", text: "{" }],
        },
      ],
    })
  } catch (err) {
    const e = err as { status?: number; message?: string }
    if (e.status === 429) {
      throw new Error("AI_RATE_LIMIT")
    }
    if (e.status === 401 || e.status === 403) {
      throw new Error("ANTHROPIC_API_KEY_MISSING")
    }
    console.error("[document-parser] Anthropic call failed:", err)
    throw new Error("AI_PARSE_FAILED")
  }

  const textBlock = response.content.find((b) => b.type === "text")
  const rawCompletion =
    textBlock && textBlock.type === "text" ? textBlock.text : ""
  // Re-attach the prefilled "{" because the SDK only returns the
  // generated continuation.
  const jsonStr = ("{" + rawCompletion).trim()
  const cleaned = stripFences(jsonStr)

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error(
      "[document-parser] JSON parse failed:",
      err,
      "raw:",
      cleaned.slice(0, 500),
    )
    throw new Error("AI_PARSE_FAILED")
  }

  return normalizeParsed(parsed, kind)
}

// ─── Normalizers ────────────────────────────────────────────────────────

function stripFences(s: string): string {
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
}

function normalizeParsed(value: unknown, kind: DocumentKind): ParsedDocument {
  if (!value || typeof value !== "object") {
    throw new Error("AI_PARSE_FAILED")
  }
  const o = value as Record<string, unknown>
  const confidence = normalizeConfidence(o.field_confidence)
  const warnings = normalizeWarnings(o.warnings)

  if (kind === "bewilligung") {
    return normalizeBewilligung(o, confidence, warnings)
  }
  if (kind === "eks_vorlaeufig" || kind === "eks_endgueltig") {
    return normalizeEks(o, confidence, warnings)
  }
  return {
    kind,
    raw_text: optStr(o.raw_text) ?? "",
    warnings,
    field_confidence: confidence,
  }
}

function normalizeBewilligung(
  o: Record<string, unknown>,
  confidence: Record<string, number>,
  warnings: string[],
): ParsedBewilligung {
  const stufe = optInt(o.regelbedarf_stufe)
  const stufeNarrow =
    stufe === 1 || stufe === 2 || stufe === 3 || stufe === 4 || stufe === 5 || stufe === 6
      ? (stufe as 1 | 2 | 3 | 4 | 5 | 6)
      : null

  return {
    kind: "bewilligung",
    bewilligungszeitraum_start: optDate(o.bewilligungszeitraum_start) ?? null,
    bewilligungszeitraum_end: optDate(o.bewilligungszeitraum_end) ?? null,
    regelbedarf_stufe: stufeNarrow,
    regelbedarf_monatlich_cents: optInt(o.regelbedarf_monatlich_cents) ?? null,
    kdu_monatlich_cents: optInt(o.kdu_monatlich_cents) ?? null,
    mehrbedarf_cents: optInt(o.mehrbedarf_cents) ?? null,
    buergergeld_bedarf_monatlich_cents:
      optInt(o.buergergeld_bedarf_monatlich_cents) ?? null,
    bg_nummer: optStr(o.bg_nummer) ?? null,
    jobcenter_name: optStr(o.jobcenter_name) ?? null,
    has_minor_children: optBool(o.has_minor_children),
    field_confidence: confidence,
    warnings,
  }
}

function normalizeEks(
  o: Record<string, unknown>,
  confidence: Record<string, number>,
  warnings: string[],
): ParsedEksVorlaeufig {
  const arr = Array.isArray(o.monthly_prognose) ? o.monthly_prognose : []
  const monthly: ParsedEksVorlaeufig["monthly_prognose"] = []
  for (const row of arr) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const month = optMonth(r.month)
    if (!month) continue
    const einnahmen = optInt(r.einnahmen_cents) ?? 0
    const ausgaben = optInt(r.ausgaben_cents) ?? 0
    const saldo = optInt(r.saldo_cents) ?? einnahmen - ausgaben
    monthly.push({
      month,
      einnahmen_cents: einnahmen,
      ausgaben_cents: ausgaben,
      saldo_cents: saldo,
    })
  }

  return {
    kind: "eks_vorlaeufig",
    bewilligungszeitraum_start: optDate(o.bewilligungszeitraum_start) ?? null,
    bewilligungszeitraum_end: optDate(o.bewilligungszeitraum_end) ?? null,
    monthly_prognose: monthly,
    field_confidence: confidence,
    warnings,
  }
}

function normalizeConfidence(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {}
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = optInt(val)
    if (typeof n === "number" && Number.isFinite(n)) {
      out[k] = Math.max(0, Math.min(100, n))
    }
  }
  return out
}

function normalizeWarnings(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
}

function optStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v)
  if (typeof v === "string") {
    const cleaned = v.replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "")
    if (!cleaned) return undefined
    const n = Number(cleaned)
    return Number.isFinite(n) ? Math.round(n) : undefined
  }
  return undefined
}

function optBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v
  if (typeof v === "string") {
    const s = v.trim().toLowerCase()
    if (s === "true" || s === "ja" || s === "yes") return true
    if (s === "false" || s === "nein" || s === "no") return false
  }
  return null
}

function optDate(v: unknown): string | undefined {
  const s = optStr(v)
  if (!s) return undefined
  // Already ISO?
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // German TT.MM.JJJJ → ISO
  const de = s.match(/^(\d{2})\.(\d{2})\.(\d{2,4})/)
  if (de) {
    let yyyy = de[3]
    if (yyyy.length === 2) {
      const n = Number(yyyy)
      yyyy = n < 80 ? `20${yyyy}` : `19${yyyy}`
    }
    return `${yyyy}-${de[2]}-${de[1]}`
  }
  return undefined
}

/** "2026-04" or "2026-04-01" → "2026-04-01". Otherwise undefined. */
function optMonth(v: unknown): string | undefined {
  const s = optStr(v)
  if (!s) return undefined
  const m = s.match(/^(\d{4})-(\d{2})/)
  if (!m) return undefined
  return `${m[1]}-${m[2]}-01`
}
