/**
 * AI-Klassifikation von Bank-Transaktionen via Claude Sonnet 4.5.
 *
 * Nutzt einen einzigen Batch-Call für bis zu 30 Transaktionen gleichzeitig
 * (kosteneffektiv: ~$0.003 pro Klassifizierung bei Sonnet).
 *
 * Output pro Tx:
 *   - scope: "business" | "private"
 *   - category: deutscher Klartext-Name (z.B. "Kfz", "Telefon", "Software")
 *   - skr03: Konto-Nummer (z.B. "4576" für Diesel)
 *   - vat_rate: 0 / 7 / 19 (geschätzte enthaltene USt)
 *   - confidence: 0..1
 *   - reasoning: kurze Erklärung auf Deutsch
 *
 * Bei confidence ≥ 0.8 wird in /api/banking/import-csv und /sync ein
 * expense_entry automatisch angelegt.
 *
 * Wenn ANTHROPIC_API_KEY fehlt → Fallback auf regex-Klassifikation
 * (categorizeFromVendor in match.ts).
 */

import Anthropic from "@anthropic-ai/sdk"

import { categorizeFromVendor } from "./match"

export interface ClassifyInput {
  amountCents: number
  remittanceInfo: string | null
  counterpartyName: string | null
  bookingDate: string
}

export interface ClassifyContext {
  userProfession?: string
  isKleinunternehmer?: boolean
  isFreelancer?: boolean
  receivesBuergergeld?: boolean
}

export interface ClassifyResult {
  scope: "business" | "private"
  category: string
  skr03: string | null
  vatRate: number
  confidence: number
  reasoning: string
  source: "claude-ai" | "regex-fallback"
}

const SYSTEM_PROMPT = `Du bist ein deutscher Buchhaltungs-Assistent für Selbstständige (Freelancer / Aufstocker).

Aufgabe: Klassifiziere Bank-Transaktionen — bestimme ob sie geschäftlich oder privat sind, und welche Kategorie/SKR03-Konto passt.

**WICHTIG**: Antworte AUSSCHLIESSLICH mit reinem JSON-Array (kein Markdown, keine Code-Fences, kein Erklärungstext drum herum).

Schema pro Transaktion:
{
  "idx": <Index aus Input-Array>,
  "scope": "business" | "private",
  "category": <Deutsche Kategorie-Bezeichnung>,
  "skr03": <SKR03-Konto-Nummer als String, z.B. "4576">,
  "vat_rate": <0 | 7 | 19 — enthaltene USt, geschätzt>,
  "confidence": <0..1>,
  "reasoning": <1 Satz Begründung auf Deutsch>
}

**Kategorien-Katalog (mit SKR03)**:

GESCHÄFTLICH (für Selbstständige absetzbar):
- "Kfz / Tankstelle" (4576 Treibstoff, 4570 Reparaturen, 4530 Versicherung)
- "Telefon / Mobilfunk" (4920)
- "Internet / Hosting" (4920)
- "Software / Abos" (4940)
- "Büromaterial" (4980)
- "Bewirtung Geschäftsessen" (4650 — 70% absetzbar)
- "Marketing / Werbung" (4610)
- "Porto / Versand" (4910)
- "Bankgebühren" (4970)
- "Miete Büro / Coworking" (4210)
- "Strom / Heizung" (4240)
- "Fortbildung / Bücher" (4945)
- "Werkzeug / Geräte" (4980 oder 6840 GWG)
- "KFZ-Versicherung" (4530)
- "Beratung / Steuerberater" (4956)

PRIVAT (NICHT absetzbar, geht NICHT in EÜR):
- "Lebensmittel" (Privatentnahme)
- "Wohnen / Miete privat" (Privatentnahme)
- "Freizeit / Entertainment"
- "Kleidung"
- "Gesundheit / Apotheke"
- "Restaurants privat" (KEINE Bewirtung — z.B. Fastfood unter 25€)
- "Auto privat" (wenn nicht beruflich)
- "Andere private Ausgabe"

EINNAHMEN:
- "Kunden-Zahlung" (Eingang von Firma → business income)
- "Bürgergeld vom Jobcenter" (private income, nicht business)
- "Steuererstattung Finanzamt" (private income)
- "Privatentnahme / Eigene Einzahlung"
- "Andere Einnahme"

**Heuristiken**:
- REWE / Edeka / Aldi / Lidl / Netto / Penny → meistens "Lebensmittel" privat (außer Bewirtung mit Beleg, aber Bank-CSV kann das nicht wissen → privat default).
- Aral / Shell / Esso / Total → Treibstoff. Bei Freelancer: business "Kfz / Tankstelle". Bei Bürgergeld-Empfänger ohne klares Auto-Business: confidence niedriger → privat.
- McDonald's / Burger King / Subway / KFC → privat (Fastfood, kein Bewirtung).
- Restaurant-Namen ("Restaurant XYZ") → mit Begründung: kann beides sein, niedrigere confidence.
- Telekom / Vodafone / O2 / 1&1 → business "Telefon".
- AWS / Hetzner / Vercel / Netlify / Cloudflare → business "Internet / Hosting".
- GitHub / Adobe / Anthropic / OpenAI / Microsoft 365 / Google Workspace → business "Software".
- DHL / DPD / Hermes / GLS → business "Porto".
- Vattenfall / E.ON / Enbw / Stadtwerke → business "Strom" (wenn Home-Office) ODER privat. Confidence ~0.6.
- DKB / N26 / Sparkasse Gebühren → business "Bankgebühren".
- Coworking / Mindspace / WeWork → business "Miete".
- Udemy / Coursera / Linkedin Learning → business "Fortbildung".
- Sehr kleine Beträge unter 5€ ohne klaren Vendor → privat.
- Eingehende Beträge:
   • mit Rechnungs-Nr im Verwendungszweck → "Kunden-Zahlung", confidence 0.95
   • von "Jobcenter" / "Agentur für Arbeit" / "Familienkasse" → "Bürgergeld", scope "private"
   • von "Finanzamt" → "Steuererstattung", scope "private"
   • Lohn / Gehalt → "Lohn" privat (nebenberuflich-Konstellation)

**Confidence-Richtlinien**:
- ≥ 0.9 — eindeutig (Aral=Tanke, Telekom=Telefon, Rechnungs-Nr im Verwendungszweck)
- 0.7-0.89 — wahrscheinlich, kleines Restrisiko (Vattenfall=Strom: business oder privat? Default business+0.7)
- 0.4-0.69 — unklar (Restaurant ohne Kontext)
- < 0.4 — sehr unsicher (kryptischer Verwendungszweck, kein Vendor)

vat_rate-Richtlinien:
- Lebensmittel-Supermarkt → 7
- Restaurants → 19
- Tanke → 19
- Telekom/Internet → 19
- Bücher → 7
- Default unbekannt → 19`

