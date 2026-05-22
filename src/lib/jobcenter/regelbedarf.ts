/**
 * Regelbedarf nach SGB II — Stand 2026
 * (siehe Bekanntmachung über die Höhe der Regelbedarfe nach §20 Absatz 5 SGB II)
 *
 * 2025-Werte wurden zum 2026-01-01 unverändert fortgeführt
 * (Nullrunde laut Beschluss der Bundesregierung November 2024).
 *
 * Plus Kosten der Unterkunft (KdU) — individuell, kein gesetzlicher Pauschwert.
 * Mehrbedarfe (§21 SGB II) sind ebenfalls nicht enthalten.
 */

export type Regelbedarfsstufe = 1 | 2 | 3 | 4 | 5 | 6

export const REGELBEDARF_2026: Record<Regelbedarfsstufe, number> = {
  /** Alleinstehend / alleinerziehend */
  1: 56300,
  /** Paar (je) */
  2: 50600,
  /** Erwachsene in Einrichtungen / unter 25 im Haushalt der Eltern */
  3: 45100,
  /** Jugendliche 14–17 */
  4: 47100,
  /** Kinder 6–13 */
  5: 39000,
  /** Kinder 0–5 */
  6: 35700,
} as const

export const REGELBEDARF_LABELS: Record<Regelbedarfsstufe, string> = {
  1: "Alleinstehend",
  2: "Paarpartner",
  3: "Erwachsene Sonstige (u.a. unter 25 bei Eltern)",
  4: "Jugendliche 14–17",
  5: "Kinder 6–13",
  6: "Kinder 0–5",
}
