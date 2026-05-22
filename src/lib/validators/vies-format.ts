/**
 * VIES VAT-ID **format**-Helfer.
 *
 * Reine, abhängigkeitsfreie Funktionen — importierbar im Client-Bundle.
 * Live-Check gegen den VIES-Server liegt separat in `vies.ts` (server-only,
 * weil DB-Cache via service-role).
 */

/**
 * EU-USt-IdNr.-Format-Regex pro Land. Stand 2026. Quelle: VIES FAQ.
 *
 * `null` = Format ist nicht regelmäßig genug für Regex — wir verlassen uns
 * auf den VIES-Backend für ja/nein.
 */
const VAT_FORMATS: Record<string, RegExp | null> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE0\d{9}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  EL: /^EL\d{9}$/, // Griechenland verwendet "EL", nicht "GR" für USt-IdNr.
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
  XI: /^XI\d{9}(\d{3})?$/, // Nordirland (post-Brexit)
}

/** Normalisiert eine USt-IdNr.: trim, uppercase, Leerzeichen/Punkte raus. */
export function normalizeVatId(raw: string): string {
  return raw.replace(/[\s.\-/]/g, "").toUpperCase()
}

/** Prüft das Format einer USt-IdNr. ohne VIES-Roundtrip. */
export function isVatFormatValid(vatId: string): boolean {
  const normalized = normalizeVatId(vatId)
  if (normalized.length < 4) return false
  const country = normalized.slice(0, 2)
  const fmt = VAT_FORMATS[country]
  if (fmt === undefined) return false
  if (fmt === null) return true
  return fmt.test(normalized)
}
