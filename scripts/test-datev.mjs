#!/usr/bin/env node
/**
 * Standalone unit-tests für src/lib/datev/extf700.ts (DATEV-Buchungsstapel).
 * Lauf: `tsx scripts/test-datev.mjs` (oder `npm run test:datev`).
 *
 * Verifiziert §146 GoBD-konforme Ausgabe für den Steuerberater:
 *  - Header-Format ("EXTF";700;21;…)
 *  - Spalten-Reihenfolge laut DATEV-Spec 7.0
 *  - DE-Locale (Komma als Dezimaltrennzeichen, DDMMYYYY)
 *  - SKR03-Kontenzuordnung (8400=19%, 8300=7%, 8195=KU, 8336=Reverse, …)
 *  - VAT-Splitting bei Mehrsatz-Rechnungen + Rundungsdrift-Korrektur
 *  - Soll/Haben-Richtung (positiv=H, negativ=S)
 *  - Quote-Escaping in Buchungstext / Belegnr
 *  - Filter-Logik (locked_at-only, scope=business, is_deductible-only)
 *
 * Bewusst kein Vitest — gleiche Konvention wie test-money / test-jobcenter,
 * damit CI-cold-start ohne Vitest/Jest läuft.
 */

await import("tsx/esm").catch(() => {})

let generateExtf700
try {
  ;({ generateExtf700 } = await import("../src/lib/datev/extf700.ts"))
} catch (e) {
  console.error("Konnte src/lib/datev/extf700 nicht laden:", e.message)
  process.exit(2)
}

// ─── Mini-Test-Framework ───────────────────────────────────────────────────
let passed = 0
let failed = 0
const fails = []

function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    fails.push({ name, actual, expected })
    console.log(`  ✗ ${name}`)
    console.log(`      expected: ${JSON.stringify(expected)}`)
    console.log(`      actual:   ${JSON.stringify(actual)}`)
  }
}

function truthy(actual, name) {
  if (actual) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    fails.push({ name, actual, expected: "truthy" })
    console.log(`  ✗ ${name} (was: ${JSON.stringify(actual)})`)
  }
}

function section(name) {
  console.log(`\n━━ ${name} ━━`)
}

// ─── Fixtures ──────────────────────────────────────────────────────────────
//
// Minimale Datenobjekte, nur die Felder, die der Generator anfasst. Wir
// vermeiden bewusst @/types/database.types-Import-Casting via `any` —
// das Skript läuft als Node-ESM, TypeScript-Strict greift nicht.

const minimalSettings = {
  company_name: "Müller GmbH",
  // (alle anderen Settings-Felder werden vom Generator nicht angefasst)
}

function invoice(overrides = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    number: "RE-2026-001",
    issue_date: "2026-04-15",
    locked_at: "2026-04-15T10:00:00Z",
    is_kleinunternehmer_at_issue: false,
    reverse_charge: false,
    total_cents: 11900, // 100€ netto + 19% USt = 119€ brutto
    ...overrides,
  }
}

function lineItem(overrides = {}) {
  return {
    id: "li-1",
    vat_rate: 19,
    line_subtotal_cents: 10000,
    line_vat_cents: 1900,
    ...overrides,
  }
}

// Output-Parser: trennt Header, ColHeader und Buchungszeilen.
function parse(csv) {
  const lines = csv.split("\n")
  return {
    headerLine: lines[0],
    colHeaderLine: lines[1],
    bookingLines: lines.slice(2).filter((l) => l.length > 0),
  }
}

function fieldsOf(line) {
  return line.split(";")
}

