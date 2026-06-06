#!/usr/bin/env node
/**
 * Standalone unit-tests für src/lib/erechnung/xrechnung.ts.
 *
 * XRechnung 3.0 CII ist seit 2025-01-01 für B2B-Rechnungen ≥ 250 € verpflichtend
 * in Deutschland (Wachstumschancengesetz). Wenn unsere XML-Ausgabe die Spec
 * verletzt, lehnt das BMI-Validator-Tool die Rechnung ab und der Empfänger
 * kann sie nicht in seine Buchhaltung importieren.
 *
 * Lauf: `tsx scripts/test-xrechnung.mjs` (oder `npm run test:xrechnung`).
 *
 * Verifiziert:
 *  - XML-Struktur (CII root, Namespaces, CIUS identifier)
 *  - Document-Type-Code (380 = Invoice, 381 = Credit Note)
 *  - Date-Format "102" (YYYYMMDD)
 *  - VAT-Category-Codes (S/Z/E/AE) per UNTDID 5305
 *  - VAT-Exemption-Reason für E und AE
 *  - Mehrsatz-Splitting (19% + 7% → 2 ApplicableTradeTax)
 *  - Tax-Registration (VA = USt-IdNr, FC = Steuernummer)
 *  - Unit-Code-Mapping (Stk→C62, Std→HUR, …)
 *  - Payment-Means TypeCode 58 (SEPA) + IBAN + BIC
 *  - XML-Escaping (& < > " ')
 *  - Monetary-Summation alle 5 Felder
 *
 * Bewusst keine vollständige XSD-Validation — die würde libxml + Online-XSDs
 * brauchen. Wenn etwas tiefere Validation will, KoSIT-Validator manuell
 * gegen das Output laufen lassen.
 */

await import("tsx/esm").catch(() => {})

let generateXRechnungCII
try {
  ;({ generateXRechnungCII } = await import(
    "../src/lib/erechnung/xrechnung.ts"
  ))
} catch (e) {
  console.error("Konnte src/lib/erechnung/xrechnung nicht laden:", e.message)
  process.exit(2)
}

// ─── Mini-Test-Framework (identisch zu test-datev.mjs für Konsistenz) ──────
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
function invoice(overrides = {}) {
  return {
    id: "inv-1",
    number: "RE-2026-001",
    issue_date: "2026-04-15",
    delivery_date: "2026-04-10",
    due_date: "2026-04-29",
    is_kleinunternehmer_at_issue: false,
    reverse_charge: false,
    subtotal_cents: 10000,
    vat_cents: 1900,
    total_cents: 11900,
    paid_cents: 0,
    currency: "EUR",
    payment_terms: "Zahlung innerhalb 14 Tagen ohne Abzug.",
    notes: null,
    cancels_invoice_id: null,
    ...overrides,
  }
}

function lineItem(overrides = {}) {
  return {
    description: "Webdesign-Stunde",
    quantity: 10,
    unit: "Std",
    unit_code: "",
    unit_price_cents: 10000,
    vat_rate: 19,
    line_subtotal_cents: 10000,
    line_vat_cents: 1900,
    line_total_cents: 11900,
    discount_pct: 0,
    ...overrides,
  }
}

function client(overrides = {}) {
  return {
    type: "company",
    company_name: "Acme GmbH",
    first_name: null,
    last_name: null,
    address: {
      street: "Marienplatz 1",
      zip: "80331",
      city: "München",
      country: "DE",
    },
    ust_id: "DE123456789",
    ...overrides,
  }
}

function settings(overrides = {}) {
  return {
    company_name: "Kolos Digital",
    first_name: "Vasyl",
    last_name: "Kolos",
    address: {
      street: "Hauptstr. 42",
      zip: "10115",
      city: "Berlin",
      country: "DE",
    },
    tax_id: "12/345/67890",
    ust_id: "DE987654321",
    iban: "DE89 3704 0044 0532 0130 00",
    bic: "COBADEFFXXX",
    bank_name: "Commerzbank",
    ...overrides,
  }
}

