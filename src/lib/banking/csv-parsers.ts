/**
 * CSV-Parser für deutsche Banken — keine Drittanbieter-API nötig.
 *
 * Jeder Bank hat sein eigenes CSV-Format (siehe Online-Banking Export).
 * Wir erkennen automatisch und mappen auf das interne BankTx-Format.
 *
 * Unterstützte Formate:
 *   - N26          (CSV-Export "CSV — kommagetrennt")
 *   - DKB          (CSV-Export aus Finanzstatus / Umsätze)
 *   - Sparkasse    (CAMT-CSV / "Umsätze CSV-CAMT-Format")
 *   - ING-DiBa     (Umsatzbericht CSV)
 *   - Commerzbank  (CSV-Export aus Online Banking)
 *   - Volksbank    (CSV-VR-Format)
 *   - Generic      (Standard SEPA: Datum, Empfänger, Verwendungszweck, Betrag)
 *
 * Datums-Formate: dd.MM.yyyy (DE), yyyy-MM-dd (ISO), MM/dd/yyyy (US)
 * Beträge: 1.234,56 (DE) oder 1234.56 (EN)
 */

export interface ParsedBankTx {
  /** ISO YYYY-MM-DD */
  bookingDate: string
  valueDate: string | null
  /** Cents, negativ = Belastung */
  amountCents: number
  currency: string
  remittanceInfo: string | null
  counterpartyName: string | null
  counterpartyIban: string | null
  /** Auto-detected aus CSV-Type-Spalte (bar/ec_karte/lastschrift/ueberweisung/...). */
  paymentMethod: string | null
  /** Stable hash for idempotency: bankFormat:date:amount:remittance.slice(60) */
  externalId: string
}

/** Mapping CSV-Type → unser payment_method-Vokabular. */
function mapPaymentMethod(rawType: string | undefined): string | null {
  if (!rawType) return null
  const t = rawType.toLowerCase()
  if (/sepa.*credit|credit.*transfer|überweisung|ueberweisung|outgoing.*transfer/.test(t))
    return "ueberweisung"
  if (/sepa.*debit|direct.?debit|lastschrift|einzug|abbuchung/.test(t))
    return "lastschrift"
  if (/card.?payment|kartenzahlung|girocard|ec.?karte|debit.?card/.test(t))
    return "ec_karte"
  if (/credit.?card|kreditkarte/.test(t)) return "kreditkarte"
  if (/paypal/.test(t)) return "paypal"
  if (/cash|bargeld|geldautomat|atm.?withdrawal/.test(t)) return "bar"
  if (/standing.?order|dauerauftrag/.test(t)) return "ueberweisung"
  if (/income|gehalt|salary|gutschrift/.test(t)) return null // Eingang
  return null
}

export type BankFormat =
  | "n26"
  | "dkb"
  | "sparkasse"
  | "ing"
  | "commerzbank"
  | "volksbank"
  | "generic"

