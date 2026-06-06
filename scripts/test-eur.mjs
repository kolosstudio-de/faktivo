#!/usr/bin/env node
/**
 * Standalone unit-tests für src/lib/eur/compute.ts.
 *
 * Anlage EÜR ist §4 Abs. 3 EStG — die Gewinnermittlung für Freiberufler,
 * Kleinunternehmer und Aufstocker. Wenn die Aggregation hier kaputtgeht,
 * fließen falsche Gewinn-Zahlen ins Jobcenter (Bürgergeld), ins Finanzamt
 * (Einkommensteuer) und auf den ELSTER-Antrag. Direkter Cash-Impact.
 *
 * Lauf: `tsx scripts/test-eur.mjs` (oder `npm run test:eur`).
 *
 * Verifiziert:
 *  - Einnahmen-Summen (Umsatz + Extra-Income)
 *  - Storno als negative Einnahme (§ 17 UStG)
 *  - SKR03-Konto → EÜR-Zeile-Mapping (alle 15 dokumentierten Buckets)
 *  - Unbekannte SKR-Codes → Z58 (Sonstige Betriebsausgaben)
 *  - is_deductible=false wird gefiltert
 *  - private_share_pct-Abzug (z. B. 30% privater Anteil bei Telefon)
 *  - Rundungsverhalten (Math.round bei Cent-Beträgen)
 *  - Gewinn-Formel: einnahmenGesamt − ausgabenGesamt
 *  - Ausgaben sortiert nach Zeile asc
 *  - Empty-Input
 */

await import("tsx/esm").catch(() => {})

let computeEur, mapExpenseToZeile, ZEILE_LABELS
try {
  ;({ computeEur, mapExpenseToZeile, ZEILE_LABELS } = await import(
    "../src/lib/eur/compute.ts"
  ))
} catch (e) {
  console.error("Konnte src/lib/eur/compute nicht laden:", e.message)
  process.exit(2)
}

// ─── Mini-Framework ────────────────────────────────────────────────────────
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

function section(name) {
  console.log(`\n━━ ${name} ━━`)
}

// ─── Fixtures ──────────────────────────────────────────────────────────────
function inv(overrides = {}) {
  return {
    id: "inv-1",
    number: "RE-2026-001",
    issue_date: "2026-03-15",
    total_cents: 11900,
    locked_at: "2026-03-15",
    is_kleinunternehmer_at_issue: false,
    reverse_charge: false,
    ...overrides,
  }
}

function income(overrides = {}) {
  return {
    id: "inc-1",
    occurred_on: "2026-04-01",
    amount_cents: 50000,
    scope: "business",
    ...overrides,
  }
}

function expense(skr, amountCents, overrides = {}) {
  return {
    id: `exp-${Math.floor(Math.random() * 1e6)}`,
    occurred_on: "2026-04-15",
    amount_cents: amountCents,
    is_deductible: true,
    private_share_pct: 0,
    category: { skr_code: skr },
    ...overrides,
  }
}

// ─── 1. SKR03 → Zeile-Mapping — alle 15 Buckets + Fallback ─────────────────
section("mapExpenseToZeile — alle dokumentierten SKR03-Prefixe")
{
  eq(mapExpenseToZeile("3400"), 26, "SKR 3400 (Wareneinkauf) → Z26")
  eq(mapExpenseToZeile("3100"), 27, "SKR 3100 (Fremdleistungen) → Z27")
  eq(mapExpenseToZeile("4100"), 28, "SKR 4100 (Personalkosten) → Z28")
  eq(mapExpenseToZeile("4200"), 30, "SKR 4200 (Raumkosten) → Z30")
  eq(mapExpenseToZeile("4300"), 32, "SKR 4300 (Versicherungen) → Z32")
  eq(mapExpenseToZeile("4500"), 34, "SKR 4500 (KFZ) → Z34")
  eq(mapExpenseToZeile("4660"), 36, "SKR 4660 (Reisekosten) → Z36")
  eq(mapExpenseToZeile("4650"), 37, "SKR 4650 (Bewirtung) → Z37")
  eq(mapExpenseToZeile("4920"), 39, "SKR 4920 (Telefon) → Z39")
  eq(mapExpenseToZeile("4930"), 40, "SKR 4930 (Büromaterial) → Z40")
  eq(mapExpenseToZeile("4610"), 41, "SKR 4610 (Werbung) → Z41")
  eq(mapExpenseToZeile("4955"), 44, "SKR 4955 (Beratung) → Z44")
  eq(mapExpenseToZeile("4945"), 45, "SKR 4945 (Fortbildung) → Z45")
  eq(mapExpenseToZeile("4830"), 48, "SKR 4830 (AfA) → Z48")
  eq(mapExpenseToZeile("4970"), 50, "SKR 4970 (Bankgebühren) → Z50")
}

