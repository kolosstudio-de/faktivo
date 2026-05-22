/**
 * Per-user transaction classifier.
 *
 * Given a batch of un-categorized transactions, return a category +
 * scope suggestion for each — using:
 *   1. Learned rules from `categorization_rules` (case-insensitive substring
 *      match on counterparty / reference / both). Free, instant, deterministic.
 *   2. AI fallback (claude-haiku-4-5) — ONE batch call for all un-matched
 *      transactions. ~$0.005 per import.
 *
 * The result is later used to pre-fill the PDF-import preview UI; the user
 * can accept (default) or change. On commit we feed accepted/changed
 * suggestions back into `categorization_rules` so next time the rule wins
 * instantly without an AI call.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Public API ───────────────────────────────────────────────────────────

export interface ClassificationInput {
  counterparty?: string
  reference?: string
  amount_cents: number // signed
  description?: string
}

export interface ClassificationOutput {
  category_id: string | null // matched category UUID, null if no good match
  category_name?: string
  scope: "business" | "personal"
  confidence: number // 0–100
  source: "rule" | "ai" | "none"
  reason?: string
  /** True if this transaction is a Bürgergeld credit from the Jobcenter. */
  is_buergergeld?: boolean
  /**
   * True if this transaction is an internal crypto / asset-form conversion
   * or self-withdrawal (e.g. Coinbase USDC→EURC, "Withdrawal to bank").
   * Such rows must NOT count as income/expense — they're balance-form
   * changes within the same wallet. Detected by AI or by the heuristic
   * `isIntraAccountTransfer()`.
   */
  is_transfer?: boolean
}

// ─── Internal types ───────────────────────────────────────────────────────

interface CategoryRow {
  id: string
  name: string
  scope: "business" | "personal"
  kind: "income" | "expense"
  color: string | null
}

interface RuleRow {
  id: string
  match_pattern: string
  match_field: string // 'counterparty' | 'reference' | 'both'
  category_id: string
  scope: "business" | "personal"
  confidence: number
}

interface AiClassification {
  index: number
  category_name: string
  scope: "business" | "personal"
  confidence: number
  reason?: string
  is_buergergeld?: boolean
}

// ─── Bürgergeld fast-path patterns ────────────────────────────────────────

const BUERGERGELD_COUNTERPARTY_RX =
  /(bundesagentur f.?r arbeit|jobcenter|arbeitsamt|agentur f.?r arbeit|\barge\b|familienkasse)/i

const BUERGERGELD_REFERENCE_RX =
  /(b[üu]rgergeld|alg[\s-]?ii|arbeitslosengeld\s*ii|leistung[en]*\s*nach\s*sgb\s*ii)/i

/**
 * Detect Bürgergeld credits without an AI call.
 * Returns true only for INCOMING amounts (credits) matching known patterns.
 */
export function isBuergergeldCandidate(input: ClassificationInput): boolean {
  if (input.amount_cents <= 0) return false
  const cp = (input.counterparty ?? "").trim()
  const ref = `${input.reference ?? ""} ${input.description ?? ""}`.trim()
  if (cp && BUERGERGELD_COUNTERPARTY_RX.test(cp)) return true
  if (ref && BUERGERGELD_REFERENCE_RX.test(ref)) return true
  return false
}

// ─── Vendor fast-paths: known B2B SaaS vendors → always business ──────────
// AI is probabilistic and sometimes mis-classifies OpenAI / Anthropic /
// GitHub etc. as "personal" (especially when reference says "ChatGPT Plus").
// These are deterministic rules — match → skip AI, guaranteed business scope.

interface VendorRule {
  rx: RegExp
  scope: "business" | "personal"
  // Category name to look up in user's category list (case-insensitive substring match)
  categoryHint: string
  reason: string
}