export interface ParseResult {
  format: BankFormat
  formatLabel: string
  transactions: ParsedBankTx[]
  warnings: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Parse "1.234,56" or "1234.56" → cents (negative ok). */
function parseAmountCents(s: string): number {
  if (!s) return 0
  const cleaned = s
    .replace(/[^\d.,\-+]/g, "")
    .trim()
  if (!cleaned) return 0
  // Determine decimal separator: last comma OR last dot
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  let normalized: string
  if (lastComma > lastDot) {
    // DE: "1.234,56"
    normalized = cleaned.replace(/\./g, "").replace(",", ".")
  } else {
    // EN: "1,234.56" or "1234.56"
    normalized = cleaned.replace(/,/g, "")
  }
  const n = Number(normalized)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** Parse "27.04.2026" / "2026-04-27" / "27/04/2026" / "04/27/2026" → ISO. */
function parseDate(s: string): string | null {
  if (!s) return null
  const t = s.trim()

  // ISO already
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // dd.MM.yyyy (DE)
  const de = t.match(/^(\d{2})\.(\d{2})\.(\d{2,4})/)
  if (de) {
    const yyyy = de[3].length === 2 ? `20${de[3]}` : de[3]
    return `${yyyy}-${de[2]}-${de[1]}`
  }

  // dd/MM/yyyy (UK) — heuristic: assume DE if first part > 12, else US
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slash) {
    const a = Number(slash[1])
    const b = Number(slash[2])
    const yyyy = slash[3].length === 2 ? `20${slash[3]}` : slash[3]
    // If first > 12 it must be day
    if (a > 12) return `${yyyy}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`
    return `${yyyy}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`
  }

  return null
}

/** Idempotent ID: format:date:amount:remit-prefix */
function makeExternalId(
  format: BankFormat,
  date: string,
  amountCents: number,
  remittance: string | null
): string {
  const remit = (remittance ?? "").replace(/\s+/g, " ").slice(0, 60)
  return `csv-${format}:${date}:${amountCents}:${remit}`
}

// ─── CSV Splitter (handles quoted fields, both ; and , delimiters) ────────

interface ParsedCsv {
  delimiter: string
  rows: string[][]
}

function splitCsv(text: string): ParsedCsv {
  // Strip BOM
  const stripped = text.replace(/^﻿/, "")
  // Normalize line endings
  const normalized = stripped.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = normalized.split("\n").filter((l) => l.trim().length > 0)

  if (lines.length === 0) return { delimiter: ";", rows: [] }

  // Detect delimiter: count ';' vs ',' on first non-trivial line
  const sample = lines[Math.min(5, lines.length - 1)]
  const semi = (sample.match(/;/g) ?? []).length
  const comma = (sample.match(/,/g) ?? []).length
  const tab = (sample.match(/\t/g) ?? []).length
  let delimiter = ";"
  if (tab > Math.max(semi, comma)) delimiter = "\t"
  else if (comma > semi) delimiter = ","

  const rows = lines.map((l) => parseCsvLine(l, delimiter))
  return { delimiter, rows }
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

// ─── Format detection ──────────────────────────────────────────────────────

interface FormatDetector {
  format: BankFormat
  label: string
  match: (text: string) => boolean
  parse: (rows: string[][]) => ParsedBankTx[]
}

const N26: FormatDetector = {
  format: "n26",
  label: "N26",
  match: (t) =>
    t.toLowerCase().includes('"booking date"') ||
    t.toLowerCase().includes("partner name") ||
    /n26.de|n26 bank/.test(t.toLowerCase()),
  parse: (rows) => {
    if (rows.length < 2) return []
    const header = rows[0].map((h) => h.toLowerCase())
    const idx = (k: string) => header.findIndex((h) => h.includes(k))
    const iBook = idx("booking date")
    const iPartner = idx("partner name")
    const iIban = idx("partner iban")
    const iType = idx("type")
    const iRef = idx("payment reference")
    const iAmount = header.findIndex(
      (h) => h.includes("amount") && h.includes("eur")
    )
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      const remit = [r[iType], r[iRef]].filter(Boolean).join(" · ") || null
      const partner = r[iPartner] ?? null
      out.push({
        bookingDate: date,
        valueDate: date,
        amountCents: cents,
        currency: "EUR",
        remittanceInfo: remit,
        counterpartyName: partner,
        counterpartyIban: r[iIban] ?? null,
        paymentMethod: mapPaymentMethod(r[iType]),
        externalId: makeExternalId("n26", date, cents, remit),
      })
    }
    return out
  },
}

const DKB: FormatDetector = {
  format: "dkb",
  label: "DKB",
  match: (t) =>
    t.toLowerCase().includes("buchungstag") &&
    /dkb|deutsche kreditbank/.test(t.toLowerCase()),
  parse: (rows) => {
    // DKB: skip header lines, find row starting with "Buchungstag"
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /^buchungstag$/i.test(c.trim()))
    )
    if (headerIdx < 0 || rows.length < headerIdx + 2) return []
    const header = rows[headerIdx].map((h) => h.toLowerCase())
    const iBook = header.findIndex((h) => /buchungstag/.test(h))
    const iValue = header.findIndex((h) => /wertstellung/.test(h))
    const iText = header.findIndex((h) => /verwendungszweck/.test(h))
    const iPartner = header.findIndex((h) =>
      /(zahlungspflichti|zahlungsempfänger|name)/.test(h)
    )
    const iIban = header.findIndex((h) => /iban/.test(h))
    const iAmount = header.findIndex((h) => /betrag/.test(h))
    const iBuchungsart = header.findIndex((h) => /buchungstext|umsatzart/.test(h))
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(headerIdx + 1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      out.push({
        bookingDate: date,
        valueDate: parseDate(r[iValue] ?? "") ?? date,
        amountCents: cents,
        currency: "EUR",
        remittanceInfo: r[iText] ?? null,
        counterpartyName: iPartner >= 0 ? r[iPartner] ?? null : null,
        counterpartyIban: iIban >= 0 ? r[iIban] ?? null : null,
        paymentMethod: iBuchungsart >= 0 ? mapPaymentMethod(r[iBuchungsart]) : null,
        externalId: makeExternalId("dkb", date, cents, r[iText] ?? null),
      })
    }
    return out
  },
}