const USER_TEMPLATE = (
  txs: Array<ClassifyInput & { idx: number }>,
  ctx: ClassifyContext
) => {
  const ctxLines: string[] = []
  if (ctx.userProfession) ctxLines.push(`Beruf: ${ctx.userProfession}`)
  if (ctx.isKleinunternehmer) ctxLines.push("Kleinunternehmer §19 UStG")
  if (ctx.isFreelancer) ctxLines.push("Freelancer / Selbstständig")
  if (ctx.receivesBuergergeld) ctxLines.push("Aufstocker — bekommt Bürgergeld")

  const userCtx = ctxLines.length > 0
    ? `Nutzer-Kontext:\n${ctxLines.map((l) => "- " + l).join("\n")}\n\n`
    : ""

  return `${userCtx}Klassifiziere folgende Bank-Transaktionen:

${txs.map((tx) => {
  const sign = tx.amountCents >= 0 ? "+" : "-"
  const amount = (Math.abs(tx.amountCents) / 100).toFixed(2)
  return `[${tx.idx}] ${tx.bookingDate} | ${sign}${amount}€ | Empfänger/Sender: "${tx.counterpartyName ?? "—"}" | Verwendungszweck: "${tx.remittanceInfo ?? "—"}"`
}).join("\n")}

Antworte mit JSON-Array (eine Zeile pro Transaktion). Keine Erklärung drumrum.`
}

interface ClaudeBatchResult {
  idx: number
  scope: "business" | "private"
  category: string
  skr03?: string | null
  vat_rate?: number
  confidence: number
  reasoning?: string
}

async function classifyWithClaude(
  txs: ClassifyInput[],
  ctx: ClassifyContext
): Promise<ClassifyResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("no ANTHROPIC_API_KEY")
  }
  const client = new Anthropic({ apiKey })

  const indexed = txs.map((tx, idx) => ({ ...tx, idx }))
  const userMsg = USER_TEMPLATE(indexed, ctx)

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = response.content.find((b) => b.type === "text")
  const raw = text && text.type === "text" ? text.text : ""

  // Parse JSON-Array (Claude returns sometimes ```json ... ``` despite instructions)
  let parsed: ClaudeBatchResult[] = []
  try {
    const jsonStr = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*$/g, "")
      .trim()
    const parsedRaw = JSON.parse(jsonStr)
    parsed = Array.isArray(parsedRaw) ? parsedRaw : [parsedRaw]
  } catch {
    return txs.map(() => fallbackResult())
  }

  const byIdx = new Map<number, ClaudeBatchResult>()
  for (const r of parsed) {
    if (typeof r.idx === "number") byIdx.set(r.idx, r)
  }

  return txs.map((tx, idx) => {
    const r = byIdx.get(idx)
    if (!r) return fallbackForTx(tx)
    return {
      scope: r.scope === "private" ? "private" : "business",
      category: r.category ?? "Andere",
      skr03: r.skr03 ?? null,
      vatRate: typeof r.vat_rate === "number" ? r.vat_rate : 19,
      confidence: Math.max(0, Math.min(1, r.confidence ?? 0.4)),
      reasoning: r.reasoning ?? "",
      source: "claude-ai" as const,
    }
  })
}