// ─── 1. XML-Struktur — wohlgeformter Root + Namespaces ─────────────────────
section("XML-Root — CrossIndustryInvoice + 4 Namespaces")
{
  const xml = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    "XML-Declaration mit UTF-8",
  )
  truthy(
    xml.includes("<rsm:CrossIndustryInvoice"),
    "Root-Element rsm:CrossIndustryInvoice",
  )
  truthy(
    xml.includes(
      'xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"',
    ),
    "rsm namespace = CrossIndustryInvoice:100",
  )
  truthy(
    xml.includes(
      'xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"',
    ),
    "ram namespace = ReusableAggregate…:100",
  )
  truthy(
    xml.includes(
      'xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"',
    ),
    "udt namespace = UnqualifiedDataType:100",
  )
  truthy(
    xml.includes(
      'xmlns:xs="http://www.w3.org/2001/XMLSchema"',
    ),
    "xs namespace = XMLSchema",
  )
  truthy(
    xml.endsWith("</rsm:CrossIndustryInvoice>"),
    "Korrekt geschlossen am Ende",
  )
}

// ─── 2. CIUS Identifier — XRechnung 3.0 + EN 16931 ─────────────────────────
section("CIUS — GuidelineSpecifiedDocumentContextParameter")
{
  const xml = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("urn:cen.eu:en16931:2017"),
    "EN 16931 URN präsent",
  )
  truthy(
    xml.includes("urn:xoev-de:kosit:standard:xrechnung_3.0"),
    "XRechnung 3.0 CIUS URN präsent",
  )
  truthy(
    xml.includes("#compliant#"),
    "compliant-Tag zwischen EN 16931 und XRechnung-CIUS",
  )
}

