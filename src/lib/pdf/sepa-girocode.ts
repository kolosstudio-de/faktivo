import QRCode from "qrcode"

/**
 * EPC069 SEPA Credit Transfer (Girocode) — der DE-Standard für QR-Codes
 * auf Rechnungen. Kunde scannt mit Sparkasse-/N26-/ING-/Postbank-App,
 * alle Felder (Empfänger, IBAN, Betrag, Verwendungszweck) werden
 * automatisch ausgefüllt.
 *
 * Spec: https://www.europeanpaymentscouncil.eu/document-library/guidance-documents/quick-response-code-guidelines-enable-data-capture-initiation
 */
export interface SepaGirocodeInput {
  /** Empfängername (max. 70 Zeichen) */
  name: string
  /** IBAN ohne Leerzeichen */
  iban: string
  /** BIC (optional in SEPA-Land DE, aber für ältere Apps empfohlen) */
  bic?: string
  /** Betrag in EUR (max. 999999999.99) */
  amount: number
  /** Verwendungszweck (max. 140 Zeichen) — z. B. "RE-2026-006" */
  reference: string
}

export function buildEpcPayload(input: SepaGirocodeInput): string {
  // Felder MÜSSEN in dieser Reihenfolge stehen, getrennt durch \n.
  const lines = [
    "BCD", // Service Tag
    "002", // Version
    "1", // Character Set: 1 = UTF-8
    "SCT", // Identification: SEPA Credit Transfer
    input.bic ?? "", // BIC (in DE optional seit 2014)
    input.name.slice(0, 70),
    input.iban.replace(/\s+/g, ""),
    `EUR${input.amount.toFixed(2)}`,
    "", // Purpose code (optional)
    "", // Structured remittance (optional)
    input.reference.slice(0, 140), // Unstructured remittance
    "", // Beneficiary-to-beneficiary information (optional)
  ]
  return lines.join("\n")
}

/**
 * Erzeugt einen SEPA-Girocode als Data-URL (PNG, eingebettbar in PDF via <Image>).
 */
export async function generateGirocodeDataUrl(
  input: SepaGirocodeInput
): Promise<string> {
  const payload = buildEpcPayload(input)
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 220,
    color: { dark: "#000000", light: "#ffffff" },
  })
}

/**
 * Synchroner Stub-Build für PDFs, die ohne async rendern müssen.
 * (react-pdf <Image> akzeptiert ein Promise via `src`.)
 */
export function girocodeSrcPromise(
  input: SepaGirocodeInput
): Promise<string> {
  return generateGirocodeDataUrl(input)
}