// ─── 1. Header (EXTF spec) ─────────────────────────────────────────────────
section("Header — line 1 = EXTF-Format-Erkennung")
{
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const { headerLine } = parse(csv)
  const fields = fieldsOf(headerLine)

  eq(fields[0], '"EXTF"', '[0] format-magic "EXTF"')
  eq(fields[1], "700", "[1] version 700")
  eq(fields[2], "21", "[2] format 21 (Buchungsstapel)")
  eq(fields[3], '"Buchungsstapel"', "[3] Buchungsstapel-Label")
  eq(fields[4], "9", "[4] FormatDaten 9")
  truthy(/^\d{14}$/.test(fields[5]), "[5] headerDate ist yyyyMMddHHmmss (14 digits)")
  eq(fields[12], "20260101", "[12] WJ-Beginn yyyyMMdd from year(from)")
  eq(fields[13], "4", "[13] Sachkontonummer-Länge = 4")
  eq(fields[14], "20260101", "[14] Datum-Anfang (yyyyMMdd, no dashes)")
  eq(fields[15], "20261231", "[15] Datum-Ende (yyyyMMdd)")
  eq(fields[18], "1", "[18] Buchungstyp = 1 (Finanzbuchführung)")
  eq(fields[21], '"EUR"', "[21] Währung EUR")
}

// ─── 2. Beratungs-/Mandantennummer override ────────────────────────────────
section("Header — beraternummer + mandantennummer overrides")
{
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
    beraternummer: "12345",
    mandantennummer: "999",
  })
  const fields = fieldsOf(parse(csv).headerLine)
  eq(fields[10], "12345", "[10] beraternummer override durchgesetzt")
  eq(fields[11], "999", "[11] mandantennummer override durchgesetzt")
}

// ─── 3. Spalten-Header (column header row) ─────────────────────────────────
section("Spalten-Header — line 2 = exakt 14 DATEV-Spalten")
{
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const { colHeaderLine } = parse(csv)
  const expected = [
    '"Umsatz (ohne Soll/Haben-Kz)"',
    '"Soll/Haben-Kennzeichen"',
    '"WKZ Umsatz"',
    '"Kurs"',
    '"Basis-Umsatz"',
    '"WKZ Basis-Umsatz"',
    '"Konto"',
    '"Gegenkonto (ohne BU-Schlüssel)"',
    '"BU-Schlüssel"',
    '"Belegdatum"',
    '"Belegfeld 1"',
    '"Belegfeld 2"',
    '"Skonto"',
    '"Buchungstext"',
  ]
  eq(colHeaderLine, expected.join(";"), "Spalten-Header 1:1 wie Spec")
  eq(fieldsOf(colHeaderLine).length, 14, "14 Spalten exakt")
}

// ─── 4. Empty input — nur Header + ColHeader, keine Buchungen ──────────────
section("Empty input — keine Buchungen")
{
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const { bookingLines } = parse(csv)
  eq(bookingLines.length, 0, "0 Buchungen ohne Input")
  truthy(csv.endsWith("\n"), "Output endet auf Newline (POSIX)")
}

// ─── 5. Rechnung 19% USt — Standard-Fall ───────────────────────────────────
section("Rechnung 19% USt → Konto 8400, BU 3")
{
  const inv = invoice() // 100€ + 19% = 119€
  const li = lineItem({ vat_rate: 19, line_subtotal_cents: 10000, line_vat_cents: 1900 })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: [li] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const { bookingLines } = parse(csv)
  eq(bookingLines.length, 1, "genau 1 Buchungszeile bei 1-Satz-Rechnung")
  const f = fieldsOf(bookingLines[0])
  eq(f[0], "119,00", "[0] Umsatz mit Komma als Decimal")
  eq(f[1], "H", "[1] Soll/Haben = H (positiv Forderung)")
  eq(f[2], "EUR", "[2] WKZ Umsatz EUR")
  eq(f[6], "1400", "[6] Konto = Forderungen (1400)")
  eq(f[7], "8400", "[7] Gegenkonto = Erlöse 19% (8400)")
  eq(f[8], "3", "[8] BU-Schlüssel = 3 (19% USt-Berechnung)")
  eq(f[9], "15042026", "[9] Belegdatum DDMMYYYY (15.04.2026)")
  eq(f[10], '"RE-2026-001"', '[10] Belegfeld 1 = quoted Rechnungsnummer')
  eq(f[13], '"Rechnung RE-2026-001"', "[13] Buchungstext = Rechnung <nr>")
}