const SPARKASSE: FormatDetector = {
  format: "sparkasse",
  label: "Sparkasse (CAMT)",
  match: (t) =>
    /sparkasse|haspa/.test(t.toLowerCase()) ||
    (t.toLowerCase().includes("auftragskonto") &&
      t.toLowerCase().includes("buchungstag")),
  parse: (rows) => {
    if (rows.length < 2) return []
    const header = rows[0].map((h) => h.toLowerCase())
    const iBook = header.findIndex((h) => /buchungstag/.test(h))
    const iValue = header.findIndex((h) => /valuta/.test(h))
    const iText = header.findIndex((h) => /verwendungszweck/.test(h))
    const iPartner = header.findIndex(
      (h) => /(begünstigter|zahlungspflichtiger|name)/i.test(h) && !/auftrag/.test(h)
    )
    const iIban = header.findIndex(
      (h) => /(kontonummer|iban)/.test(h) && !/auftrag/.test(h)
    )
    const iAmount = header.findIndex((h) => /betrag/.test(h))
    const iCurr = header.findIndex((h) => /währung/.test(h))
    const iBuchungsart = header.findIndex((h) => /buchungstext|umsatzart/.test(h))
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      out.push({
        bookingDate: date,
        valueDate: parseDate(r[iValue] ?? "") ?? date,
        amountCents: cents,
        currency: iCurr >= 0 ? r[iCurr] || "EUR" : "EUR",
        remittanceInfo: r[iText] ?? null,
        counterpartyName: iPartner >= 0 ? r[iPartner] ?? null : null,
        counterpartyIban: iIban >= 0 ? r[iIban] ?? null : null,
        paymentMethod: iBuchungsart >= 0 ? mapPaymentMethod(r[iBuchungsart]) : null,
        externalId: makeExternalId("sparkasse", date, cents, r[iText] ?? null),
      })
    }
    return out
  },
}

const ING: FormatDetector = {
  format: "ing",
  label: "ING-DiBa",
  match: (t) =>
    /ing-diba|ing\.de|ingbank/.test(t.toLowerCase()) ||
    (t.includes("Buchung") && t.includes("Auftraggeber/Empfänger")),
  parse: (rows) => {
    // ING: header may be after meta lines like "Umsatzanzeige", find "Buchung"
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /^buchung$/i.test(c.trim()))
    )
    if (headerIdx < 0) return []
    const header = rows[headerIdx].map((h) => h.toLowerCase())
    const iBook = header.findIndex((h) => /^buchung$/.test(h))
    const iValue = header.findIndex((h) => /valuta/.test(h))
    const iPartner = header.findIndex((h) => /auftraggeber|empfänger/.test(h))
    const iText = header.findIndex((h) => /verwendungszweck/.test(h))
    const iAmount = header.findIndex((h) => /betrag/.test(h))
    const iCurr = header.findIndex((h) => /währung/.test(h))
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(headerIdx + 1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      out.push({
        bookingDate: date,
        valueDate: parseDate(r[iValue] ?? "") ?? date,
        amountCents: cents,
        currency: iCurr >= 0 ? r[iCurr] || "EUR" : "EUR",
        remittanceInfo: r[iText] ?? null,
        counterpartyName: iPartner >= 0 ? r[iPartner] ?? null : null,
        counterpartyIban: null,
        paymentMethod: null,
        externalId: makeExternalId("ing", date, cents, r[iText] ?? null),
      })
    }
    return out
  },
}

const COMMERZBANK: FormatDetector = {
  format: "commerzbank",
  label: "Commerzbank",
  match: (t) =>
    /commerzbank|cobadeff/.test(t.toLowerCase()) ||
    (t.includes("Buchungstag") && t.includes("Wertstellung") && t.includes("Umsatzart")),
  parse: (rows) => {
    if (rows.length < 2) return []
    const header = rows[0].map((h) => h.toLowerCase())
    const iBook = header.findIndex((h) => /buchungstag/.test(h))
    const iValue = header.findIndex((h) => /wertstellung/.test(h))
    const iText = header.findIndex((h) => /buchungstext|verwendungs/.test(h))
    const iAmount = header.findIndex((h) => /betrag/.test(h))
    const iCurr = header.findIndex((h) => /währung/.test(h))
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      out.push({
        bookingDate: date,
        valueDate: parseDate(r[iValue] ?? "") ?? date,
        amountCents: cents,
        currency: iCurr >= 0 ? r[iCurr] || "EUR" : "EUR",
        remittanceInfo: r[iText] ?? null,
        counterpartyName: null,
        counterpartyIban: null,
        paymentMethod: null,
        externalId: makeExternalId("commerzbank", date, cents, r[iText] ?? null),
      })
    }
    return out
  },
}

