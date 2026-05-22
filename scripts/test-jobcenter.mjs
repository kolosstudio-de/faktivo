#!/usr/bin/env node
/**
 * Standalone unit-tests für src/lib/jobcenter/* (Freibetrag + Rückforderung).
 * Lauf: `node scripts/test-jobcenter.mjs`
 *
 * Keine externen Test-Frameworks — bewusst minimal, damit die Berechnungen
 * unabhängig von Vitest/Jest auch im CI-cold-start jederzeit verifiziert
 * werden können.
 */

// On-the-fly TS-Loader via tsx (already a transitive dev-dep via Next).
// Falls nicht verfügbar, fallback: importer kompiliert TS vorher mit `tsc` aus.
let calcFreibetrag,
  calcAnrechenbarEinkommen,
  calcRueckforderung,
  calcMehrbedarfe
try {
  // Force a side-effect-less compile by using `tsx`-loader
  // (Next.js bringt @swc und @next/swc — wir nutzen tsx für externe Skripte)
  await import("tsx/esm")
} catch {
  // ignore — wir versuchen den Import unten direkt
}

try {
  ;({
    calcFreibetrag,
    calcAnrechenbarEinkommen,
    calcRueckforderung,
    calcMehrbedarfe,
  } = await import("../src/lib/jobcenter/index.ts"))
} catch (e) {
  console.error("Konnte src/lib/jobcenter nicht laden:", e.message)
  console.error("→ Skript benötigt 'tsx'. Versuche: npx tsx scripts/test-jobcenter.mjs")
  process.exit(2)
}

// ─── Mini test-framework ───────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures = []

function eq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    failures.push({ name, actual, expected })
    console.log(`  ✗ ${name}`)
    console.log(`    expected: ${JSON.stringify(expected)}`)
    console.log(`    actual:   ${JSON.stringify(actual)}`)
  }
}

function describe(title, fn) {
  console.log(`\n━━ ${title} ━━`)
  fn()
}

// ─── Freibetrag-Tests ──────────────────────────────────────────────────────

describe("calcFreibetrag — Grenzfälle", () => {
  eq(calcFreibetrag({ einkommenCents: 0 }).totalCents, 0, "0 € → 0 €")
  eq(calcFreibetrag({ einkommenCents: -500 }).totalCents, 0, "negativ → 0 €")

  // 50 € Einkommen → Grundfreibetrag gedeckelt auf Einkommen (50 €)
  eq(
    calcFreibetrag({ einkommenCents: 5000 }),
    {
      grundfreibetragCents: 5000,
      tier1Cents: 0,
      tier2Cents: 0,
      totalCents: 5000,
    },
    "50 € → 50 € Grundfreibetrag (gedeckelt)"
  )

  // exakt 100 € → nur Grundfreibetrag, kein Tier 1
  eq(
    calcFreibetrag({ einkommenCents: 10000 }),
    {
      grundfreibetragCents: 10000,
      tier1Cents: 0,
      tier2Cents: 0,
      totalCents: 10000,
    },
    "100 € → 100 € Grundfreibetrag"
  )
})

describe("calcFreibetrag — typische Selbständige", () => {
  // 250 € (oft bei Aufstockern): 100 + 30 = 130 €
  eq(
    calcFreibetrag({ einkommenCents: 25000 }),
    {
      grundfreibetragCents: 10000,
      tier1Cents: 3000, // (250-100) * 0.20 * 100c
      tier2Cents: 0,
      totalCents: 13000,
    },
    "250 € → 130 € Freibetrag"
  )

  // 600 € (oft bei Aufstockern): 100 + 100 = 200 €
  eq(
    calcFreibetrag({ einkommenCents: 60000 }),
    {
      grundfreibetragCents: 10000,
      tier1Cents: 10000, // (600-100) * 0.20
      tier2Cents: 0,
      totalCents: 20000,
    },
    "600 € → 200 € Freibetrag"
  )

  // exakt 1.000 €: voller Tier 1 (180), kein Tier 2
  eq(
    calcFreibetrag({ einkommenCents: 100000 }),
    {
      grundfreibetragCents: 10000,
      tier1Cents: 18000, // 900 * 0.20
      tier2Cents: 0,
      totalCents: 28000,
    },
    "1.000 € → 280 € Freibetrag"
  )

  // exakt 1.200 €: Tier 1 voll + Tier 2 voll → 100 + 180 + 20 = 300
  eq(
    calcFreibetrag({ einkommenCents: 120000 }),
    {
      grundfreibetragCents: 10000,
      tier1Cents: 18000,
      tier2Cents: 2000, // 200 * 0.10
      totalCents: 30000,
    },
    "1.200 € → 300 € Freibetrag (ohne Kind)"
  )

  // 1.500 € ohne Kind: kappt bei 1.200 → wie 1.200
  eq(calcFreibetrag({ einkommenCents: 150000 }).totalCents, 30000, "1.500 € ohne Kind = 1.200 € Cap")

  // 1.500 € MIT Kind: Tier 2 bis 1.500 → +500*0.10 = +50 → 350 €
  eq(
    calcFreibetrag({ einkommenCents: 150000, hasMinorChildren: true }),
    {
      grundfreibetragCents: 10000,
      tier1Cents: 18000,
      tier2Cents: 5000,
      totalCents: 33000,
    },
    "1.500 € MIT Kind → 330 € Freibetrag"
  )

  // 3.000 € MIT Kind: Tier 2 cap bei 1500 → max 330
  eq(
    calcFreibetrag({ einkommenCents: 300000, hasMinorChildren: true }).totalCents,
    33000,
    "3.000 € MIT Kind = Tier-2-Cap"
  )
})

