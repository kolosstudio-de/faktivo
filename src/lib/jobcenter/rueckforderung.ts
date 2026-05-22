/**
 * Rückforderung / Nachzahlung nach Bewilligungszeitraum (BWZ).
 *
 * Mechanik (§§ 41a, 41 SGB II):
 *   1. Jobcenter bewilligt vorläufig anhand prognostizierter Einkünfte (EKS-Vorab).
 *   2. Während des BWZ wird monatlich vorläufig ausgezahlt:
 *        zahlung_vorläufig_m = max(0, bedarf − anrechenbar(prognose_m))
 *   3. Am Ende des BWZ liefert die Person Ist-Zahlen → endgültige Festsetzung:
 *        zahlung_endgültig_m = max(0, bedarf − anrechenbar(ist_m))
 *   4. Differenz pro Monat:
 *        diff_m = zahlung_vorläufig_m − zahlung_endgültig_m
 *      Summe über BWZ:
 *        > 0 → Rückforderung an Bürger:in (zu viel gezahlt)
 *        < 0 → Nachzahlung an Bürger:in
 *
 * Hinweis: Die Mittelwertbildung („Durchschnittseinkommen") nach §3 Abs. 4 ALG II-V
 *   wird hier NICHT pauschal angewendet. Der Bürger erhält monatliche Zahlen,
 *   Ist-Zahlen werden monatlich gegen die Prognose verglichen. Wer den Mittelwert
 *   möchte, kann die Funktion `calcDurchschnittsEinkommen` nutzen und das
 *   gleichmäßige Einkommen pro Monat als Ist eingeben.
 */

import { calcAnrechenbarEinkommen } from "./freibetrag"

export interface MonthlyEinkommen {
  /** ISO Datum: erstes des Monats, z.B. "2026-04-01" */
  month: string
  /** Einkommen in Cent (Einnahmen − absetzbare Ausgaben) */
  einkommenCents: number
}

export interface RueckforderungInput {
  /** Bedarf der Bedarfsgemeinschaft pro Monat in Cent (Regelbedarf + KdU + Mehrbedarfe). */
  bedarfMonatlichCents: number
  /** Prognose: Einkommen pro Monat (vorläufige EKS). */
  prognose: MonthlyEinkommen[]
  /** Ist-Zahlen: tatsächliches Einkommen pro Monat (endgültige EKS). */
  ist: MonthlyEinkommen[]
  /** Mind. ein minderjähriges Kind in der BG. */
  hasMinorChildren?: boolean
}

export interface RueckforderungMonth {
  month: string
  prognoseEinkommenCents: number
  istEinkommenCents: number
  anrechenbarPrognoseCents: number
  anrechenbarIstCents: number
  zahlungVorlaeufigCents: number
  zahlungEndgueltigCents: number
  /** vorläufig − endgültig: positiv = zu viel gezahlt → Rückforderung */
  diffCents: number
}

export interface RueckforderungResult {
  rows: RueckforderungMonth[]
  /** Summe Differenzen. > 0: Rückforderung; < 0: Nachzahlung. */
  saldoCents: number
  bedarfMonatlichCents: number
  /** Summe vorläufiger Auszahlungen über BWZ. */
  totalVorlaeufigCents: number
  /** Summe endgültiger Auszahlungen über BWZ. */
  totalEndgueltigCents: number
}

function indexByMonth(arr: MonthlyEinkommen[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of arr) map.set(e.month, e.einkommenCents)
  return map
}

export function calcRueckforderung(
  input: RueckforderungInput
): RueckforderungResult {
  const {
    bedarfMonatlichCents,
    prognose,
    ist,
    hasMinorChildren = false,
  } = input

  const months = new Set<string>([
    ...prognose.map((p) => p.month),
    ...ist.map((i) => i.month),
  ])
  const sortedMonths = [...months].sort()

  const prognoseMap = indexByMonth(prognose)
  const istMap = indexByMonth(ist)

  const rows: RueckforderungMonth[] = []
  let totalVorlaeufig = 0
  let totalEndgueltig = 0

  for (const month of sortedMonths) {
    const prognoseEinkommenCents = prognoseMap.get(month) ?? 0
    const istEinkommenCents = istMap.get(month) ?? 0

    const anrechenbarPrognoseCents = calcAnrechenbarEinkommen({
      einkommenCents: prognoseEinkommenCents,
      hasMinorChildren,
    })
    const anrechenbarIstCents = calcAnrechenbarEinkommen({
      einkommenCents: istEinkommenCents,
      hasMinorChildren,
    })

    const zahlungVorlaeufigCents = Math.max(
      0,
      bedarfMonatlichCents - anrechenbarPrognoseCents
    )
    const zahlungEndgueltigCents = Math.max(
      0,
      bedarfMonatlichCents - anrechenbarIstCents
    )

    rows.push({
      month,
      prognoseEinkommenCents,
      istEinkommenCents,
      anrechenbarPrognoseCents,
      anrechenbarIstCents,
      zahlungVorlaeufigCents,
      zahlungEndgueltigCents,
      diffCents: zahlungVorlaeufigCents - zahlungEndgueltigCents,
    })

    totalVorlaeufig += zahlungVorlaeufigCents
    totalEndgueltig += zahlungEndgueltigCents
  }

  return {
    rows,
    saldoCents: totalVorlaeufig - totalEndgueltig,
    bedarfMonatlichCents,
    totalVorlaeufigCents: totalVorlaeufig,
    totalEndgueltigCents: totalEndgueltig,
  }
}

/**
 * Berechnet das Durchschnittseinkommen (§3 Abs. 4 ALG II-V): Summe aller
 * Einkünfte / Anzahl Monate im BWZ. Hilfreich für die offizielle „Glättung".
 */
export function calcDurchschnittsEinkommen(
  einkommen: MonthlyEinkommen[]
): number {
  if (einkommen.length === 0) return 0
  const sum = einkommen.reduce((s, e) => s + e.einkommenCents, 0)
  return Math.round(sum / einkommen.length)
}