// ─── 3. Document-Type-Code — 380 vs 381 ────────────────────────────────────
section("TypeCode — 380 = Rechnung, 381 = Stornorechnung")
{
  const xmlInvoice = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(xmlInvoice.includes("<ram:TypeCode>380</ram:TypeCode>"), "TypeCode 380 für normale Rechnung")

  const xmlStorno = generateXRechnungCII({
    invoice: invoice({ total_cents: -11900 }),
    lines: [lineItem({ line_subtotal_cents: -10000, line_vat_cents: -1900, line_total_cents: -11900 })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xmlStorno.includes("<ram:TypeCode>381</ram:TypeCode>"),
    "TypeCode 381 für Storno (negative total)",
  )

  const xmlCancels = generateXRechnungCII({
    invoice: invoice({ cancels_invoice_id: "orig-uuid" }),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xmlCancels.includes("<ram:TypeCode>381</ram:TypeCode>"),
    "TypeCode 381 wenn cancels_invoice_id gesetzt",
  )
}

// ─── 4. Date-Format YYYYMMDD format="102" ──────────────────────────────────
section("Date-Format — YYYYMMDD mit format=\"102\"")
{
  const xml = generateXRechnungCII({
    invoice: invoice({
      issue_date: "2026-04-15",
      delivery_date: "2026-04-10",
      due_date: "2026-04-29",
    }),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes('<udt:DateTimeString format="102">20260415</udt:DateTimeString>'),
    "Issue-Date = 20260415 (102-formatted)",
  )
  truthy(
    xml.includes('<udt:DateTimeString format="102">20260410</udt:DateTimeString>'),
    "Delivery-Date = 20260410",
  )
  truthy(
    xml.includes('<udt:DateTimeString format="102">20260429</udt:DateTimeString>'),
    "Due-Date = 20260429",
  )
}

// ─── 5. VAT-Category — Standard (S) ────────────────────────────────────────
section("VAT-Category S — Standardsatz 19%")
{
  const xml = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem({ vat_rate: 19 })],
    client: client(),
    settings: settings(),
  })
  // Es muss MINDESTENS ein CategoryCode S geben (in Line-Tax)
  truthy(
    xml.includes("<ram:CategoryCode>S</ram:CategoryCode>"),
    "CategoryCode S für Standardsatz",
  )
  truthy(
    xml.includes("<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>"),
    "RateApplicablePercent 19.00 (2-decimal)",
  )
  // Keine ExemptionReason bei S
  truthy(
    !xml.includes("Steuerbefreit") && !xml.includes("Steuerschuldnerschaft"),
    "Keine Exemption-Reason bei Standardsatz",
  )
}

// ─── 6. VAT-Category — Kleinunternehmer (E) ────────────────────────────────
section("VAT-Category E — Kleinunternehmer §19")
{
  const xml = generateXRechnungCII({
    invoice: invoice({
      is_kleinunternehmer_at_issue: true,
      vat_cents: 0,
      total_cents: 10000,
    }),
    lines: [lineItem({ vat_rate: 0, line_vat_cents: 0, line_total_cents: 10000 })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:CategoryCode>E</ram:CategoryCode>"),
    "CategoryCode E für Kleinunternehmer",
  )
  truthy(
    xml.includes("§ 19 UStG"),
    "ExemptionReason erwähnt § 19 UStG",
  )
  truthy(
    xml.includes("Kleinunternehmerregelung"),
    "ExemptionReason erwähnt Kleinunternehmerregelung",
  )
}

// ─── 7. VAT-Category — Reverse-Charge (AE) ─────────────────────────────────
section("VAT-Category AE — Reverse-Charge §13b")
{
  const xml = generateXRechnungCII({
    invoice: invoice({
      reverse_charge: true,
      vat_cents: 0,
      total_cents: 10000,
    }),
    lines: [lineItem({ vat_rate: 0, line_vat_cents: 0, line_total_cents: 10000 })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:CategoryCode>AE</ram:CategoryCode>"),
    "CategoryCode AE für Reverse-Charge",
  )
  truthy(
    xml.includes("§ 13b UStG"),
    "ExemptionReason erwähnt § 13b UStG",
  )
  truthy(
    xml.includes("Steuerschuldnerschaft"),
    "ExemptionReason erwähnt Steuerschuldnerschaft",
  )
}

// ─── 8. VAT-Category — Zero-rated (Z) ──────────────────────────────────────
section("VAT-Category Z — Nullsatz (kein KU, kein Reverse)")
{
  const xml = generateXRechnungCII({
    invoice: invoice({ vat_cents: 0, total_cents: 10000 }),
    lines: [lineItem({ vat_rate: 0, line_vat_cents: 0, line_total_cents: 10000 })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:CategoryCode>Z</ram:CategoryCode>"),
    "CategoryCode Z für Nullsatz",
  )
}

// ─── 9. Mehrsatz-Splitting — 2 ApplicableTradeTax in VAT-Breakdown ─────────
section("Mehrsatz — 19% + 7% → 2 ApplicableTradeTax in Header-VAT-Breakdown")
{
  const xml = generateXRechnungCII({
    invoice: invoice({
      subtotal_cents: 20000,
      vat_cents: 2600,
      total_cents: 22600,
    }),
    lines: [
      lineItem({
        vat_rate: 19,
        line_subtotal_cents: 10000,
        line_vat_cents: 1900,
      }),
      lineItem({
        vat_rate: 7,
        line_subtotal_cents: 10000,
        line_vat_cents: 700,
      }),
    ],
    client: client(),
    settings: settings(),
  })
  // Im Header-Bereich (nach </ram:IncludedSupplyChainTradeLineItem>) müssen
  // 2 ApplicableTradeTax-Blöcke stehen — einer mit 19%, einer mit 7%.
  const headerVatSection = xml.split("</ram:SpecifiedTradeSettlementPaymentMeans>")[1]?.split("<ram:SpecifiedTradePaymentTerms>")[0]
  const otherSection = xml.split("<ram:ApplicableHeaderTradeSettlement>")[1]?.split("<ram:SpecifiedTradePaymentTerms>")[0]
  const search = headerVatSection ?? otherSection ?? ""

  const rate19count = (search.match(/<ram:RateApplicablePercent>19\.00</g) ?? [])
    .length
  const rate7count = (search.match(/<ram:RateApplicablePercent>7\.00</g) ?? [])
    .length
  truthy(rate19count >= 1, "19%-Rate erscheint im Header-VAT-Breakdown")
  truthy(rate7count >= 1, "7%-Rate erscheint im Header-VAT-Breakdown")

  // Basis-Beträge — beide Buckets enthalten 100,00
  truthy(
    search.includes("<ram:BasisAmount>100.00</ram:BasisAmount>"),
    "BasisAmount 100.00 für 19%-Bucket",
  )

  // Tax-Beträge
  truthy(
    search.includes("<ram:CalculatedAmount>19.00</ram:CalculatedAmount>"),
    "CalculatedAmount 19.00 für 19%-Bucket",
  )
  truthy(
    search.includes("<ram:CalculatedAmount>7.00</ram:CalculatedAmount>"),
    "CalculatedAmount 7.00 für 7%-Bucket",
  )
}

// ─── 10. Seller-Tax-Registration — VA + FC ─────────────────────────────────
section("Seller — Tax-Registration VA (USt-IdNr) + FC (Steuernummer)")
{
  const xml = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings({ ust_id: "DE987654321", tax_id: "12/345/67890" }),
  })
  truthy(
    xml.includes('<ram:ID schemeID="VA">DE987654321</ram:ID>'),
    "VA-Scheme mit USt-IdNr",
  )
  truthy(
    xml.includes('<ram:ID schemeID="FC">12/345/67890</ram:ID>'),
    "FC-Scheme mit Steuernummer",
  )
}

// ─── 11. Buyer USt-IdNr erscheint nur wenn vorhanden ──────────────────────
section("Buyer — USt-IdNr nur wenn vorhanden")
{
  const xmlWith = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client({ ust_id: "DE123456789" }),
    settings: settings(),
  })
  truthy(
    xmlWith.includes('<ram:ID schemeID="VA">DE123456789</ram:ID>'),
    "Buyer-USt-IdNr erscheint im VA-Scheme",
  )

  const xmlWithout = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client({ ust_id: null }),
    settings: settings(),
  })
  // Buyer-Block existiert, aber kein VA-Scheme im Buyer-Tax-Reg
  const buyerSection = xmlWithout.split("<ram:BuyerTradeParty>")[1]?.split("</ram:BuyerTradeParty>")[0] ?? ""
  truthy(
    !buyerSection.includes("VA"),
    "Kein VA-Scheme im Buyer-Block wenn ust_id fehlt",
  )
}

// ─── 12. Unit-Code-Mapping — Stk→C62, Std→HUR ─────────────────────────────
section("Unit-Code — Stk→C62, Std→HUR")
{
  const xmlStk = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem({ unit: "Stk", unit_code: "" })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xmlStk.includes('unitCode="C62"'),
    "Stk → unitCode C62 (UN/ECE Rec 20: piece)",
  )

  const xmlStd = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem({ unit: "Std", unit_code: "" })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xmlStd.includes('unitCode="HUR"'),
    "Std → unitCode HUR (hour)",
  )

  // Override per unit_code-Feld
  const xmlOverride = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem({ unit: "Stk", unit_code: "kgm" })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xmlOverride.includes('unitCode="KGM"'),
    "unit_code-Override (toUpperCase) gewinnt vor unit-Mapping",
  )
}