const VENDOR_FAST_PATH: VendorRule[] = [
  // Business SaaS / Software
  {
    rx: /\b(open\s*ai|openai|chatgpt|gpt-?4|anthropic|claude\.ai|claude-?ai)\b/i,
    scope: "business",
    categoryHint: "saas",
    reason: "OpenAI / Anthropic — Business SaaS (KI-Services)",
  },
  {
    rx: /\b(github|gitlab|bitbucket|vercel|netlify|cloudflare|heroku|aws|amazon\s*web\s*services|hetzner|digitalocean|linode)\b/i,
    scope: "business",
    categoryHint: "saas",
    reason: "Cloud / Hosting / DevOps — Business",
  },
  {
    rx: /\b(google\s*workspace|google\s*cloud|gsuite|microsoft\s*365|microsoft\s*office|adobe|figma|linear\.app|notion\.so|zapier|airtable|jira|confluence|atlassian|slack(?!\s*pay)|miro)\b/i,
    scope: "business",
    categoryHint: "saas",
    reason: "Productivity / Collaboration SaaS — Business",
  },
  {
    rx: /\b(stripe|paypal\s*business|mollie|paddle|lemon\s*squeezy|square)\s+(payments?|fees?)?/i,
    scope: "business",
    categoryHint: "bankgebühren",
    reason: "Payment Processor Fees — Business",
  },
  // Personal — only when CLEARLY consumer
  {
    rx: /\b(spotify|netflix|disney\+?|disneyplus|apple\s*music|amazon\s*prime|youtube\s*premium|hbo|paramount\+?|hulu|sky)\b/i,
    scope: "personal",
    categoryHint: "streaming",
    reason: "Streaming-Dienst — privat",
  },
  {
    rx: /\b(aldi|rewe|edeka|lidl|netto|penny|kaufland|real\s*supermarkt)\b/i,
    scope: "personal",
    categoryHint: "lebensmittel",
    reason: "Lebensmittel-Discounter — privat",
  },
  {
    rx: /\b(dm-?drogerie|dm\s+drogerie|rossmann|m[üu]ller\s*drogerie)\b/i,
    scope: "personal",
    categoryHint: "drogerie",
    reason: "Drogerie — privat",
  },
]

function matchVendorFastPath(
  tx: ClassificationInput,
  categories: CategoryRow[],
): ClassificationOutput | null {
  const haystack = `${tx.counterparty ?? ""} ${tx.reference ?? ""} ${tx.description ?? ""}`
  for (const rule of VENDOR_FAST_PATH) {
    if (!rule.rx.test(haystack)) continue
    // Find best matching category in user's list within the right scope
    const cat =
      categories.find(
        (c) =>
          c.scope === rule.scope &&
          c.kind === "expense" &&
          c.name.toLowerCase().includes(rule.categoryHint),
      ) ??
      categories.find(
        (c) =>
          c.scope === rule.scope &&
          c.kind === "expense" &&
          // also match common German names
          (c.name.toLowerCase().includes("software") ||
            c.name.toLowerCase().includes("abo")),
      ) ??
      null
    return {
      category_id: cat?.id ?? null,
      category_name: cat?.name,
      scope: rule.scope,
      confidence: 92,
      source: "rule",
      reason: rule.reason,
    }
  }
  return null
}

// ─── Main entry point ─────────────────────────────────────────────────────

