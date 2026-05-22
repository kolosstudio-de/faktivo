/**
 * Claude AI parser for German bank-statement PDFs.
 *
 * Takes the raw text extracted from a Kontoauszug-PDF and asks
 * `claude-haiku-4-5` (cheap, fast — ~$0.01 per statement) to
 * produce a strictly typed JSON ParsedStatement.
 *
 * Supported formats: Sparkasse, Volksbank, DKB, ING, Commerzbank,
 * N26, Postbank, Deutsche Bank, comdirect, Targobank.
 *
 * Errors:
 *   - missing key  → throws Error("ANTHROPIC_API_KEY_MISSING")
 *   - rate limited → throws Error("AI_RATE_LIMIT")
 *   - bad JSON     → throws Error("AI_PARSE_FAILED")
 */

import Anthropic from "@anthropic-ai/sdk"

export interface ParsedTransaction {
  /** ISO YYYY-MM-DD */
  occurred_on: string
  /** Signed cents — negative = debit/expense, positive = credit/income */
  amount_cents: number
  /** ISO 4217 — defaults to "EUR" */
  currency: string
  /** Short label / counterparty description (≤80 chars) */
  description: string
  /** Empfänger / Auftraggeber name if present */
  counterparty?: string
  /** Full Verwendungszweck */
  reference?: string
  /** Counterparty IBAN if shown */
  iban?: string
  type: "credit" | "debit"
}

export interface ParsedStatement {
  bank_name?: string
  account_iban?: string
  /** ISO YYYY-MM-DD */
  period_start?: string
  /** ISO YYYY-MM-DD */
  period_end?: string
  opening_balance_cents?: number
  closing_balance_cents?: number
  transactions: ParsedTransaction[]
  warnings: string[]
}

const SYSTEM_PROMPT = `You are a precise extractor of bank-statement transactions from German PDFs.

Output: ONE JSON object matching this TypeScript interface:
{
  "bank_name"?: string,
  "account_iban"?: string,
  "period_start"?: string,
  "period_end"?: string,
  "opening_balance_cents"?: number,
  "closing_balance_cents"?: number,
  "transactions": [{
    "occurred_on": string,
    "amount_cents": number,
    "currency": string,
    "description": string,
    "counterparty"?: string,
    "reference"?: string,
    "iban"?: string,
    "type": "credit" | "debit"
  }],
  "warnings": string[]
}

Rules:
- All dates in YYYY-MM-DD format. German "TT.MM.JJJJ" → ISO. Two-digit years 00-79 → 20xx, 80-99 → 19xx.
- amount_cents: signed integer in CENTS. €10,50 income → 1050. €-10,50 expense → -1050. Use minus for "Sollumsatz" / "Lastschrift" / "S" / "Belastung", plus for "Habenumsatz" / "Gutschrift" / "H" / "Eingang".
- type: "credit" if positive, "debit" if negative.
- description: short summary (≤80 chars). Take from "Buchungstext" / payee name / first line of Verwendungszweck.
- counterparty: "Empfänger" or "Auftraggeber" name if available.
- reference: full "Verwendungszweck" text if present (joined lines).
- iban: counterparty IBAN if shown (DE.. format), else omit.
- bank_name: top-of-page bank brand (e.g. "Sparkasse Berlin", "DKB", "Commerzbank", "ING-DiBa", "N26", "Volksbank …", "Postbank", "comdirect", "Targobank", "Deutsche Bank").
- account_iban: the user's own IBAN at the top/header of the statement.
- period_start / period_end: from "Auszugszeitraum" / "Kontoauszug vom … bis …" / column dates min/max.
- opening_balance_cents / closing_balance_cents: signed totals — "Alter Saldo" / "Neuer Saldo" / "Anfangssaldo" / "Endsaldo".
- currency: 3-letter ISO. Default "EUR" if not stated.
- warnings: array of short notes about unsure parsings, multi-currency rows, missing IBANs, partial pages, etc. Empty array if none.

Output ONLY the JSON object. No markdown fences, no prose, no comments. Start with "{" and end with "}".`

const MAX_INPUT_CHARS = 60000

export async function parseStatementWithClaude(
  text: string
): Promise<ParsedStatement> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY_MISSING")
  }

  // Defensive truncation — extremely long PDFs (>60k chars) are likely
  // scans-with-text-layer or multi-month archives. Truncate to keep us
  // inside Haiku's 200k-token window with comfortable headroom.
  const trimmed =
    text.length > MAX_INPUT_CHARS
      ? text.slice(0, MAX_INPUT_CHARS) +
        "\n\n[…truncated for length — extract what you can]"
      : text

  const client = new Anthropic({ apiKey })

  let response
  try {
    response = await client.messages.create({
      // claude-haiku-4-5 ist der aktuelle günstige Modell-Tier (Apr 2026).
      // Bank-Auszüge haben ~5k Tokens Input + ~2k Output → ca. $0.01 pro Import.
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the bank-statement data from the following PDF text. Output JSON only.\n\n--- BEGIN PDF TEXT ---\n${trimmed}\n--- END PDF TEXT ---`,
            },
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
    console.error("[pdf-statement-parser] Anthropic call failed:", err)
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
      "[pdf-statement-parser] JSON parse failed:",
      err,
      "raw:",
      cleaned.slice(0, 500)
    )
    throw new Error("AI_PARSE_FAILED")
  }

  return normalizeStatement(parsed)
}

function stripFences(s: string): string {
  // Defence in depth — remove ```json ... ``` if Claude ignores the rules.
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim()
}

function normalizeStatement(value: unknown): ParsedStatement {
  if (!value || typeof value !== "object") {
    throw new Error("AI_PARSE_FAILED")
  }
  const o = value as Record<string, unknown>
  const txs = Array.isArray(o.transactions)
    ? o.transactions.map(normalizeTransaction).filter(Boolean) as ParsedTransaction[]
    : []
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.filter((w): w is string => typeof w === "string")
    : []

  return {
    bank_name: optStr(o.bank_name),
    account_iban: optStr(o.account_iban),
    period_start: optDate(o.period_start),
    period_end: optDate(o.period_end),
    opening_balance_cents: optInt(o.opening_balance_cents),
    closing_balance_cents: optInt(o.closing_balance_cents),
    transactions: txs,
    warnings,
  }
}

function normalizeTransaction(value: unknown): ParsedTransaction | null {
  if (!value || typeof value !== "object") return null
  const o = value as Record<string, unknown>
  const date = optDate(o.occurred_on)
  const amount = optInt(o.amount_cents)
  if (!date || amount === undefined) return null

  const description =
    optStr(o.description) ??
    optStr(o.reference) ??
    optStr(o.counterparty) ??
    "—"

  // type derived from amount sign if Claude got it wrong.
  const rawType = optStr(o.type)
  const type: "credit" | "debit" =
    rawType === "credit" || rawType === "debit"
      ? rawType
      : amount >= 0
        ? "credit"
        : "debit"

  return {
    occurred_on: date,
    amount_cents: amount,
    currency: optStr(o.currency) ?? "EUR",
    description: description.slice(0, 200),
    counterparty: optStr(o.counterparty),
    reference: optStr(o.reference),
    iban: optStr(o.iban),
    type,
  }
}

function optStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function optInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v)
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d\-]/g, ""))
    return Number.isFinite(n) ? Math.round(n) : undefined
  }
  return undefined
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