// ─── 2. Fallback auf Z58 ───────────────────────────────────────────────────
section("mapExpenseToZeile — Fallback auf Z58 (Sonstige)")
{
  eq(mapExpenseToZeile(null), 58, "null-SKR → Z58")
  eq(mapExpenseToZeile(undefined), 58, "undefined-SKR → Z58")
  eq(mapExpenseToZeile(""), 58, "leerer String → Z58")
  eq(mapExpenseToZeile("9999"), 58, "unbekannter SKR-Code → Z58")
  eq(mapExpenseToZeile("7"), 58, "1-Zeichen-Prefix nicht in Map → Z58")
}

// ─── 3. ZEILE_LABELS — alle 16 Zeilen haben Label ──────────────────────────
section("ZEILE_LABELS — alle 16 mapping-Zeilen + Z58 (Default) haben Label")
{
  const expectedZeilen = [26, 27, 28, 30, 32, 34, 36, 37, 39, 40, 41, 44, 45, 48, 50, 58]
  for (const z of expectedZeilen) {
    const label = ZEILE_LABELS[z]
    eq(typeof label, "string", `Z${z} hat string-Label`)
    eq(label.length > 0, true, `Z${z}-Label ist nicht leer`)
  }
}

// ─── 4. Einnahmen — Umsatz + Extra ─────────────────────────────────────────
section("Einnahmen — Summe Umsatz + Extra")
{
  const result = computeEur({
    year: 2026,
    invoices: [
      inv({ total_cents: 11900 }),
      inv({ total_cents: 22600 }),
    ],
    extraIncome: [
      income({ amount_cents: 5000 }),
      income({ amount_cents: 12500 }),
    ],
    expenses: [],
  })
  eq(result.einnahmenUmsatzCents, 34500, "Umsatz = 119 + 226 = 345 €")
  eq(result.einnahmenExtraCents, 17500, "Extra = 50 + 125 = 175 €")
  eq(result.einnahmenGesamtCents, 52000, "Gesamt = 520 €")
}

// ─── 5. Storno als negative Einnahme (§ 17 UStG) ───────────────────────────
section("Storno — negative total_cents reduziert Einnahmen")
{
  const result = computeEur({
    year: 2026,
    invoices: [
      inv({ total_cents: 11900 }),
      inv({ total_cents: -11900, number: "STO-2026-001" }),
    ],
    extraIncome: [],
    expenses: [],
  })
  eq(result.einnahmenUmsatzCents, 0, "Storno hebt Originalrechnung auf")
  eq(result.einnahmenGesamtCents, 0, "Gesamt = 0 nach Storno")
}

// ─── 6. Ausgaben — Bucket-Aggregation ──────────────────────────────────────
section("Ausgaben — Bucket-Aggregation nach Zeile")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [
      expense("4930", 5000), // Büromaterial 50 € → Z40
      expense("4930", 3000), // Büromaterial 30 € → Z40 (gleicher Bucket)
      expense("4920", 9000), // Telefon 90 € → Z39
      expense("3400", 12000), // Wareneinkauf 120 € → Z26
    ],
  })
  eq(result.ausgabenByZeile.length, 3, "3 Buckets (Z26 + Z39 + Z40)")
  const byZeile = Object.fromEntries(
    result.ausgabenByZeile.map((b) => [b.zeile, b.amountCents]),
  )
  eq(byZeile[26], 12000, "Z26 = 120 €")
  eq(byZeile[39], 9000, "Z39 = 90 €")
  eq(byZeile[40], 8000, "Z40 = 80 € (Aggregat von 2 Belegen)")
  eq(result.ausgabenGesamtCents, 29000, "Summe = 290 €")
}

// ─── 7. Sortierung — Buckets ascending nach Zeile ──────────────────────────
section("Sortierung — Ausgaben-Buckets aufsteigend nach Zeilennummer")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [
      expense("4970", 1000), // Z50 (Bank)
      expense("4610", 1000), // Z41 (Werbung)
      expense("4200", 1000), // Z30 (Raum)
      expense("3400", 1000), // Z26 (Waren)
    ],
  })
  const zeilen = result.ausgabenByZeile.map((b) => b.zeile)
  eq(zeilen, [26, 30, 41, 50], "Aufsteigend sortiert nach Zeile")
}

// ─── 8. is_deductible=false wird gefiltert ─────────────────────────────────
section("Filter — is_deductible=false ausgeschlossen")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [
      expense("4930", 5000),
      expense("4930", 3000, { is_deductible: false }), // gefiltert
    ],
  })
  eq(result.ausgabenGesamtCents, 5000, "Nur deductibler Beleg gezählt")
}

// ─── 9. private_share_pct — anteilige Berücksichtigung ─────────────────────
section("private_share_pct — anteiliger Abzug von amount_cents")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [
      // Telefon 100 €, 30 % privat → 70 € als betrieblich
      expense("4920", 10000, { private_share_pct: 30 }),
    ],
  })
  eq(result.ausgabenGesamtCents, 7000, "30% privat → 70 € betrieblich")
}