// ─── 13. Payment-Means — SEPA-Überweisung Typ 58 ───────────────────────────
section("Payment-Means — TypeCode 58 (SEPA) + IBAN + BIC")
{
  const xml = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings({
      iban: "DE89370400440532013000",
      bic: "COBADEFFXXX",
      bank_name: "Commerzbank",
    }),
  })
  truthy(
    xml.includes("<ram:TypeCode>58</ram:TypeCode>"),
    "PaymentMeans-TypeCode 58 (SEPA-Überweisung)",
  )
  truthy(
    xml.includes("<ram:IBANID>DE89370400440532013000</ram:IBANID>"),
    "IBANID enthält IBAN",
  )
  truthy(
    xml.includes("<ram:BICID>COBADEFFXXX</ram:BICID>"),
    "BICID enthält BIC",
  )
  truthy(
    xml.includes("<ram:AccountName>Commerzbank</ram:AccountName>"),
    "AccountName enthält bank_name",
  )

  // Ohne IBAN — kein Payment-Means
  const xmlNoIban = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings({ iban: null, bic: null }),
  })
  truthy(
    !xmlNoIban.includes("<ram:TypeCode>58</ram:TypeCode>"),
    "Ohne IBAN — kein Payment-Means-Block",
  )
}

// ─── 14. XML-Escaping — & < > " ' ─────────────────────────────────────────
section("XML-Escaping — alle 5 Spezial-Chars werden escaped")
{
  const xml = generateXRechnungCII({
    invoice: invoice({ notes: 'Achtung: A&B <Test> "Quoted" \'Single\'' }),
    lines: [
      lineItem({
        description:
          "Webdesign & SEO <Service> für \"Marke\" 'Sub'",
      }),
    ],
    client: client({ company_name: "M&M Co <Berlin>" }),
    settings: settings(),
  })
  truthy(xml.includes("A&amp;B"), "& → &amp;")
  truthy(xml.includes("&lt;Test&gt;"), "< → &lt; und > → &gt;")
  truthy(xml.includes("&quot;Quoted&quot;"), '" → &quot;')
  truthy(xml.includes("&apos;Single&apos;"), "' → &apos;")
  // Niemals raw <Test> oder "Marke" in description-Text
  truthy(
    !xml.includes("<Service>"),
    "Roh-<Service> nicht im Output",
  )
}