// ─── 6. Rechnung 7% USt — ermäßigt ─────────────────────────────────────────
section("Rechnung 7% USt → Konto 8300, BU 2")
{
  const inv = invoice({ total_cents: 10700 }) // 100€ + 7% = 107€
  const li = lineItem({ vat_rate: 7, line_subtotal_cents: 10000, line_vat_cents: 700 })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: [li] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  eq(f[0], "107,00", "Umsatz 107,00")
  eq(f[7], "8300", "Gegenkonto = Erlöse 7% (8300)")
  eq(f[8], "2", "BU = 2 (7% USt)")
}

// ─── 7. Kleinunternehmer §19 — kein USt-Schlüssel ──────────────────────────
section("Kleinunternehmer §19 → Konto 8195, BU leer")
{
  const inv = invoice({
    total_cents: 10000,
    is_kleinunternehmer_at_issue: true,
  })
  const li = lineItem({ vat_rate: 0, line_subtotal_cents: 10000, line_vat_cents: 0 })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: [li] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  eq(f[7], "8195", "Gegenkonto = Erlöse steuerfrei (8195)")
  eq(f[8], "", "BU leer für KU — kein USt-Schlüssel")
}

// ─── 8. Reverse-Charge §13b — innerg. Leistung ─────────────────────────────
section("Reverse-Charge §13b → Konto 8336, BU 8")
{
  const inv = invoice({
    total_cents: 10000,
    reverse_charge: true,
  })
  const li = lineItem({ vat_rate: 0, line_subtotal_cents: 10000, line_vat_cents: 0 })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: [li] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  eq(f[7], "8336", "Gegenkonto = Erlöse Reverse Charge (8336)")
  eq(f[8], "8", "BU = 8 (Reverse Charge)")
}

// ─── 9. Mehrsatz-Splitting (19% + 7%) ──────────────────────────────────────
section("Mehrsatz-Rechnung 19% + 7% → 2 Buchungszeilen")
{
  const inv = invoice({ total_cents: 22600 }) // 119 (100+19) + 107 (100+7)
  const lines = [
    lineItem({ id: "li1", vat_rate: 19, line_subtotal_cents: 10000, line_vat_cents: 1900 }),
    lineItem({ id: "li2", vat_rate: 7, line_subtotal_cents: 10000, line_vat_cents: 700 }),
  ]
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: lines },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const { bookingLines } = parse(csv)
  eq(bookingLines.length, 2, "2 Buchungszeilen für 2 USt-Sätze")

  // Höchster Satz zuerst (Konvention im Generator)
  const f1 = fieldsOf(bookingLines[0])
  eq(f1[0], "119,00", "[1] 19%-Bucket = 119,00")
  eq(f1[7], "8400", "[1] Konto 8400")
  eq(f1[8], "3", "[1] BU 3")
  truthy(f1[13].includes("(19 % USt)"), "[1] Buchungstext markiert USt-Satz")

  const f2 = fieldsOf(bookingLines[1])
  eq(f2[0], "107,00", "[2] 7%-Bucket = 107,00 (als Rest aus total - 119)")
  eq(f2[7], "8300", "[2] Konto 8300")
  eq(f2[8], "2", "[2] BU 2")
}

