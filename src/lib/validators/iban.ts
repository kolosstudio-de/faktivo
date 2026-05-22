/**
 * IBAN + BIC Validators.
 *
 * IBAN (ISO 13616): mod-97-Prüfsumme — fängt 99 % der Tippfehler ab, bevor wir
 * SEPA-QR-Codes / Pay-by-Bank-Links daraus bauen (die im PDF eingebrannt
 * werden — kein nachträgliches Fixen).
 *
 * BIC (ISO 9362): Längen + Charset-Validierung. Echte BIC-Verifikation würde
 * gegen das SWIFT-Directory laufen, das ist kostenpflichtig; Format-Check ist
 * der akzeptierte Best-Effort.
 */

const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
  NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24,
  SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24,
  TR: 26, UA: 29, VG: 24, XK: 20,
}

/** Trim, uppercase, alle Leerzeichen/Bindestriche weg. */
export function normalizeIban(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase()
}

/**
 * Prüft eine IBAN per ISO 13616 (mod-97 = 1).
 *
 * Schritte:
 *   1. Normalisieren
 *   2. Länge gegen Länderkarte
 *   3. Die ersten 4 Zeichen ans Ende verschieben
 *   4. Buchstaben → Zahlen (A=10, B=11, …, Z=35)
 *   5. Großzahl mod 97 → muss 1 sein
 */
export function isIbanValid(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (iban.length < 5) return false
  const country = iban.slice(0, 2)
  const expectedLen = IBAN_LENGTHS[country]
  if (!expectedLen) return false
  if (iban.length !== expectedLen) return false
  if (!/^[A-Z0-9]+$/.test(iban)) return false

  // Re-arrange: Country+Check → ans Ende
  const rearranged = iban.slice(4) + iban.slice(0, 4)

  // Letters → Numbers
  let numeric = ""
  for (const ch of rearranged) {
    if (ch >= "0" && ch <= "9") {
      numeric += ch
    } else if (ch >= "A" && ch <= "Z") {
      numeric += String(ch.charCodeAt(0) - 55)
    } else {
      return false
    }
  }

  // Big-int mod 97 chunkweise (JS Number reicht nicht für 30+ Stellen)
  let remainder = 0
  for (let i = 0; i < numeric.length; i += 7) {
    const block = String(remainder) + numeric.slice(i, i + 7)
    remainder = Number(block) % 97
  }
  return remainder === 1
}

/**
 * Pretty-print: "DE89 3704 0044 0532 0130 00".
 * Wird im Settings-Form und in PDFs benutzt.
 */
export function formatIban(raw: string): string {
  const normalized = normalizeIban(raw)
  return normalized.replace(/(.{4})/g, "$1 ").trim()
}

/**
 * BIC-Format-Check (ISO 9362):
 *   - 8 oder 11 Zeichen
 *   - 4× Letter (Bank Code), 2× Letter (Country), 2× Alphanum (Location)
 *   - optional 3× Alphanum (Branch)
 */
const BIC_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/

export function isBicValid(raw: string): boolean {
  const bic = raw.trim().toUpperCase().replace(/\s/g, "")
  if (bic.length !== 8 && bic.length !== 11) return false
  return BIC_REGEX.test(bic)
}
