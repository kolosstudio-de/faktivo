#!/usr/bin/env node
/**
 * Standalone unit-tests für `isIntraAccountTransfer` aus
 * src/lib/banking/transfer-detector.ts.
 *
 * Hintergrund (echter Bug, Mai 2026):
 *   Coinbase-PDF-Import → AI klassifizierte JEDEN Schritt
 *   (Convert USDC→EURC → Sell EURC for EUR → Withdrawal to bank) als
 *   eigenständige "Einnahme". Ein einzelner Crypto-Inflow von 209 € wurde
 *   als 4× 209 € = 836 € Einkommen verbucht. Direct EKS-Fälschung +
 *   Bürgergeld-Rückforderung-Risiko.
 *
 *   Fix: 6 Regex-Patterns ON TOP des AI-Outputs, die intra-account
 *   moves ALS solche erkennen und in `bank_transactions.is_transfer=true`
 *   ablegen. Diese rows zählen dann NICHT zu EKS-Einnahmen.
 *
 * Diese Tests verifizieren, dass die Patterns
 *   - bekannte Coinbase/Kraken/Binance-Strings catch'en
 *   - normale Einnahmen NICHT als Transfer markieren
 *   - case-insensitive sind
 *   - sowohl in remittance_info als auch counterparty_name greifen
 *   - auf AI-Hints (`ai_category="Krypto-Konvertierung"`) reagieren
 *
 * Lauf: `tsx scripts/test-transfer-detector.mjs`
 */

await import("tsx/esm").catch(() => {})

let isIntraAccountTransfer
try {
  ;({ isIntraAccountTransfer } = await import(
    "../src/lib/banking/transfer-detector.ts"
  ))
} catch (e) {
  console.error("Konnte transfer-detector nicht laden:", e.message)
  process.exit(2)
}

// ─── Mini-Framework ────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const fails = []

function eq(actual, expected, name) {
  const ok = actual === expected
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    fails.push({ name, actual, expected })
    console.log(`  ✗ ${name} — expected ${expected}, got ${actual}`)
  }
}

function section(name) {
  console.log(`\n━━ ${name} ━━`)
}

const tx = (overrides = {}) => ({
  remittance_info: null,
  counterparty_name: null,
  ai_category: null,
  ...overrides,
})

// ─── 1. Coinbase "Converted" ──────────────────────────────────────────────
section("Coinbase / Crypto exchange — Converted X to Y")
{
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Converted 250 USDC to 209 EURC" }),
    ),
    true,
    "USDC → EURC convert",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "CONVERTED 1.5 BTC to 50000 USDT" }),
    ),
    true,
    "BTC → USDT convert (uppercase)",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "converted 100 eth to 250000 dai" }),
    ),
    true,
    "lowercase ETH → DAI convert",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Converted 50.75 SOL to 2500 USDC" }),
    ),
    true,
    "Decimal amount accepted",
  )
}

// ─── 2. Coinbase "Sold" ────────────────────────────────────────────────────
section("Coinbase — Sold X for Y")
{
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Sold 209 EURC for 209 EUR" }),
    ),
    true,
    "EURC → EUR sale",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "SOLD 100 BTC for 5000000 USD" }),
    ),
    true,
    "BTC → USD sale",
  )
}

// ─── 3. Coinbase "Bought" ──────────────────────────────────────────────────
section("Coinbase — Bought X with Y")
{
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Bought 100 USDC with 100 EUR" }),
    ),
    true,
    "Bought USDC with EUR",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "bought 0.5 BTC with 25000 EUR" }),
    ),
    true,
    "lowercase 'bought'",
  )
}

// ─── 4. Generic "Exchanged" / "Exchange" ───────────────────────────────────
section("Kraken / Binance — Exchanged X for Y")
{
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Exchanged 1000 USDT for 850 EUR" }),
    ),
    true,
    "Exchanged X for Y",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Exchange 50 ETH to 125000 USDC" }),
    ),
    true,
    "Exchange (3rd person) X to Y",
  )
}

// ─── 5. "Withdrawal to <konto>" ────────────────────────────────────────────
section("Withdrawal to bank account — Exchange → User-Bank")
{
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Withdrawal to 5355****7006" }),
    ),
    true,
    "Withdrawal to masked card number",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "withdrawal to 1234567890" }),
    ),
    true,
    "Lowercase withdrawal to digit",
  )
}

// ─── 6. "Deposit from <wallet>" ────────────────────────────────────────────
section("Deposit from wallet/account — User-Bank → Exchange")
{
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Deposit from external wallet" }),
    ),
    true,
    "Deposit from external wallet",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "deposit from coinbase wallet" }),
    ),
    true,
    "Deposit from named wallet (lowercase)",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Deposit from main account" }),
    ),
    true,
    "Deposit from main account",
  )
}