// ─── 10. Rundungsdrift — letzter Bucket trägt Rest ─────────────────────────
section("Rundungsdrift — letzter Bucket trägt den Rest, Summe = total")
{
  // total_cents = 22601 (1 Cent mehr als Summe der Line-Buckets 11900+10700).
  // Der Generator MUSS den 1 Cent auf den letzten Bucket schieben, damit
  // Forderungen-Summe in der Steuerberater-Buchhaltung aufgeht.
  const inv = invoice({ total_cents: 22601 })
  const lines = [
    lineItem({ id: "li1", vat_rate: 19, line_subtotal_cents: 10000, line_vat_cents: 1900 }),
    lineItem({ id: "li2", vat_rate: 7, line_subtotal_cents: 10000, line_vat_cents: 700 }),
  ]
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: lines },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const bls = parse(csv).bookingLines
  const sum =
    parseInt(fieldsOf(bls[0])[0].replace(",", ""), 10) +
    parseInt(fieldsOf(bls[1])[0].replace(",", ""), 10)
  eq(sum, 22601, "Summe beider Bucket-Umsätze = inv.total_cents exakt")
  eq(
    fieldsOf(bls[1])[0],
    "107,01",
    "letzter Bucket bekommt den 1-Cent-Rundungsrest",
  )
}

// ─── 11. Negative total → Soll-Buchung ─────────────────────────────────────
section("Negatives total (Stornorechnung) → S/H = S")
{
  const inv = invoice({ total_cents: -11900 })
  const li = lineItem({ vat_rate: 19, line_subtotal_cents: -10000, line_vat_cents: -1900 })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: [li] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  eq(f[0], "119,00", "Umsatz immer positiv (Vorzeichen via S/H, nicht number)")
  eq(f[1], "S", "S/H-Kennzeichen = S für negative")
}

