/**
 * XRechnung 3.0 generator — CII (UN/CEFACT Cross Industry Invoice) profile.
 *
 * Conforms to:
 *  - EN 16931 core business terms (BT-*)
 *  - XRechnung CIUS 3.0 (German specific extension)
 *  - UN/ECE Recommendation 20 for unit codes
 *
 * Validate output with KoSIT Validator:
 *   https://github.com/itplr-kosit/validator
 *
 * NOTE: This is the minimal compliant CII invoice. For UBL output, a separate
 * transformer is needed. For ZUGFeRD 2.3, embed the XML into a PDF/A-3.
 */

import type { Client, Invoice, LineItem, Settings } from "@/types/database.types"

// Map our internal unit strings to UN/ECE Rec 20 codes (BT-130).
const UNIT_CODE_MAP: Record<string, string> = {
  Stk: "C62", // "one" — piece
  Std: "HUR", // hour
  h: "HUR",
  Tag: "DAY",
  Pauschale: "LS", // lump sum
  km: "KMT",
  kg: "KGM",
  l: "LTR",
  m: "MTR",
  m2: "MTK",
  m3: "MTQ",
}

function escapeXml(s: string | null | undefined): string {
  if (!s) return ""
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

function isoDate(d: string): string {
  // YYYY-MM-DD → 20260424
  return d.replace(/-/g, "")
}

/**
 * Determines the VAT category code per UNTDID 5305 / EN 16931.
 * S = Standard rate
 * Z = Zero-rated
 * E = Exempt from tax (Kleinunternehmer §19, steuerfrei)
 * AE = Reverse charge (§13b UStG)
 * K = Intra-community supply exempt
 * O = Services outside scope
 */
function vatCategory(
  invoice: Invoice,
  line: { vat_rate: number }
): { code: string; reason?: string } {
  if (invoice.is_kleinunternehmer_at_issue) {
    return {
      code: "E",
      reason:
        "Steuerbefreit nach § 19 UStG (Kleinunternehmerregelung).",
    }
  }
  if (invoice.reverse_charge) {
    return {
      code: "AE",
      reason: "Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG).",
    }
  }
  if (Number(line.vat_rate) === 0) {
    return { code: "Z", reason: "Nullsatz" }
  }
  return { code: "S" }
}

export interface XRechnungInput {
  invoice: Invoice
  lines: LineItem[]
  client: Client
  settings: Settings
  /** Buyer reference (Leitweg-ID for public clients; falls back to customer's number). */
  buyerReference?: string
}

export function generateXRechnungCII(input: XRechnungInput): string {
  const { invoice, lines, client, settings, buyerReference } = input

  const issueDateFormatted = isoDate(invoice.issue_date)
  const deliveryDateFormatted = invoice.delivery_date
    ? isoDate(invoice.delivery_date)
    : issueDateFormatted
  const dueDateFormatted = invoice.due_date
    ? isoDate(invoice.due_date)
    : issueDateFormatted

  const sellerAddr = (settings.address ?? {}) as Record<string, string>
  const buyerAddr = (client.address ?? {}) as Record<string, string>

  const sellerTaxId = settings.tax_id ?? ""
  const sellerUstId = settings.ust_id ?? ""

  const isStorno = invoice.total_cents < 0 || invoice.cancels_invoice_id
  const typeCode = isStorno ? "381" : "380" // 381 = credit note; 380 = commercial invoice

  // Aggregate VAT totals per rate
  const vatBuckets = new Map<
    string,
    { rate: number; cat: { code: string; reason?: string }; base: number; taxAmount: number }
  >()
  for (const l of lines) {
    const rate = Number(l.vat_rate)
    const cat = vatCategory(invoice, l)
    const key = `${cat.code}-${rate}`
    const existing = vatBuckets.get(key) ?? {
      rate,
      cat,
      base: 0,
      taxAmount: 0,
    }
    existing.base += l.line_subtotal_cents
    existing.taxAmount += l.line_vat_cents
    vatBuckets.set(key, existing)
  }

  const paymentRef = invoice.number ?? ""

  const lineItemsXml = lines
    .map((l, i) => {
      const lineId = String(i + 1)
      const unitCode = (l.unit_code || UNIT_CODE_MAP[l.unit] || "C62").toUpperCase()
      const cat = vatCategory(invoice, l)
      return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineId}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(l.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${centsToDecimal(l.unit_price_cents)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${Number(l.quantity).toFixed(3)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${cat.code}</ram:CategoryCode>
          <ram:RateApplicablePercent>${Number(l.vat_rate).toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${centsToDecimal(l.line_subtotal_cents)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join("")

  const vatBreakdownXml = [...vatBuckets.values()]
    .map((b) => {
      const reasonXml = b.cat.reason
        ? `<ram:ExemptionReason>${escapeXml(b.cat.reason)}</ram:ExemptionReason>`
        : ""
      return `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${centsToDecimal(b.taxAmount)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      ${reasonXml}
      <ram:BasisAmount>${centsToDecimal(b.base)}</ram:BasisAmount>
      <ram:CategoryCode>${b.cat.code}</ram:CategoryCode>
      <ram:RateApplicablePercent>${b.rate.toFixed(2)}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`
    })
    .join("")

  const sellerTaxRegXml = [
    sellerUstId
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(sellerUstId)}</ram:ID></ram:SpecifiedTaxRegistration>`
      : "",
    sellerTaxId
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${escapeXml(sellerTaxId)}</ram:ID></ram:SpecifiedTaxRegistration>`
      : "",
  ]
    .filter(Boolean)
    .join("")

  const buyerReferenceFinal = buyerReference || invoice.number || "0"

  const paymentMeansXml = settings.iban
    ? `
    <ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:TypeCode>58</ram:TypeCode>
      <ram:Information>SEPA-Überweisung</ram:Information>
      <ram:PayeePartyCreditorFinancialAccount>
        <ram:IBANID>${escapeXml(settings.iban)}</ram:IBANID>
        ${settings.bank_name ? `<ram:AccountName>${escapeXml(settings.bank_name)}</ram:AccountName>` : ""}
      </ram:PayeePartyCreditorFinancialAccount>
      ${settings.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>${escapeXml(settings.bic)}</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}
    </ram:SpecifiedTradeSettlementPaymentMeans>`
    : ""

  const sellerName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "Aussteller"
  const buyerName =
    client.type === "company"
      ? client.company_name || "—"
      : [client.first_name, client.last_name].filter(Boolean).join(" ")

  // XRechnung 3.0 CIUS identifier
  const cius =
    "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0"

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
  xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${cius}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.number ?? "DRAFT")}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDateFormatted}</udt:DateTimeString>
    </ram:IssueDateTime>
    ${invoice.notes ? `<ram:IncludedNote><ram:Content>${escapeXml(invoice.notes)}</ram:Content></ram:IncludedNote>` : ""}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineItemsXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${escapeXml(buyerReferenceFinal)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(sellerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(sellerAddr.zip ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(sellerAddr.street ?? "")}</ram:LineOne>
          <ram:CityName>${escapeXml(sellerAddr.city ?? "")}</ram:CityName>
          <ram:CountryID>${escapeXml(sellerAddr.country ?? "DE")}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${sellerTaxRegXml}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(buyerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${escapeXml(buyerAddr.zip ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${escapeXml(buyerAddr.street ?? "")}</ram:LineOne>
          <ram:CityName>${escapeXml(buyerAddr.city ?? "")}</ram:CityName>
          <ram:CountryID>${escapeXml(buyerAddr.country ?? "DE")}</ram:CountryID>
        </ram:PostalTradeAddress>
        ${client.ust_id ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${escapeXml(client.ust_id)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${deliveryDateFormatted}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:PaymentReference>${escapeXml(paymentRef)}</ram:PaymentReference>
      <ram:InvoiceCurrencyCode>${escapeXml(invoice.currency)}</ram:InvoiceCurrencyCode>
      ${paymentMeansXml}${vatBreakdownXml}
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${escapeXml(invoice.payment_terms ?? "")}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDateFormatted}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${centsToDecimal(invoice.subtotal_cents)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${centsToDecimal(invoice.subtotal_cents)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${escapeXml(invoice.currency)}">${centsToDecimal(invoice.vat_cents)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${centsToDecimal(invoice.total_cents)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${centsToDecimal(invoice.total_cents - invoice.paid_cents)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}