export async function classifyTransactions(
  userId: string,
  txs: ClassificationInput[],
  supabase: SupabaseClient,
): Promise<ClassificationOutput[]> {
  if (txs.length === 0) return []

  // Fetch user's rules (most-recently-used first, capped at 200)
  const { data: rulesData } = await supabase
    .from("categorization_rules")
    .select("id, match_pattern, match_field, category_id, scope, confidence")
    .eq("user_id", userId)
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("confidence", { ascending: false })
    .limit(200)

  const rules: RuleRow[] = (rulesData ?? []) as RuleRow[]

  // Fetch user's categories
  const { data: catsData } = await supabase
    .from("categories")
    .select("id, name, scope, kind, color")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })

  const categories: CategoryRow[] = (catsData ?? []) as CategoryRow[]

  // ─── 1) Rule pass ───────────────────────────────────────────────────────
  const results: (ClassificationOutput | null)[] = txs.map(() => null)
  const aiBatchIdx: number[] = []
  const aiBatch: ClassificationInput[] = []

  // Find the "Bürgergeld (Jobcenter)" income category (personal income).
  const buergergeldCat =
    categories.find(
      (c) =>
        c.scope === "personal" &&
        c.kind === "income" &&
        /b[üu]rgergeld/i.test(c.name),
    ) ?? null

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i]

    // ── Bürgergeld fast-path: rule wins, no AI call ────────────────────
    if (isBuergergeldCandidate(tx)) {
      results[i] = {
        category_id: buergergeldCat?.id ?? null,
        category_name: buergergeldCat?.name ?? "Bürgergeld (Jobcenter)",
        scope: "personal",
        confidence: 95,
        source: "rule",
        reason: "Bürgergeld erkannt (Jobcenter / Agentur für Arbeit)",
        is_buergergeld: true,
      }
      continue
    }

    // ── Known-vendor fast-path: deterministic SaaS / consumer brands ──
    const vendorMatch = matchVendorFastPath(tx, categories)
    if (vendorMatch) {
      results[i] = vendorMatch
      continue
    }

    const matched = matchAgainstRules(tx, rules, categories)
    if (matched) {
      results[i] = matched
    } else {
      aiBatchIdx.push(i)
      aiBatch.push(tx)
    }
  }

  // ─── 2) AI pass for the rest ────────────────────────────────────────────
  if (aiBatch.length > 0) {
    let aiResults: ClassificationOutput[] = []
    try {
      aiResults = await classifyWithAi(aiBatch, categories)
    } catch (err) {
      console.warn("[transaction-classifier] AI batch failed:", err)
      aiResults = aiBatch.map(() => emptyResult())
    }
    for (let i = 0; i < aiBatchIdx.length; i++) {
      results[aiBatchIdx[i]] = aiResults[i] ?? emptyResult()
    }
  }

  return results.map((r) => r ?? emptyResult())
}

// ─── Rule matching ────────────────────────────────────────────────────────

function matchAgainstRules(
  tx: ClassificationInput,
  rules: RuleRow[],
  categories: CategoryRow[],
): ClassificationOutput | null {
  const counterparty = (tx.counterparty ?? "").toLowerCase()
  const reference = (tx.reference ?? "").toLowerCase()
  if (!counterparty && !reference) return null

  for (const rule of rules) {
    const needle = rule.match_pattern.trim().toLowerCase()
    if (!needle) continue

    let hay = ""
    switch (rule.match_field) {
      case "counterparty":
        hay = counterparty
        break
      case "reference":
        hay = reference
        break
      case "both":
        hay = `${counterparty} ${reference}`
        break
      default:
        hay = counterparty
    }
    if (!hay.includes(needle)) continue

    const cat = categories.find((c) => c.id === rule.category_id)
    return {
      category_id: rule.category_id,
      category_name: cat?.name,
      scope: rule.scope,
      confidence: rule.confidence,
      source: "rule",
      reason: `Regel: „${rule.match_pattern}" → ${cat?.name ?? "Kategorie"}`,
    }
  }
  return null
}

// ─── AI fallback ──────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT_HEADER = `Du bist ein präziser Klassifikator für deutsche Bank-Transaktionen.

Aufgabe: Für JEDE Transaktion bestimme die BESTE passende Kategorie aus der vom Nutzer vorgegebenen Liste, sowie scope (business / personal).

WICHTIG:
- Wähle ausschließlich Kategorie-Namen, die WORTGENAU in der unten gelisteten Nutzer-Kategorienliste vorkommen. Keine erfundenen Namen.
- Wenn keine perfekt passt → wähle die NÄCHSTBESTE und senke confidence auf < 60.
- scope = "personal" für: Lebensmittel, Restaurants (nicht-Geschäftsessen), Streaming-Dienste, Kleidung, Drogerie, Unterhaltung, Apotheke, private Versicherung, Miete privat, Strom privat.
- scope = "business" für: Büromaterial, SaaS-Abos, B2B-Dienste, Coworking, Geschäftsreisen, Bewirtung Geschäftsessen, Hosting, Domains, Marketing, Steuerberater, Geschäftsversicherung.