const VOLKSBANK: FormatDetector = {
  format: "volksbank",
  label: "Volksbank/Raiffeisen (VR)",
  match: (t) =>
    /volksbank|raiffeisen|genodef|vr-bank/.test(t.toLowerCase()) ||
    t.includes("Bezeichnung Auftragskonto"),
  parse: (rows) => {
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /buchungstag/i.test(c.trim()))
    )
    if (headerIdx < 0) return []
    const header = rows[headerIdx].map((h) => h.toLowerCase())
    const iBook = header.findIndex((h) => /buchungstag/.test(h))
    const iValue = header.findIndex((h) => /valuta/.test(h))
    const iText = header.findIndex((h) => /verwendungszweck/.test(h))
    const iPartner = header.findIndex((h) => /name|empfänger/.test(h))
    const iIban = header.findIndex((h) => /iban|kontonr/.test(h))
    const iAmount = header.findIndex((h) => /betrag/.test(h))
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(headerIdx + 1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      out.push({
        bookingDate: date,
        valueDate: parseDate(r[iValue] ?? "") ?? date,
        amountCents: cents,
        currency: "EUR",
        remittanceInfo: r[iText] ?? null,
        counterpartyName: iPartner >= 0 ? r[iPartner] ?? null : null,
        counterpartyIban: iIban >= 0 ? r[iIban] ?? null : null,
        paymentMethod: null,
        externalId: makeExternalId("volksbank", date, cents, r[iText] ?? null),
      })
    }
    return out
  },
}

/** Generic fallback: tries to find Datum/Empfänger/Verwendungszweck/Betrag */
const GENERIC: FormatDetector = {
  format: "generic",
  label: "Generisch (CAMT-ähnlich)",
  match: () => true,
  parse: (rows) => {
    if (rows.length < 2) return []
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /(datum|date|buchungstag)/i.test(c.trim()))
    )
    const idx = headerIdx >= 0 ? headerIdx : 0
    const header = rows[idx].map((h) => h.toLowerCase())
    const iBook = header.findIndex((h) =>
      /(buchungstag|datum|^date$|booking)/.test(h)
    )
    const iText = header.findIndex((h) =>
      /(verwendungszweck|reference|reason|description|text)/.test(h)
    )
    const iPartner = header.findIndex((h) =>
      /(empfänger|name|partner|counter|payee|payer)/.test(h)
    )
    const iIban = header.findIndex((h) => /iban/.test(h))
    const iAmount = header.findIndex((h) => /(betrag|amount|value)/.test(h))
    if (iBook < 0 || iAmount < 0) return []
    const out: ParsedBankTx[] = []
    for (const r of rows.slice(idx + 1)) {
      const date = parseDate(r[iBook] ?? "")
      const cents = parseAmountCents(r[iAmount] ?? "")
      if (!date || cents === 0) continue
      out.push({
        bookingDate: date,
        valueDate: date,
        amountCents: cents,
        currency: "EUR",
        remittanceInfo: iText >= 0 ? r[iText] ?? null : null,
        counterpartyName: iPartner >= 0 ? r[iPartner] ?? null : null,
        counterpartyIban: iIban >= 0 ? r[iIban] ?? null : null,
        paymentMethod: null,
        externalId: makeExternalId("generic", date, cents, r[iText] ?? null),
      })
    }
    return out
  },
}

const DETECTORS = [N26, DKB, SPARKASSE, ING, COMMERZBANK, VOLKSBANK]

// ─── Public entry point ────────────────────────────────────────────────────

export function parseBankCsv(text: string): ParseResult {
  const warnings: string[] = []
  const { rows } = splitCsv(text)

  if (rows.length === 0) {
    return {
      format: "generic",
      formatLabel: "leer",
      transactions: [],
      warnings: ["CSV ist leer"],
    }
  }

  // Detect format
  const detector =
    DETECTORS.find((d) => d.match(text)) ?? GENERIC
  const transactions = detector.parse(rows)

  if (transactions.length === 0 && detector !== GENERIC) {
    // Format detected but parsing failed → fall back to generic
    warnings.push(
      `${detector.label} erkannt, aber 0 Transaktionen geparst — versuche Generic-Parser`
    )
    const generic = GENERIC.parse(rows)
    if (generic.length > 0) {
      return {
        format: "generic",
        formatLabel: "Generisch (Fallback)",
        transactions: generic,
        warnings,
      }
    }
  }

  return {
    format: detector.format,
    formatLabel: detector.label,
    transactions,
    warnings,
  }
}