// ─── 10. private_share_pct = 100 (gar nichts deductible) ──────────────────
section("private_share_pct=100 — Beleg trägt 0 zu Ausgaben bei")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [
      expense("4920", 10000, { private_share_pct: 100 }),
    ],
  })
  eq(result.ausgabenGesamtCents, 0, "100% privat → 0 € betrieblich")
  eq(
    result.ausgabenByZeile.length,
    1,
    "Bucket existiert aber mit 0-Wert (Map-Eintrag bleibt)",
  )
}

// ─── 11. private_share_pct=null behandelt als 0 ────────────────────────────
section("private_share_pct=null — als 0 behandelt (kein Abzug)")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [expense("4920", 10000, { private_share_pct: null })],
  })
  eq(result.ausgabenGesamtCents, 10000, "null → kein Abzug → voller Betrag")
}

// ─── 12. Rundung — Math.round bei Cent-Abzug ───────────────────────────────
section("Rundung — Math.round (banker's nicht half-even)")
{
  // 100 € mit 33.33% privat → 66.67 € deductible → 6667 Cents
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [expense("4920", 10000, { private_share_pct: 33.33 })],
  })
  // 10000 * (1 - 0.3333) = 6667
  eq(result.ausgabenGesamtCents, 6667, "33.33% privat → 6667 Cents (rounded)")
}

// ─── 13. Gewinn-Formel — einnahmen − ausgaben ──────────────────────────────
section("Gewinn — einnahmenGesamt − ausgabenGesamt")
{
  const result = computeEur({
    year: 2026,
    invoices: [inv({ total_cents: 50000 })], // 500 €
    extraIncome: [income({ amount_cents: 10000 })], // 100 €
    expenses: [
      expense("4930", 8000), // 80 € Z40
      expense("4920", 12000), // 120 € Z39
    ],
  })
  eq(result.einnahmenGesamtCents, 60000, "Einnahmen 600 €")
  eq(result.ausgabenGesamtCents, 20000, "Ausgaben 200 €")
  eq(result.gewinnCents, 40000, "Gewinn 400 €")
}

// ─── 14. Negative Gewinn (Verlust) ─────────────────────────────────────────
section("Verlust — Gewinn kann negativ werden (mehr Ausgaben als Einnahmen)")
{
  const result = computeEur({
    year: 2026,
    invoices: [inv({ total_cents: 5000 })],
    extraIncome: [],
    expenses: [expense("4930", 15000)],
  })
  eq(result.gewinnCents, -10000, "Verlust = −100 €")
}

// ─── 15. Empty Input ───────────────────────────────────────────────────────
section("Empty Input — alle Felder = 0, leere Bucket-Liste")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [],
  })
  eq(result.einnahmenUmsatzCents, 0, "Umsatz 0")
  eq(result.einnahmenExtraCents, 0, "Extra 0")
  eq(result.einnahmenGesamtCents, 0, "Gesamt 0")
  eq(result.ausgabenByZeile.length, 0, "Keine Buckets")
  eq(result.ausgabenGesamtCents, 0, "Ausgaben 0")
  eq(result.gewinnCents, 0, "Gewinn 0")
  eq(result.year, 2026, "Year durchgereicht")
}

// ─── 16. Expense ohne category landed in Z58 ──────────────────────────────
section("Expense ohne category → Z58 (Sonstige Betriebsausgaben)")
{
  const result = computeEur({
    year: 2026,
    invoices: [],
    extraIncome: [],
    expenses: [
      {
        id: "exp-nocat",
        amount_cents: 5000,
        is_deductible: true,
        private_share_pct: 0,
        category: null,
        occurred_on: "2026-04-01",
      },
    ],
  })
  eq(result.ausgabenByZeile.length, 1, "1 Bucket")
  eq(result.ausgabenByZeile[0].zeile, 58, "Bucket = Z58 (Default)")
  eq(result.ausgabenByZeile[0].amountCents, 5000, "Voller Betrag in Z58")
  eq(
    result.ausgabenByZeile[0].label,
    "Sonstige Betriebsausgaben",
    "Z58-Label = 'Sonstige Betriebsausgaben'",
  )
}

// ─── 17. EurResult-Shape (Type-Stability) ──────────────────────────────────
section("EurResult — Shape stabil (alle 7 Felder vorhanden)")
{
  const result = computeEur({
    year: 2025,
    invoices: [],
    extraIncome: [],
    expenses: [],
  })
  const keys = Object.keys(result).sort()
  eq(
    keys,
    [
      "ausgabenByZeile",
      "ausgabenGesamtCents",
      "einnahmenExtraCents",
      "einnahmenGesamtCents",
      "einnahmenUmsatzCents",
      "gewinnCents",
      "year",
    ],
    "Genau 7 Felder, alle dokumentiert",
  )
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