Deutsche Vendor-Heuristiken:
- ALDI / REWE / EDEKA / LIDL / NETTO / PENNY / KAUFLAND / DM / Rossmann / Müller → personal Lebensmittel/Drogerie
- McDonald's / Burger King / KFC / Subway / Lieferando / Wolt → personal Restaurants/Auswärts essen
- Spotify / Netflix / Disney+ / Apple Music / Amazon Prime → personal Streaming-Dienste / Abos
- Amazon Web Services / AWS / Hetzner / Vercel / Netlify / Cloudflare / DigitalOcean → business SaaS/Hosting
- Google Workspace / Microsoft 365 / GitHub / Adobe / Anthropic / OpenAI / Linear / Notion → business SaaS/Software
- Vodafone / Telekom / O2 / 1&1 (private contracts) → personal Internet & Handy
- Aral / Shell / Esso / Total / Star / Jet → kann beides; ohne klaren Hinweis personal Tankstelle
- Jobcenter / Agentur für Arbeit / Bundesagentur für Arbeit / ARGE / Arbeitsamt → personal Bürgergeld (Jobcenter) — IMMER mit "is_buergergeld": true markieren wenn der Eingang vom Jobcenter / Bundesagentur kommt ODER der Verwendungszweck "Bürgergeld" / "ALG II" / "Arbeitslosengeld II" enthält
- Familienkasse → personal Kindergeld (NICHT Bürgergeld)
- Finanzamt → personal Steuererstattung (Einkommen) oder business Steuern (Ausgabe)
- DHL / DPD / Hermes / GLS / UPS → business Porto/Versand wenn klein, sonst personal
- Bankgebühren / Kontoführung → business Bankgebühren

BÜRGERGELD-ERKENNUNG (sehr wichtig für unsere Nutzer auf Bürgergeld / Aufstocker):
- Eingehende Zahlungen vom Jobcenter / Bundesagentur für Arbeit / ARGE / Arbeitsamt SIND Bürgergeld-Leistungen.
- Setze in solchen Fällen "is_buergergeld": true UND scope: "personal" UND category_name: "Bürgergeld (Jobcenter)".
- Bürgergeld ist KEIN reguläres Einkommen — es wird separat erfasst.
- Bei Ausgaben oder unklaren Fällen → "is_buergergeld": false.

KRYPTO / COINBASE / EXCHANGE-OPERATIONEN (sehr wichtig — verhindert Doppelzählung):
- Eine "Converted X USDC to Y EURC" / "Sold X EURC for Y EUR" / "Exchanged X for Y" — IST KEIN EINKOMMEN.
  Das ist nur eine Form-Umwandlung innerhalb derselben Wallet (USD-Stablecoin → EUR-Stablecoin → EUR).
  Setze für solche Zeilen: scope: "personal", category_name: <eine "Sonstiges" / "Inne" Kategorie>, is_transfer: true (falls Feld unterstützt) UND confidence: 95.
- "Withdrawal to <Bank/Karte>" von Coinbase / Kraken / Binance / Bitvavo / Bitpanda — IST KEIN AUSGABE, es ist ein Transfer auf dein eigenes Bankkonto.
  Setze scope: "personal", category_name: "Sonstiges" / "Sonstige Betriebsausgaben", is_transfer: true.
- "Received X USDC/BTC/ETH/EURC from external account" — KANN Einkommen vom Kunden ODER ein Transfer von eigenem externen Wallet sein.
  WENN counterparty_name auf einen Geschäftspartner / bekannten Service hindeutet → scope: "business", category: "Erlöse Dienstleistungen", confidence: 60-75.
  WENN counterparty leer / unklar → scope: "personal", category: "Sonstiges", confidence: 40 (User soll prüfen).
- "Deposit" / "Buy <Crypto> with EUR" — kein Einkommen, Form-Umwandlung. is_transfer: true.
- Krypto-Asset-Bezeichnungen erkennen: BTC, ETH, USDC, USDT, EURC, EUROC, DAI, BNB, SOL, XRP, ADA, DOGE, EUR (bei Coinbase-Statements).

Output-Format: AUSSCHLIESSLICH reines JSON, kein Markdown, keine Code-Fences.
Schema:
{
  "classifications": [
    { "index": <int>, "category_name": "<exakter Name aus Liste>", "scope": "business" | "personal", "confidence": <0-100>, "reason": "<1 kurzer Satz auf Deutsch>", "is_buergergeld": <bool> }
  ]
}`

async function classifyWithAi(
  txs: ClassificationInput[],
  categories: CategoryRow[],
): Promise<ClassificationOutput[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return txs.map(() => emptyResult())
  }

  // Build category list by scope+kind
  const catList = formatCategoryListForPrompt(categories)
  const systemPrompt = `${AI_SYSTEM_PROMPT_HEADER}