describe("calcAnrechenbarEinkommen", () => {
  eq(calcAnrechenbarEinkommen({ einkommenCents: 0 }), 0, "0 € → 0 €")
  // 600 € − 200 € Freibetrag = 400 € anrechenbar
  eq(
    calcAnrechenbarEinkommen({ einkommenCents: 60000 }),
    40000,
    "600 € → 400 € anrechenbar"
  )
  // 250 € − 130 € = 120 € anrechenbar
  eq(
    calcAnrechenbarEinkommen({ einkommenCents: 25000 }),
    12000,
    "250 € → 120 € anrechenbar"
  )
})

// ─── Rückforderungs-Tests ──────────────────────────────────────────────────

describe("calcRueckforderung — User-Beispiel: 6 Monate Prognose 250 € + 600 €", () => {
  // User-Szenario:
  //   Bedarf BG: 550 € Bürgergeld monatlich  (alleinstehend, ohne KdU im Beispiel)
  //   Prognose: 250, 250, 250, 600, 600, 600
  //   Ist:      gleich Prognose → keine Rückforderung
  const bedarf = 55000
  const prognose = [
    { month: "2026-01-01", einkommenCents: 25000 },
    { month: "2026-02-01", einkommenCents: 25000 },
    { month: "2026-03-01", einkommenCents: 25000 },
    { month: "2026-04-01", einkommenCents: 60000 },
    { month: "2026-05-01", einkommenCents: 60000 },
    { month: "2026-06-01", einkommenCents: 60000 },
  ]

  const idential = calcRueckforderung({
    bedarfMonatlichCents: bedarf,
    prognose,
    ist: prognose,
  })
  eq(idential.saldoCents, 0, "Ist == Prognose → Saldo 0")

  // Was bekommt der User vorläufig im Januar?
  // Anrechenbar(250) = 120 € → Auszahlung = 550 − 120 = 430 €
  eq(
    idential.rows[0].zahlungVorlaeufigCents,
    43000,
    "Januar: Auszahlung 430 €"
  )
  // April: Anrechenbar(600) = 400 → Auszahlung = 550 − 400 = 150
  eq(idential.rows[3].zahlungVorlaeufigCents, 15000, "April: Auszahlung 150 €")

  // ─── Szenario: Ist > Prognose → Rückforderung
  const istHigher = prognose.map((p) => ({
    ...p,
    einkommenCents: p.einkommenCents + 10000, // +100 € pro Monat
  }))
  const back = calcRueckforderung({
    bedarfMonatlichCents: bedarf,
    prognose,
    ist: istHigher,
  })

  // Januar: prog=250 → anrech 120 → vorl. 430.
  // Ist=350 → FB(350): GF 100 + Tier1=(350-100)*0.20=50 = 150. Anrech = 350-150 = 200. Endg = 550-200 = 350.
  // diff Januar = 430 - 350 = 80
  eq(back.rows[0].zahlungEndgueltigCents, 35000, "Januar Endgültig 350 €")
  eq(back.rows[0].diffCents, 8000, "Januar Diff 80 €")

  // April: prog=600 → anrech 400 → vorl 150. Ist=700 → GF 100 + 180 + 0 = 280? Wait, recompute:
  // 700: GF 100, Tier1 = (700-100)*0.20 = 120, Tier2 = 0 → FB = 220. Anrech = 700-220 = 480. Endg = 550-480 = 70.
  // diff = 150 - 70 = 80
  eq(back.rows[3].zahlungEndgueltigCents, 7000, "April Endgültig 70 €")
  eq(back.rows[3].diffCents, 8000, "April Diff 80 €")

  // ─── Szenario: Ist < Prognose → Nachzahlung
  const istLower = prognose.map((p) => ({
    ...p,
    einkommenCents: Math.max(0, p.einkommenCents - 10000),
  }))
  const nach = calcRueckforderung({
    bedarfMonatlichCents: bedarf,
    prognose,
    ist: istLower,
  })
  // Saldo muss negativ sein (Nachzahlung an Bürger)
  if (nach.saldoCents >= 0) {
    failed++
    failures.push({
      name: "Ist < Prognose → Saldo < 0 (Nachzahlung)",
      actual: nach.saldoCents,
      expected: "< 0",
    })
    console.log(`  ✗ Ist < Prognose → Saldo < 0 (Nachzahlung)  (got ${nach.saldoCents})`)
  } else {
    passed++
    console.log(`  ✓ Ist < Prognose → Saldo < 0 (Nachzahlung) (Saldo=${nach.saldoCents}c)`)
  }
})

