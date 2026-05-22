#!/usr/bin/env node
/**
 * VAT/Money unit-tests. Run: `npx tsx scripts/test-money.mjs`
 *
 * Verifiziert §14 UStG-konforme Berechnung:
 *  - 19 % auf 100,00 € → 19,00 € VAT, 119,00 € brutto
 *  - 7 % auf 100,00 € → 7,00 €
 *  - 0 % (KU) → keine VAT
 *  - Rabatt vor VAT
 *  - Multi-line subtotal/VAT
 *  - Multi-rate vatBreakdown
 *  - DE-Locale parsing (1.234,56)
 */

await import("tsx/esm").catch(() => {})

let computeLineTotals, sumDocumentTotals, vatBreakdown, parseCents, formatMoney
try {
  ;({
    computeLineTotals,
    sumDocumentTotals,
    vatBreakdown,
    parseCents,
    formatMoney,
  } = await import("../src/lib/money.ts"))
} catch (e) {
  console.error("Konnte src/lib/money nicht laden:", e.message)
  process.exit(2)
}

let pass = 0
let fail = 0
const fails = []

function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    fails.push({ name, actual, expected })
    console.log(`  ✗ ${name}`)
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
  }
}

console.log("\n━━ parseCents ━━")
eq(parseCents("100"), 10000, '"100" → 10000c')
eq(parseCents("100,00"), 10000, '"100,00" → 10000c')
eq(parseCents("100.00"), 10000, '"100.00" → 10000c')
eq(parseCents("1.234,56"), 123456, '"1.234,56" → 123456c (DE)')
eq(parseCents("1,234.56"), 123456, '"1,234.56" → 123456c (EN)')
eq(parseCents(""), 0, "empty → 0")
eq(parseCents(" 0,99 "), 99, '"0,99" → 99c')

console.log("\n━━ computeLineTotals — 19% USt ━━")
// 1× 100 € · 19 % · 0 % rabatt → net 100, vat 19, total 119
eq(
  computeLineTotals({ quantity: 1, unitPriceCents: 10000, vatRatePct: 19 }),
  { lineSubtotalCents: 10000, lineVatCents: 1900, lineTotalCents: 11900 },
  "1×100€ @19% → 119€"
)
// 2× 49,99 € · 19 % → net 9998, vat 1900 (rounded), total 11898
eq(
  computeLineTotals({ quantity: 2, unitPriceCents: 4999, vatRatePct: 19 }),
  { lineSubtotalCents: 9998, lineVatCents: 1900, lineTotalCents: 11898 },
  "2×49,99€ @19% → 118,98€"
)

console.log("\n━━ computeLineTotals — 7% USt (Lebensmittel/Bücher) ━━")
eq(
  computeLineTotals({ quantity: 1, unitPriceCents: 10000, vatRatePct: 7 }),
  { lineSubtotalCents: 10000, lineVatCents: 700, lineTotalCents: 10700 },
  "1×100€ @7% → 107€"
)
eq(
  computeLineTotals({ quantity: 3, unitPriceCents: 1499, vatRatePct: 7 }),
  // net = 4497, vat = round(4497*0.07) = round(314.79) = 315
  { lineSubtotalCents: 4497, lineVatCents: 315, lineTotalCents: 4812 },
  "3×14,99€ @7% → 48,12€"
)

console.log("\n━━ computeLineTotals — 0% (Kleinunternehmer) ━━")
eq(
  computeLineTotals({ quantity: 1, unitPriceCents: 10000, vatRatePct: 0 }),
  { lineSubtotalCents: 10000, lineVatCents: 0, lineTotalCents: 10000 },
  "1×100€ @0% → 100€"
)

console.log("\n━━ Rabatt-Test ━━")
// 1× 100 € · 19 % · 10 % rabatt → net 90, vat 17.10 → 17, total 107
eq(
  computeLineTotals({
    quantity: 1,
    unitPriceCents: 10000,
    vatRatePct: 19,
    discountPct: 10,
  }),
  { lineSubtotalCents: 9000, lineVatCents: 1710, lineTotalCents: 10710 },
  "10% Rabatt: 100€ → 90€ net, 17,10€ VAT"
)

console.log("\n━━ sumDocumentTotals ━━")
const lines = [
  computeLineTotals({ quantity: 1, unitPriceCents: 10000, vatRatePct: 19 }), // 100/19/119
  computeLineTotals({ quantity: 2, unitPriceCents: 5000, vatRatePct: 7 }), // 100/7/107
]
eq(
  sumDocumentTotals(lines),
  { subtotalCents: 20000, vatCents: 2600, totalCents: 22600 },
  "Mixed 19+7%: 200/26/226"
)

eq(
  sumDocumentTotals(lines, { isKleinunternehmer: true }),
  { subtotalCents: 20000, vatCents: 0, totalCents: 20000 },
  "KU forces VAT to 0"
)

console.log("\n━━ vatBreakdown ━━")
const breakdown = vatBreakdown([
  { vat_rate: 19, line_subtotal_cents: 10000, line_vat_cents: 1900 },
  { vat_rate: 19, line_subtotal_cents: 5000, line_vat_cents: 950 },
  { vat_rate: 7, line_subtotal_cents: 10000, line_vat_cents: 700 },
])
eq(
  breakdown,
  [
    { rate: 7, netCents: 10000, vatCents: 700 },
    { rate: 19, netCents: 15000, vatCents: 2850 },
  ],
  "groups by rate, sorted asc"
)

console.log("\n━━ formatMoney (DE) — NBSP between number and €, ASCII or U+2212 minus ━━")
const nbsp = (s) => s.replace(/\s/g, " ").replace(/−/g, "-")
eq(nbsp(formatMoney(123456)), "1.234,56 €", "1234,56 € German format")
eq(nbsp(formatMoney(0)), "0,00 €", "0 → 0,00 €")
eq(nbsp(formatMoney(-150)), "-1,50 €", "negative")

console.log(`\n━━ Resultat ━━`)
console.log(`  Pass: ${pass}`)
console.log(`  Fail: ${fail}`)

if (fail > 0) {
  console.log("\nFehlschläge:")
  fails.forEach((f) => {
    console.log(`  - ${f.name}`)
    console.log(`    expected: ${JSON.stringify(f.expected)}`)
    console.log(`    actual:   ${JSON.stringify(f.actual)}`)
  })
  process.exit(1)
}

process.exit(0)