NUTZER-KATEGORIEN (verwende ausschließlich diese Namen):

${catList}`

  const userMsg = buildUserMessage(txs)

  const client = new Anthropic({ apiKey })
  let response
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMsg },
        { role: "assistant", content: [{ type: "text", text: "{" }] },
      ],
    })
  } catch (err) {
    console.error("[transaction-classifier] Anthropic call failed:", err)
    return txs.map(() => emptyResult())
  }

  const textBlock = response.content.find((b) => b.type === "text")
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : ""
  const jsonStr = stripFences("{" + raw)

  let parsed: { classifications?: AiClassification[] }
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    console.error(
      "[transaction-classifier] JSON parse failed:",
      err,
      jsonStr.slice(0, 400),
    )
    return txs.map(() => emptyResult())
  }

  const byIdx = new Map<number, AiClassification>()
  for (const c of parsed.classifications ?? []) {
    if (typeof c.index === "number") byIdx.set(c.index, c)
  }

  return txs.map((_tx, i) => {
    const ai = byIdx.get(i)
    if (!ai) return emptyResult()
    const resolved = resolveCategory(ai.category_name, ai.scope, categories)
    return {
      category_id: resolved?.id ?? null,
      category_name: resolved?.name ?? ai.category_name,
      scope: ai.scope === "personal" ? "personal" : "business",
      confidence: clamp(Math.round(ai.confidence ?? 0), 0, 100),
      source: "ai",
      reason: ai.reason,
      is_buergergeld: ai.is_buergergeld === true,
    }
  })
}

function formatCategoryListForPrompt(cats: CategoryRow[]): string {
  const buckets: Record<string, string[]> = {
    "BUSINESS · expense": [],
    "BUSINESS · income": [],
    "PERSONAL · expense": [],
    "PERSONAL · income": [],
  }
  for (const c of cats) {
    const key = `${c.scope.toUpperCase()} · ${c.kind}`
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(c.name)
  }
  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([head, list]) => `${head}:\n  - ${list.join("\n  - ")}`)
    .join("\n\n")
}

function buildUserMessage(txs: ClassificationInput[]): string {
  const lines = txs.map((tx, i) => {
    const sign = tx.amount_cents >= 0 ? "+" : "-"
    const amt = (Math.abs(tx.amount_cents) / 100).toFixed(2)
    const cp = tx.counterparty ?? "—"
    const ref = (tx.reference ?? tx.description ?? "").replace(/\s+/g, " ").slice(0, 200)
    return `[${i}] ${sign}${amt}€ | counterparty: "${cp}" | reference: "${ref}"`
  })
  return `Klassifiziere folgende Transaktionen. Antworte mit reinem JSON gemäß Schema.

${lines.join("\n")}`
}

function resolveCategory(
  name: string | undefined,
  scope: "business" | "personal",
  cats: CategoryRow[],
): CategoryRow | null {
  if (!name) return null
  const want = name.trim().toLowerCase()
  if (!want) return null

  // Exact match in same scope first
  let hit = cats.find((c) => c.scope === scope && c.name.toLowerCase() === want)
  if (hit) return hit
  // Exact match across scopes
  hit = cats.find((c) => c.name.toLowerCase() === want)
  if (hit) return hit
  // Substring (either direction) within same scope
  hit = cats.find(
    (c) =>
      c.scope === scope &&
      (c.name.toLowerCase().includes(want) ||
        want.includes(c.name.toLowerCase())),
  )
  if (hit) return hit
  // Substring across scopes
  hit = cats.find(
    (c) =>
      c.name.toLowerCase().includes(want) ||
      want.includes(c.name.toLowerCase()),
  )
  return hit ?? null
}

function emptyResult(): ClassificationOutput {
  return {
    category_id: null,
    scope: "business",
    confidence: 0,
    source: "none",
  }
}

function stripFences(s: string): string {
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