// ─── Regex-Fallback (wenn AI nicht verfügbar) ─────────────────────────────

function fallbackResult(): ClassifyResult {
  return {
    scope: "business",
    category: "Andere",
    skr03: null,
    vatRate: 19,
    confidence: 0.3,
    reasoning: "Fallback (kein AI-Key gesetzt) — manuelle Prüfung empfohlen",
    source: "regex-fallback",
  }
}

function fallbackForTx(tx: ClassifyInput): ClassifyResult {
  const cat = categorizeFromVendor(tx.counterpartyName)
  if (!cat) return fallbackResult()
  return {
    scope: cat === "andere" ? "private" : "business",
    category: cat,
    skr03: null,
    vatRate: cat === "essen-bewirtung" || cat === "andere" ? 7 : 19,
    confidence: cat === "andere" ? 0.4 : 0.6,
    reasoning: `Regex-Match auf Vendor "${tx.counterpartyName ?? "—"}" → ${cat}`,
    source: "regex-fallback",
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

const BATCH_SIZE = 25

// ─── AI Rules Learning ────────────────────────────────────────────────────

export interface UserRule {
  pattern: string // lowercase substring
  match_field: "counterparty_name" | "remittance_info" | "vendor"
  scope: "business" | "personal"
  category_label: string | null
  vat_rate: number
  is_deductible: boolean
  jobcenter_relevant: boolean
}

/**
 * Wenn der User eine Tx in der Vergangenheit korrigiert hat (z.B. "REWE → privat"),
 * ist diese Regel in `category_rules`. Prüfe Tx gegen alle Regeln —
 * wenn Match → return klassifikation OHNE AI-Call (confidence 0.95).
 */
function applyUserRule(
  tx: ClassifyInput,
  rules: UserRule[]
): ClassifyResult | null {
  const fields: Record<UserRule["match_field"], string> = {
    counterparty_name: (tx.counterpartyName ?? "").toLowerCase(),
    remittance_info: (tx.remittanceInfo ?? "").toLowerCase(),
    vendor: (tx.counterpartyName ?? "").toLowerCase(),
  }

  for (const rule of rules) {
    const haystack = fields[rule.match_field]
    if (haystack && haystack.includes(rule.pattern.toLowerCase())) {
      // DB scope is "business" | "personal" — wir mappen personal → private für ai_scope
      const aiScope: "business" | "private" =
        rule.scope === "business" ? "business" : "private"
      return {
        scope: aiScope,
        category: rule.category_label ?? "Andere",
        skr03: null,
        vatRate: rule.vat_rate,
        confidence: 0.95, // user-bestätigte Regel = hohes Vertrauen
        reasoning: `User-Regel: "${rule.pattern}" → ${rule.scope} / ${rule.category_label ?? "Andere"}`,
        source: "regex-fallback", // technisch kein Claude-Call
      }
    }
  }
  return null
}

export async function classifyTransactions(
  txs: ClassifyInput[],
  ctx: ClassifyContext = {},
  userRules: UserRule[] = []
): Promise<ClassifyResult[]> {
  if (txs.length === 0) return []

  // Erst User-Regeln anwenden (free, schnell, Tx werden aus Claude-Batch entfernt)
  const finalResults: (ClassifyResult | null)[] = txs.map((tx) =>
    applyUserRule(tx, userRules)
  )
  const claudeNeededIdx: number[] = []
  const claudeBatch: ClassifyInput[] = []
  for (let i = 0; i < txs.length; i++) {
    if (!finalResults[i]) {
      claudeNeededIdx.push(i)
      claudeBatch.push(txs[i])
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || claudeBatch.length === 0) {
    // Regex-Fallback für die noch unbeantworteten
    for (let i = 0; i < claudeNeededIdx.length; i++) {
      finalResults[claudeNeededIdx[i]] = fallbackForTx(claudeBatch[i])
    }
    return finalResults as ClassifyResult[]
  }

  // Claude für die Restmenge (gebatcht)
  const claudeResults: ClassifyResult[] = []
  for (let i = 0; i < claudeBatch.length; i += BATCH_SIZE) {
    const batch = claudeBatch.slice(i, i + BATCH_SIZE)
    try {
      const r = await classifyWithClaude(batch, ctx)
      claudeResults.push(...r)
    } catch (e) {
      console.warn("AI classify batch failed, fallback:", e)
      claudeResults.push(...batch.map(fallbackForTx))
    }
  }

  for (let i = 0; i < claudeNeededIdx.length; i++) {
    finalResults[claudeNeededIdx[i]] = claudeResults[i]
  }

  return finalResults as ClassifyResult[]
}

/** Confidence-Schwellen für Auto-Import. */
export const AUTO_IMPORT_THRESHOLD = 0.8
export const SUGGEST_THRESHOLD = 0.5
