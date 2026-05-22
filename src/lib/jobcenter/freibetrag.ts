/**
 * Freibetrag-Berechnung nach §11b SGB II + §3 ALG II-V (Stand 2025/2026).
 *
 * Quellen:
 * - §11b SGB II (Bürgergeld-Gesetz):
 *   https://www.gesetze-im-internet.de/sgb_2/__11b.html
 * - §3 ALG II-V (für Selbständige):
 *   https://www.gesetze-im-internet.de/algiiv_2008/__3.html
 *
 * Regeln (alle Beträge im Cent):
 *   1. Grundfreibetrag: pauschal 100 € (statt Werbungskosten / "Bürokratiepauschale")
 *   2. Erwerbstätigenfreibetrag (zusätzlich):
 *        a) 20 % auf Einkommen zwischen 100 € und 1.000 €
 *        b) 10 % auf Einkommen zwischen 1.000 € und 1.200 €
 *           — bei mind. einem minderjährigen Kind in der BG: bis 1.500 €
 *
 * "Einkommen" für Selbständige = Betriebseinnahmen − notwendige Betriebsausgaben
 * im Bewilligungszeitraum (zugefluss- bzw. zahlungsbasiert, §3 Abs. 1 ALG II-V).
 *
 * Die Funktionen rechnen ausschließlich in Cent (integer) — keine Floats für
 * Geldbeträge bei der Endsumme. Zwischenwerte mit % nutzen Math.round.
 */

export interface FreibetragInput {
  /** Bereinigtes Einkommen in Cent (Einnahmen − absetzbare Ausgaben). */
  einkommenCents: number
  /** Mind. ein minderjähriges Kind in der Bedarfsgemeinschaft (-> Tier 2 bis 1500 €). */
  hasMinorChildren?: boolean
}

export interface FreibetragBreakdown {
  grundfreibetragCents: number
  tier1Cents: number // 20% auf 100-1000 €
  tier2Cents: number // 10% auf 1000-1200/1500 €
  totalCents: number
}

const C = 100 // 1 € in Cent

/**
 * Berechnet den vollen Freibetrag nach §11b SGB II.
 *
 * Wenn einkommenCents <= 0  → 0 (kein Freibetrag, da kein Einkommen).
 *
 * Beispiele:
 *   einkommenCents=  9000 (90 €)         → 9000 (kompletter Grundfreibetrag, gedeckelt)
 *   einkommenCents= 50000 (500 €)        → 10000 + (500-100)*0,2*100 = 10000 + 8000 = 18000 (180 €)
 *   einkommenCents=120000 (1.200 €)      → 10000 + 18000 + (1200-1000)*0,1*100 = 30000 (300 €)
 *   einkommenCents=120000 + Kind         → wie oben (Kind erhöht nur die Tier-2-Decke)
 *   einkommenCents=150000 (1.500 €) Kind → 10000 + 18000 + 5000 = 33000 (330 €)
 *   einkommenCents=200000 (2.000 €) Kind → 33000 (Tier 2 hört bei 1500 € auf)
 */
export function calcFreibetrag(input: FreibetragInput): FreibetragBreakdown {
  const { einkommenCents, hasMinorChildren = false } = input

  if (einkommenCents <= 0) {
    return {
      grundfreibetragCents: 0,
      tier1Cents: 0,
      tier2Cents: 0,
      totalCents: 0,
    }
  }

  // 1. Grundfreibetrag: max. 100 €, aber nicht mehr als das Einkommen selbst
  const grundfreibetragCents = Math.min(einkommenCents, 100 * C)

  // 2a. Tier 1: 20 % auf Einkommen zwischen 100 € und 1.000 €
  let tier1Cents = 0
  if (einkommenCents > 100 * C) {
    const tier1Range = Math.min(einkommenCents, 1000 * C) - 100 * C
    tier1Cents = Math.round(tier1Range * 0.2)
  }

  // 2b. Tier 2: 10 % auf Einkommen zwischen 1.000 € und 1.200 € (oder 1.500 € mit Kind)
  let tier2Cents = 0
  const tier2Cap = (hasMinorChildren ? 1500 : 1200) * C
  if (einkommenCents > 1000 * C) {
    const tier2Range = Math.min(einkommenCents, tier2Cap) - 1000 * C
    if (tier2Range > 0) {
      tier2Cents = Math.round(tier2Range * 0.1)
    }
  }

  return {
    grundfreibetragCents,
    tier1Cents,
    tier2Cents,
    totalCents: grundfreibetragCents + tier1Cents + tier2Cents,
  }
}

/**
 * Anrechenbares Einkommen (auf Bürgergeld) = Einkommen − Freibetrag.
 * Wird vom Bedarf abgezogen.
 */
export function calcAnrechenbarEinkommen(input: FreibetragInput): number {
  const { einkommenCents } = input
  if (einkommenCents <= 0) return 0
  const fb = calcFreibetrag(input)
  return Math.max(0, einkommenCents - fb.totalCents)
}