// ─── 15. Monetary-Summation — alle 5 Pflicht-Felder ────────────────────────
section("Monetary-Summation — Line/TaxBasis/Tax/Grand/Due alle 5 Felder")
{
  const xml = generateXRechnungCII({
    invoice: invoice({
      subtotal_cents: 10000,
      vat_cents: 1900,
      total_cents: 11900,
      paid_cents: 5000,
    }),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:LineTotalAmount>100.00</ram:LineTotalAmount>"),
    "LineTotalAmount = subtotal (100.00)",
  )
  truthy(
    xml.includes("<ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount>"),
    "TaxBasisTotalAmount = subtotal (100.00)",
  )
  truthy(
    xml.includes('<ram:TaxTotalAmount currencyID="EUR">19.00</ram:TaxTotalAmount>'),
    "TaxTotalAmount = vat (19.00) mit currencyID",
  )
  truthy(
    xml.includes("<ram:GrandTotalAmount>119.00</ram:GrandTotalAmount>"),
    "GrandTotalAmount = total (119.00)",
  )
  truthy(
    xml.includes("<ram:DuePayableAmount>69.00</ram:DuePayableAmount>"),
    "DuePayableAmount = total - paid (119 - 50 = 69.00)",
  )
}

// ─── 16. Buyer-Reference — Fallback auf invoice.number ─────────────────────
section("BuyerReference — Fallback wenn nicht explizit gesetzt")
{
  const xmlFallback = generateXRechnungCII({
    invoice: invoice({ number: "RE-2026-042" }),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xmlFallback.includes("<ram:BuyerReference>RE-2026-042</ram:BuyerReference>"),
    "BuyerReference fällt auf invoice.number zurück",
  )

  const xmlExplicit = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
    buyerReference: "991-04444-69",
  })
  truthy(
    xmlExplicit.includes(
      "<ram:BuyerReference>991-04444-69</ram:BuyerReference>",
    ),
    "BuyerReference übersteuert vom Aufrufer (Leitweg-ID-Fall)",
  )
}

// ─── 17. cents → decimal mit 2 Nachkommastellen ────────────────────────────
section("centsToDecimal — immer 2 Nachkommastellen")
{
  const xml = generateXRechnungCII({
    invoice: invoice({
      subtotal_cents: 10050,
      vat_cents: 1910,
      total_cents: 11960,
    }),
    lines: [
      lineItem({
        unit_price_cents: 10050,
        line_subtotal_cents: 10050,
        line_vat_cents: 1910,
        line_total_cents: 11960,
      }),
    ],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:ChargeAmount>100.50</ram:ChargeAmount>"),
    "100,50 € als 100.50 ausgegeben (2 decimals)",
  )
  truthy(
    xml.includes("<ram:GrandTotalAmount>119.60</ram:GrandTotalAmount>"),
    "119,60 € als 119.60",
  )
}

// ─── 18. Quantity-Format — 3 Nachkommastellen ──────────────────────────────
section("Quantity — 3 Nachkommastellen (BilledQuantity)")
{
  const xml = generateXRechnungCII({
    invoice: invoice(),
    lines: [lineItem({ quantity: 2.5 })],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes('unitCode="HUR">2.500</ram:BilledQuantity>'),
    "2.5 → 2.500 (3 decimals)",
  )
}

// ─── 19. Currency-Code im Header ───────────────────────────────────────────
section("InvoiceCurrencyCode — EUR im Header")
{
  const xml = generateXRechnungCII({
    invoice: invoice({ currency: "EUR" }),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>"),
    "InvoiceCurrencyCode = EUR",
  )
}

// ─── 20. Payment-Reference = invoice.number ────────────────────────────────
section("PaymentReference — invoice.number als Verwendungszweck")
{
  const xml = generateXRechnungCII({
    invoice: invoice({ number: "RE-2026-007" }),
    lines: [lineItem()],
    client: client(),
    settings: settings(),
  })
  truthy(
    xml.includes("<ram:PaymentReference>RE-2026-007</ram:PaymentReference>"),
    "PaymentReference enthält Rechnungsnummer",
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