// ─── 12. Draft-Rechnung (locked_at=null) wird gefiltert ────────────────────
section("Draft-Rechnung (locked_at=null) wird übersprungen")
{
  const draft = invoice({ locked_at: null })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [draft],
    lineItemsByInvoice: { [draft.id]: [lineItem()] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  eq(parse(csv).bookingLines.length, 0, "Draft erzeugt keine Buchung")
}

// ─── 13. Rechnung ohne Nummer wird gefiltert ───────────────────────────────
section("Rechnung ohne Nummer wird übersprungen (GoBD: keine Buchung ohne Beleg)")
{
  const noNumber = invoice({ number: null })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [noNumber],
    lineItemsByInvoice: { [noNumber.id]: [lineItem()] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  eq(parse(csv).bookingLines.length, 0, "Number=null → keine Buchung")
}

// ─── 14. Total=0 wird gefiltert ────────────────────────────────────────────
section("Rechnung total_cents=0 wird übersprungen")
{
  const zero = invoice({ total_cents: 0 })
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [zero],
    lineItemsByInvoice: { [zero.id]: [lineItem({ line_subtotal_cents: 0, line_vat_cents: 0 })] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  eq(parse(csv).bookingLines.length, 0, "Null-Total → keine Buchung")
}

// ─── 15. Payments — Bank vs Kasse ──────────────────────────────────────────
section("Payments — bank vs cash → Konto 1200 vs 1000")
{
  const bankPay = {
    id: "pay-1",
    amount_cents: 11900,
    paid_at: "2026-04-20",
    method: "bank",
    reference: "",
    invoice: { number: "RE-2026-001" },
  }
  const cashPay = {
    id: "pay-2",
    amount_cents: 5000,
    paid_at: "2026-04-21",
    method: "cash",
    reference: "Bar",
    invoice: { number: "RE-2026-002" },
  }
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [bankPay, cashPay],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const bls = parse(csv).bookingLines
  eq(bls.length, 2, "2 Payment-Buchungen")
  eq(fieldsOf(bls[0])[6], "1200", "[1] Konto = Bank 1200")
  eq(fieldsOf(bls[0])[1], "H", "[1] Bank-Eingang = H")
  eq(fieldsOf(bls[1])[6], "1000", "[2] Konto = Kasse 1000 für cash")
}

// ─── 16. Expense mit USt → BU 9 (Vorsteuer) ────────────────────────────────
section("Expense mit USt → BU 9 (Vorsteuer-Automatik)")
{
  const exp = {
    id: "exp-1-2345-6789",
    amount_cents: 11900,
    vat_rate: 19,
    is_deductible: true,
    occurred_on: "2026-04-25",
    vendor: "Office Depot",
    description: "Bürobedarf",
    category: { skr_code: "4930" },
  }
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [exp],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  eq(f[1], "S", "Ausgabe = S (Soll-Buchung)")
  eq(f[6], "4930", "Konto aus category.skr_code")
  eq(f[7], "1200", "Gegenkonto = Bank")
  eq(f[8], "9", "BU = 9 für Vorsteuer-Automatik")
  truthy(f[13].includes("Office Depot"), "Buchungstext enthält vendor")
}

// ─── 17. Expense ohne is_deductible wird gefiltert ─────────────────────────
section("Expense is_deductible=false wird übersprungen")
{
  const nondeductible = {
    id: "exp-2",
    amount_cents: 5000,
    vat_rate: 19,
    is_deductible: false,
    occurred_on: "2026-04-26",
    vendor: "Persönliches Mittagessen",
    description: "",
    category: null,
  }
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [nondeductible],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  eq(parse(csv).bookingLines.length, 0, "Privatausgabe geht nicht in Buchhaltung")
}

// ─── 18. Extra-Income scope=business wird gebucht ──────────────────────────
section("Extra-Income — scope=business gebucht, sonst gefiltert")
{
  const businessInc = {
    id: "inc-1",
    amount_cents: 30000,
    occurred_on: "2026-05-01",
    source: "Kunde X",
    description: "Bar-Beratung",
    scope: "business",
    category: { skr_code: "8400" },
  }
  const privateInc = {
    id: "inc-2",
    amount_cents: 50000,
    occurred_on: "2026-05-02",
    source: "Erbschaft",
    description: "",
    scope: "private",
    category: null,
  }
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [],
    extraIncome: [businessInc, privateInc],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const bls = parse(csv).bookingLines
  eq(bls.length, 1, "nur Business-Einnahme gebucht")
  const f = fieldsOf(bls[0])
  eq(f[1], "H", "Einnahme = H")
  eq(f[7], "8400", "Gegenkonto aus category.skr_code")
  truthy(f[13].includes("Kunde X"), "Buchungstext enthält source")
}

// ─── 19. Quote-Escape im Buchungstext ──────────────────────────────────────
section("Buchungstext mit Anführungszeichen → korrekt escaped")
{
  const exp = {
    id: "exp-quote",
    amount_cents: 1000,
    vat_rate: 19,
    is_deductible: true,
    occurred_on: "2026-04-30",
    vendor: 'Acme "Premium" Co',
    description: "",
    category: { skr_code: "4930" },
  }
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [],
    payments: [],
    expenses: [exp],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  truthy(
    f[13].includes('""Premium""'),
    'Inner-quote escaped als ""…"" (DATEV/CSV-Standard)',
  )
}

// ─── 20. Date-Format DDMMYYYY (8 digits) ───────────────────────────────────
section("Belegdatum = DDMMYYYY (8 Ziffern, kein Trennzeichen)")
{
  const inv = invoice({ issue_date: "2026-01-05" })
  const li = lineItem()
  const csv = generateExtf700({
    settings: minimalSettings,
    invoices: [inv],
    lineItemsByInvoice: { [inv.id]: [li] },
    payments: [],
    expenses: [],
    extraIncome: [],
    from: "2026-01-01",
    to: "2026-12-31",
  })
  const f = fieldsOf(parse(csv).bookingLines[0])
  eq(f[9], "05012026", "5. Januar 2026 → 05012026 (DDMMYYYY)")
  truthy(/^\d{8}$/.test(f[9]), "exakt 8 Ziffern")
}

// ─── Resultat ──────────────────────────────────────────────────────────────
section("Resultat")
console.log(`  Pass: ${passed}`)
console.log(`  Fail: ${failed}`)

if (failed > 0) {
  console.log("\n  Failed:")
  for (const f of fails) {
    console.log(`    - ${f.name}`)
  }
  process.exit(1)
}

process.exit(0)