// ─── 7. Patterns auch im counterparty_name ─────────────────────────────────
section("counterparty_name — gleiche Patterns greifen auch hier")
{
  eq(
    isIntraAccountTransfer(
      tx({ counterparty_name: "Converted 250 USDC to 209 EURC" }),
    ),
    true,
    "Pattern in counterparty_name matched",
  )
  eq(
    isIntraAccountTransfer(
      tx({ counterparty_name: "Withdrawal to 1234" }),
    ),
    true,
    "Withdrawal-Pattern in counterparty",
  )
}

// ─── 8. AI-Hint via ai_category ────────────────────────────────────────────
section("AI-Hint — ai_category-Trigger Phrases")
{
  eq(
    isIntraAccountTransfer(
      tx({ ai_category: "Krypto-Konvertierung" }),
    ),
    true,
    "ai_category Krypto-Konvertierung",
  )
  eq(
    isIntraAccountTransfer(tx({ ai_category: "Asset-Bewegung" })),
    true,
    "ai_category Asset-Bewegung",
  )
  eq(
    isIntraAccountTransfer(
      tx({ ai_category: "Crypto Conversion" }),
    ),
    true,
    "EN ai_category Crypto Conversion",
  )
  eq(
    isIntraAccountTransfer(tx({ ai_category: "Self-Withdrawal" })),
    true,
    "ai_category Self-Withdrawal",
  )
}

// ─── 9. False-Negative-Tests — sollen NICHT als Transfer markiert werden ──
section("Normale Einnahmen — DARF nicht als Transfer markiert werden")
{
  eq(
    isIntraAccountTransfer(
      tx({
        remittance_info: "RE-2026-001 Webdesign",
        counterparty_name: "Acme GmbH",
      }),
    ),
    false,
    "Normale Kundenrechnung → false",
  )
  eq(
    isIntraAccountTransfer(
      tx({
        remittance_info: "ALDI SUED",
        counterparty_name: "ALDI SE & CO KG",
      }),
    ),
    false,
    "Supermarkt-Ausgabe → false",
  )
  eq(
    isIntraAccountTransfer(
      tx({
        remittance_info: "Bürgergeld April 2026",
        counterparty_name: "Jobcenter Berlin Mitte",
      }),
    ),
    false,
    "Jobcenter-Zahlung → false (echte Einnahme!)",
  )
  eq(
    isIntraAccountTransfer(
      tx({
        remittance_info: "Salary March 2026",
        counterparty_name: "Acme GmbH Payroll",
      }),
    ),
    false,
    "Lohn → false",
  )
}

// ─── 10. False-Positive-Stress — gefährliche Strings die NICHT matchen ────
section("Tricky-Negatives — String enthält 'converted' aber kein Transfer")
{
  // Ein Beleg "We have converted your subscription" sollte NICHT matchen,
  // weil das Pattern verlangt: "converted <digits> <ticker> to <digits>".
  eq(
    isIntraAccountTransfer(
      tx({
        remittance_info: "We have converted your subscription to annual.",
      }),
    ),
    false,
    "Marketing-Text mit 'converted' → false",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Sold property for 200000 EUR" }),
    ),
    false,
    "'Sold property for X' (kein Ticker zwischen sold und for) → false",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "Withdrawal to John Doe" }),
    ),
    false,
    "'Withdrawal to <Name>' (statt digit) → false",
  )
}

// ─── 11. Empty / null inputs — Defensive Handling ──────────────────────────
section("Empty / null — defensiv kein Transfer")
{
  eq(
    isIntraAccountTransfer(tx()),
    false,
    "Alle Felder null → false",
  )
  eq(
    isIntraAccountTransfer(
      tx({
        remittance_info: "",
        counterparty_name: "",
        ai_category: "",
      }),
    ),
    false,
    "Alle Felder leerer String → false",
  )
  eq(
    isIntraAccountTransfer(
      tx({ remittance_info: "   ", counterparty_name: "   " }),
    ),
    false,
    "Whitespace-only → false",
  )
}

// ─── 12. Case-Insensitivity ────────────────────────────────────────────────
section("Case-Insensitivity — Alle Patterns sind /i")
{
  const variants = [
    "CONVERTED 100 BTC TO 50000 EUR",
    "converted 100 btc to 50000 eur",
    "Converted 100 BTC to 50000 EUR",
    "cOnVeRtEd 100 BtC tO 50000 eUr",
  ]
  for (const v of variants) {
    eq(
      isIntraAccountTransfer(tx({ remittance_info: v })),
      true,
      `Case-Variante: ${v.slice(0, 30)}…`,
    )
  }
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