describe("calcRueckforderung — Sehr hohes Ist deckt Bedarf voll → 0 Auszahlung", () => {
  const result = calcRueckforderung({
    bedarfMonatlichCents: 55000,
    prognose: [{ month: "2026-01-01", einkommenCents: 0 }],
    ist: [{ month: "2026-01-01", einkommenCents: 1000_00 }], // 1000 €
  })
  // Anrechenbar(1000) = 1000 - 280 = 720 → Endg. = max(0, 550-720) = 0
  eq(result.rows[0].zahlungEndgueltigCents, 0, "1000 € deckt Bedarf 550 € → 0")
  // Vorläufig auf 0-Prognose: 550 € voll. Diff = 550 - 0 = 550 € Rückforderung
  eq(result.saldoCents, 55000, "Rückforderung = 550 €")
})

// ─── Mehrbedarfe-Tests (§21 SGB II) ────────────────────────────────────────

describe("calcMehrbedarfe — keine Mehrbedarfe", () => {
  eq(calcMehrbedarfe(1, {}).totalCents, 0, "leere input → 0")
})

describe("calcMehrbedarfe — Schwangerschaft (17%)", () => {
  const r = calcMehrbedarfe(1, { schwanger: true })
  eq(r.schwangerCents, Math.round(56300 * 0.17), "Schwanger → 17% von Stufe 1")
})

describe("calcMehrbedarfe — Alleinerziehend §21 (3)", () => {
  // 1 Kind unter 7 → 36% von Stufe 1
  eq(
    calcMehrbedarfe(1, {
      alleinerziehend_kinder: { anzahl: 1, juengstes_kind_alter: 5 },
    }).alleinerziehendCents,
    Math.round(56300 * 0.36),
    "1 Kind <7 → 36%"
  )
  // 1 Kind ≥7: 12% Pauschale
  eq(
    calcMehrbedarfe(1, {
      alleinerziehend_kinder: { anzahl: 1, juengstes_kind_alter: 10 },
    }).alleinerziehendCents,
    Math.round(56300 * 0.12),
    "1 Kind ≥7 → 12%"
  )
  // 2 Kinder unter 16 → 36% Pauschale
  eq(
    calcMehrbedarfe(1, {
      alleinerziehend_kinder: { anzahl: 2, juengstes_kind_alter: 10 },
    }).alleinerziehendCents,
    Math.round(56300 * 0.36),
    "2 Kinder <16 → 36%"
  )
  // 4 Kinder, jüngstes 16 → 12% × 4 = 48%
  eq(
    calcMehrbedarfe(1, {
      alleinerziehend_kinder: { anzahl: 4, juengstes_kind_alter: 16 },
    }).alleinerziehendCents,
    Math.round(56300 * 0.48),
    "4 Kinder, jüngstes 16 → 48%"
  )
  // 6 Kinder über 16: cap 60%
  eq(
    calcMehrbedarfe(1, {
      alleinerziehend_kinder: { anzahl: 6, juengstes_kind_alter: 17 },
    }).alleinerziehendCents,
    Math.round(56300 * 0.6),
    "6 Kinder >16 → cap 60%"
  )
})

describe("calcMehrbedarfe — Behinderung (35%)", () => {
  eq(
    calcMehrbedarfe(1, { behinderung: true }).behinderungCents,
    Math.round(56300 * 0.35),
    "35% von Stufe 1"
  )
})

describe("calcMehrbedarfe — Warmwasser je Stufe", () => {
  eq(
    calcMehrbedarfe(1, { dezentrale_warmwasser: true }).warmwasserCents,
    Math.round(56300 * 0.023),
    "Stufe 1: 2.3%"
  )
  eq(
    calcMehrbedarfe(6, { dezentrale_warmwasser: true }).warmwasserCents,
    Math.round(35700 * 0.008),
    "Stufe 6: 0.8%"
  )
})

describe("calcMehrbedarfe — Kombination Schwanger + Behinderung + WW + Ernährung", () => {
  const r = calcMehrbedarfe(1, {
    schwanger: true,
    behinderung: true,
    dezentrale_warmwasser: true,
    ernaehrung_cents: 6000,
  })
  const expected =
    Math.round(56300 * 0.17) +
    Math.round(56300 * 0.35) +
    Math.round(56300 * 0.023) +
    6000
  eq(r.totalCents, expected, "alles zusammen")
})

// ─── Result ────────────────────────────────────────────────────────────────

console.log(`\n━━ Resultat ━━`)
console.log(`  Pass: ${passed}`)
console.log(`  Fail: ${failed}`)

if (failed > 0) {
  console.log("\nFehlschläge:")
  failures.forEach((f) => {
    console.log(`  - ${f.name}`)
    console.log(`    expected: ${JSON.stringify(f.expected)}`)
    console.log(`    actual:   ${JSON.stringify(f.actual)}`)
  })
  process.exit(1)
}

process.exit(0)
