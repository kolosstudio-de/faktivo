/**
 * Mehrbedarfe nach §21 SGB II.
 *
 * Werden ZUSÄTZLICH zum Regelbedarf vom Jobcenter gewährt — sind also Teil des
 * Bedarfs und werden VOR der Anrechnung des Einkommens addiert.
 *
 * Sätze (Stand 2026, identisch zu 2025):
 *   §21 (1)  Werdende Mütter (ab 13. SSW)        17% von Regelbedarf Stufe 1/2
 *   §21 (3)  Alleinerziehend mit:
 *              1 Kind unter 7 oder 2 Kinder unter 16:        36% von Stufe 1
 *              sonst: 12% pro Kind unter 18 (max 60%)
 *   §21 (4)  Behinderung mit Teilhabe-Leistungen:           35% von Stufe 1
 *   §21 (5)  Kostenaufwändige Ernährung (medizinisch):       individuell €0-150
 *   §21 (7)  Dezentrale Warmwasserbereitung (Stufe 1):       2.3% von Stufe 1
 *                                                Stufe 2:    2.3%
 *                                                Stufe 3:    2.3%
 *                                                Stufe 4:    1.4%
 *                                                Stufe 5:    1.2%
 *                                                Stufe 6:    0.8%
 *
 * Quelle: §21 SGB II + Sozialhilfe-Richtsätze.
 */

import {
  REGELBEDARF_2026,
  type Regelbedarfsstufe,
} from "./regelbedarf"

export interface MehrbedarfeInput {
  /** Person ist schwanger (ab 13. SSW). */
  schwanger?: boolean
  /** Alleinerziehend mit Kindern. */
  alleinerziehend_kinder?: {
    /** Anzahl Kinder unter 18 in der BG. */
    anzahl: number
    /** Alter des jüngsten Kindes in Jahren. */
    juengstes_kind_alter: number
  }
  /** Person hat Behinderung mit Eingliederungshilfe (§§ 67-69 SGB IX). */
  behinderung?: boolean
  /** Dezentrale Warmwasserbereitung (kein zentraler Boiler). */
  dezentrale_warmwasser?: boolean
  /** Medizinisch begründete kostenaufwändige Ernährung in Cent (individuell). */
  ernaehrung_cents?: number
}

export interface MehrbedarfeBreakdown {
  schwangerCents: number
  alleinerziehendCents: number
  behinderungCents: number
  warmwasserCents: number
  ernaehrungCents: number
  totalCents: number
}

const PCT_WW: Record<Regelbedarfsstufe, number> = {
  1: 0.023,
  2: 0.023,
  3: 0.023,
  4: 0.014,
  5: 0.012,
  6: 0.008,
}

function pct(amountCents: number, p: number): number {
  return Math.round(amountCents * p)
}

/**
 * Alleinerziehenden-Mehrbedarf nach §21 (3) SGB II:
 *   - 1 Kind unter 7 oder 2 Kinder unter 16  →  36% Pauschal
 *   - sonst: 12% pro Kind, max. 60%
 *
 * Berechnung der Mehrbedarfsstufen erfolgt immer auf Basis der Regelbedarfsstufe 1.
 */
function calcAlleinerziehend(
  anzahl: number,
  juengstesAlter: number
): number {
  if (anzahl <= 0) return 0
  const stufe1 = REGELBEDARF_2026[1]
  // Pauschal 36%: 1 Kind <7 ODER 2 Kinder <16
  if (
    (anzahl === 1 && juengstesAlter < 7) ||
    (anzahl >= 2 && juengstesAlter < 16)
  ) {
    return pct(stufe1, 0.36)
  }
  // sonst: 12% pro Kind, max 60%
  const p = Math.min(anzahl * 0.12, 0.6)
  return pct(stufe1, p)
}

/**
 * Berechnet die Summe aller Mehrbedarfe in Cent.
 * Regelbedarf-Stufe der antragstellenden Person bestimmt nur die
 * Warmwasserquote — alle anderen Mehrbedarfe basieren auf Stufe 1.
 */
export function calcMehrbedarfe(
  stufe: Regelbedarfsstufe | null,
  input: MehrbedarfeInput
): MehrbedarfeBreakdown {
  const stufe1 = REGELBEDARF_2026[1]
  const personalStufe = stufe ?? 1
  const personalRegelbedarf = REGELBEDARF_2026[personalStufe]

  const schwangerCents = input.schwanger ? pct(stufe1, 0.17) : 0
  const alleinerziehendCents = input.alleinerziehend_kinder
    ? calcAlleinerziehend(
        input.alleinerziehend_kinder.anzahl,
        input.alleinerziehend_kinder.juengstes_kind_alter
      )
    : 0
  const behinderungCents = input.behinderung ? pct(stufe1, 0.35) : 0
  const warmwasserCents = input.dezentrale_warmwasser
    ? pct(personalRegelbedarf, PCT_WW[personalStufe])
    : 0
  const ernaehrungCents = Math.max(0, input.ernaehrung_cents ?? 0)

  return {
    schwangerCents,
    alleinerziehendCents,
    behinderungCents,
    warmwasserCents,
    ernaehrungCents,
    totalCents:
      schwangerCents +
      alleinerziehendCents +
      behinderungCents +
      warmwasserCents +
      ernaehrungCents,
  }
}
