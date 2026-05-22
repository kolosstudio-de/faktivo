/**
 * Europe/Berlin timezone helpers.
 *
 * Why: Vercel + Supabase laufen UTC. Aber DE-Buchhaltung, Jobcenter-EKS und
 * §19 UStG-Limits sind kalendrisch in **Lokalzeit** definiert. Wenn der
 * Server "Monat = Mai" sagt während Berlin schon "Juni" zeigt (oder umgekehrt),
 * landen Belege im falschen Reporting-Bucket → falsche EKS / falsche
 * Free-Tier-Quota / falsche Mahnfälligkeit.
 *
 * Konvention dieses Moduls:
 *   - Alle Funktionen liefern ISO-Date-Strings "YYYY-MM-DD" oder ISO-Timestamps
 *     mit Berlin-Wall-Clock.
 *   - Wir formatieren via `Intl.DateTimeFormat`/`formatInTimeZone` — keine
 *     UTC-arithmetic mehr, wenn das Ergebnis vom Kalender abhängt.
 */

import { formatInTimeZone, toZonedTime } from "date-fns-tz"

export const BERLIN_TZ = "Europe/Berlin" as const

/** ISO-Datum (YYYY-MM-DD) für "heute" in Berlin. */
export function berlinToday(now: Date = new Date()): string {
  return formatInTimeZone(now, BERLIN_TZ, "yyyy-MM-dd")
}

/** Erster Tag (inkl.) des Kalendermonats in Berlin als YYYY-MM-DD. */
export function berlinMonthStart(now: Date = new Date()): string {
  const ym = formatInTimeZone(now, BERLIN_TZ, "yyyy-MM")
  return `${ym}-01`
}

/**
 * Erster Tag (exkl.) des Folgemonats in Berlin als YYYY-MM-DD.
 * Praktisch als Obergrenze in SQL: `where issue_date < berlinMonthEnd(now)`.
 */
export function berlinMonthEnd(now: Date = new Date()): string {
  const year = Number(formatInTimeZone(now, BERLIN_TZ, "yyyy"))
  const month = Number(formatInTimeZone(now, BERLIN_TZ, "MM")) // 1..12
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
}

/** Erster Tag (inkl.) des Quartals in Berlin als YYYY-MM-DD. */
export function berlinQuarterStart(now: Date = new Date()): string {
  const year = Number(formatInTimeZone(now, BERLIN_TZ, "yyyy"))
  const month = Number(formatInTimeZone(now, BERLIN_TZ, "MM"))
  const qStart = month <= 3 ? 1 : month <= 6 ? 4 : month <= 9 ? 7 : 10
  return `${year}-${String(qStart).padStart(2, "0")}-01`
}

/** Erster Tag (exkl.) des Folgequartals in Berlin als YYYY-MM-DD. */
export function berlinQuarterEnd(now: Date = new Date()): string {
  const year = Number(formatInTimeZone(now, BERLIN_TZ, "yyyy"))
  const month = Number(formatInTimeZone(now, BERLIN_TZ, "MM"))
  const qEnd = month <= 3 ? 4 : month <= 6 ? 7 : month <= 9 ? 10 : 13
  if (qEnd === 13) return `${year + 1}-01-01`
  return `${year}-${String(qEnd).padStart(2, "0")}-01`
}

/** Erster Tag (inkl.) des Kalenderjahrs in Berlin als YYYY-MM-DD. */
export function berlinYearStart(now: Date = new Date()): string {
  return `${formatInTimeZone(now, BERLIN_TZ, "yyyy")}-01-01`
}

/** Erster Tag (exkl.) des Folgejahrs in Berlin als YYYY-MM-DD. */
export function berlinYearEnd(now: Date = new Date()): string {
  const year = Number(formatInTimeZone(now, BERLIN_TZ, "yyyy"))
  return `${year + 1}-01-01`
}

/**
 * Konvertiert einen UTC-`Date` in das gleiche Wanduhr-Zeit-`Date` in Berlin.
 * Nützlich für UI-Anzeige wo wir mit lokalen Stunden/Minuten rechnen wollen.
 */
export function inBerlin(date: Date = new Date()): Date {
  return toZonedTime(date, BERLIN_TZ)
}

/**
 * Vergleicht zwei ISO-Date-Strings — true, wenn `iso` "in der Vergangenheit"
 * gegenüber heute-in-Berlin ist (z.B. für überfällige Rechnungen).
 */
export function berlinIsBeforeToday(iso: string): boolean {
  return iso < berlinToday()
}
