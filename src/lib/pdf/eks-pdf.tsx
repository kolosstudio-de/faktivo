import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "@/lib/money"
import type {
  ExpenseEntry,
  IncomeEntry,
  Invoice,
  Settings,
} from "@/types/database.types"

/**
 * Anlage EKS — Monatsübersicht für Jobcenter (Aufstocker-Nachweis).
 *
 * NOT the official SA40-PDF (that one is issued by Bundesagentur für Arbeit).
 * This is an internal computation that mirrors the EKS logic so the user can
 * attach it to their Jobcenter submission alongside the official form.
 *
 * Freibeträge §11b SGB II:
 *   €100 Grundfreibetrag (pauschal, statt Werbungskosten)
 *   + 20% auf Brutto-Einkommen zwischen €100 und €1000
 *   + 10% auf Brutto-Einkommen zwischen €1000 und €1200 (bzw. €1500 mit Kindern)
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#475569" },
  section: { marginTop: 14, marginBottom: 4 },
  sectionH: {
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: "#f1f5f9",
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderColor: "#e2e8f0",
  },
  c1: { flex: 1 },
  c2: { width: 70 },
  cAmount: { width: 90, textAlign: "right" },
  cDate: { width: 60 },
  total: { fontWeight: 700 },
  sumBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: "#ecfeff",
    borderRadius: 6,
    borderColor: "#06b6d4",
    borderWidth: 1,
    color: "#0e7490",
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  sumRowStrong: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderTopWidth: 1,
    marginTop: 4,
    fontWeight: 700,
    fontSize: 11,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: "#94a3b8",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderColor: "#e2e8f0",
    paddingTop: 6,
  },
  meta: {
    fontSize: 9,
    color: "#475569",
    marginBottom: 2,
  },
})

export interface EksPdfInput {
  settings: Settings
  periodStart: string // ISO YYYY-MM-DD
  periodEnd: string
  invoices: Invoice[]
  extraIncome: IncomeEntry[]
  expenses: (ExpenseEntry & {
    category?: { name?: string; is_jobcenter_relevant?: boolean } | null
  })[]
}

/** §11b SGB II Freibeträge from Brutto-Einkommen. */
function calcFreibetrag(bruttoCents: number): number {
  if (bruttoCents <= 0) return 0
  const brutto = bruttoCents / 100
  let freibetrag = 100 // Grundfreibetrag
  if (brutto > 100) {
    const tier1 = Math.min(brutto, 1000) - 100
    freibetrag += tier1 * 0.2
  }
  if (brutto > 1000) {
    const tier2 = Math.min(brutto, 1200) - 1000
    freibetrag += tier2 * 0.1
  }
  return Math.round(freibetrag * 100)
}

/** Iterate first-of-month ISO strings between two ISO dates (inclusive). */
function listMonths(startISO: string, endISO: string): string[] {
  if (!startISO || !endISO) return []
  const out: string[] = []
  const s = new Date(startISO + "T00:00:00Z")
  const e = new Date(endISO + "T00:00:00Z")
  const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1))
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return out
}

export function EksPdf(input: EksPdfInput) {
  const { settings, periodStart, periodEnd, invoices, extraIncome, expenses } =
    input

  const issuerName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "—"

  // Einnahmen
  const invoiceIncome = invoices.reduce((s, i) => s + i.total_cents, 0)
  const extraIncomeSum = extraIncome.reduce((s, i) => s + i.amount_cents, 0)
  const bruttoEinnahmen = invoiceIncome + extraIncomeSum

  // Betriebsausgaben (nur jobcenter-relevante)
  const relevantExpenses = expenses.filter(
    (e) =>
      e.is_deductible && (e.category?.is_jobcenter_relevant ?? true) !== false
  )
  const betriebsausgaben = relevantExpenses.reduce(
    (s, e) => s + e.amount_cents,
    0
  )

  const nettoEinkommen = Math.max(0, bruttoEinnahmen - betriebsausgaben)
  const freibetrag = calcFreibetrag(nettoEinkommen)
  const anrechenbar = Math.max(0, nettoEinkommen - freibetrag)

  // Per-month aggregation for the breakdown table (only rendered when the
  // requested period covers more than one calendar month — the typical case
  // for Anlage-EKS Bewilligungszeitraum reports).
  const months = listMonths(periodStart, periodEnd)
  const monthKey = (d: string) => d.slice(0, 7) + "-01"
  type MonthBucket = {
    month: string
    einnahmenCents: number
    ausgabenCents: number
    saldoCents: number
    freibetragCents: number
    anrechenbarCents: number
  }
  const perMonth: MonthBucket[] = months.map((m) => ({
    month: m,
    einnahmenCents: 0,
    ausgabenCents: 0,
    saldoCents: 0,
    freibetragCents: 0,
    anrechenbarCents: 0,
  }))
  const monthIdx = new Map(perMonth.map((b, i) => [b.month, i]))
  for (const inv of invoices) {
    const i = monthIdx.get(monthKey(inv.issue_date))
    if (i !== undefined) perMonth[i].einnahmenCents += inv.total_cents
  }
  for (const e of extraIncome) {
    const i = monthIdx.get(monthKey(e.occurred_on))
    if (i !== undefined) perMonth[i].einnahmenCents += e.amount_cents
  }
  for (const e of relevantExpenses) {
    const i = monthIdx.get(monthKey(e.occurred_on))
    if (i !== undefined) perMonth[i].ausgabenCents += e.amount_cents
  }
  for (const b of perMonth) {
    b.saldoCents = Math.max(0, b.einnahmenCents - b.ausgabenCents)
    b.freibetragCents = calcFreibetrag(b.saldoCents)
    b.anrechenbarCents = Math.max(0, b.saldoCents - b.freibetragCents)
  }
  const showMonthlyTable = perMonth.length > 1

  return (
    <Document title={`Anlage EKS ${periodStart}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>
              {showMonthlyTable
                ? "Anlage EKS — Zeitraum-Übersicht"
                : "Anlage EKS — Monatsübersicht"}
            </Text>
            <Text style={styles.subtitle}>
              Einkommen aus selbständiger Tätigkeit (SGB II · § 3 ALG-II-V)
            </Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={styles.meta}>{issuerName}</Text>
            {settings.jobcenter_bg_nummer ? (
              <Text style={styles.meta}>
                BG-Nr.: {settings.jobcenter_bg_nummer}
              </Text>
            ) : null}
            {settings.jobcenter_name ? (
              <Text style={styles.meta}>{settings.jobcenter_name}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionH}>
            Zeitraum: {periodStart} bis {periodEnd}
          </Text>
        </View>

        {/* Per-month breakdown (only when range > 1 month) */}
        {showMonthlyTable ? (
          <View style={styles.section}>
            <Text style={styles.sectionH}>
              Monatliche Aufschlüsselung ({perMonth.length} Monate)
            </Text>
            <View
              style={[
                styles.row,
                { backgroundColor: "#f8fafc", fontWeight: 700 },
              ]}
            >
              <Text style={[styles.cDate, { width: 70 }]}>Monat</Text>
              <Text style={[styles.cAmount, { width: 80 }]}>Einnahmen</Text>
              <Text style={[styles.cAmount, { width: 80 }]}>Ausgaben</Text>
              <Text style={[styles.cAmount, { width: 70 }]}>Saldo</Text>
              <Text style={[styles.cAmount, { width: 75 }]}>Freibetrag</Text>
              <Text style={[styles.cAmount, { width: 80 }]}>Anrechenbar</Text>
            </View>
            {perMonth.map((b) => (
              <View style={styles.row} key={b.month}>
                <Text style={[styles.cDate, { width: 70 }]}>
                  {b.month.slice(0, 7)}
                </Text>
                <Text style={[styles.cAmount, { width: 80 }]}>
                  {formatMoney(b.einnahmenCents)}
                </Text>
                <Text style={[styles.cAmount, { width: 80 }]}>
                  {formatMoney(b.ausgabenCents)}
                </Text>
                <Text style={[styles.cAmount, { width: 70 }]}>
                  {formatMoney(b.saldoCents)}
                </Text>
                <Text style={[styles.cAmount, { width: 75 }]}>
                  {formatMoney(b.freibetragCents)}
                </Text>
                <Text style={[styles.cAmount, { width: 80, fontWeight: 700 }]}>
                  {formatMoney(b.anrechenbarCents)}
                </Text>
              </View>
            ))}
            <View
              style={[
                styles.row,
                { backgroundColor: "#f1f5f9", fontWeight: 700, borderBottomWidth: 1 },
              ]}
            >
              <Text style={[styles.cDate, { width: 70 }]}>Summe</Text>
              <Text style={[styles.cAmount, { width: 80 }]}>
                {formatMoney(bruttoEinnahmen)}
              </Text>
              <Text style={[styles.cAmount, { width: 80 }]}>
                {formatMoney(betriebsausgaben)}
              </Text>
              <Text style={[styles.cAmount, { width: 70 }]}>
                {formatMoney(nettoEinkommen)}
              </Text>
              <Text style={[styles.cAmount, { width: 75 }]}>
                {formatMoney(
                  perMonth.reduce((s, b) => s + b.freibetragCents, 0)
                )}
              </Text>
              <Text style={[styles.cAmount, { width: 80 }]}>
                {formatMoney(
                  perMonth.reduce((s, b) => s + b.anrechenbarCents, 0)
                )}
              </Text>
            </View>
          </View>
        ) : null}

        {/* A. Einnahmen */}
        <View style={styles.section}>
          <Text style={styles.sectionH}>A. Betriebseinnahmen</Text>
          {invoices.length > 0 ? (
            <>
              {invoices.map((inv) => (
                <View style={styles.row} key={inv.id}>
                  <Text style={styles.cDate}>{inv.issue_date}</Text>
                  <Text style={styles.c1}>Rechnung {inv.number ?? "—"}</Text>
                  <Text style={styles.cAmount}>
                    {formatMoney(inv.total_cents)}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
          {extraIncome.map((e) => (
            <View style={styles.row} key={e.id}>
              <Text style={styles.cDate}>{e.occurred_on}</Text>
              <Text style={styles.c1}>
                {e.source ?? e.description ?? "Einnahme"}
              </Text>
              <Text style={styles.cAmount}>{formatMoney(e.amount_cents)}</Text>
            </View>
          ))}
          {invoices.length + extraIncome.length === 0 ? (
            <Text style={{ color: "#94a3b8", paddingVertical: 4 }}>
              Keine Einnahmen im Zeitraum.
            </Text>
          ) : null}
          <View style={[styles.row, { fontWeight: 700, borderBottomWidth: 1 }]}>
            <Text style={styles.c1}>Summe Brutto-Einnahmen</Text>
            <Text style={styles.cAmount}>{formatMoney(bruttoEinnahmen)}</Text>
          </View>
        </View>

        {/* B. Betriebsausgaben */}
        <View style={styles.section}>
          <Text style={styles.sectionH}>B. Absetzbare Betriebsausgaben</Text>
          {relevantExpenses.length > 0 ? (
            <>
              {relevantExpenses.map((e) => (
                <View style={styles.row} key={e.id}>
                  <Text style={styles.cDate}>{e.occurred_on}</Text>
                  <Text style={styles.c1}>
                    {e.vendor ?? ""} {e.description ?? ""}
                    {e.category?.name ? ` · ${e.category.name}` : ""}
                  </Text>
                  <Text style={styles.cAmount}>
                    {formatMoney(e.amount_cents)}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={{ color: "#94a3b8", paddingVertical: 4 }}>
              Keine relevanten Ausgaben im Zeitraum.
            </Text>
          )}
          <View style={[styles.row, { fontWeight: 700, borderBottomWidth: 1 }]}>
            <Text style={styles.c1}>Summe Ausgaben</Text>
            <Text style={styles.cAmount}>{formatMoney(betriebsausgaben)}</Text>
          </View>
        </View>

        {/* C. Ergebnis */}
        <View style={styles.sumBox}>
          <View style={styles.sumRow}>
            <Text>Einnahmen</Text>
            <Text>{formatMoney(bruttoEinnahmen)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text>− Betriebsausgaben</Text>
            <Text>{formatMoney(betriebsausgaben)}</Text>
          </View>
          <View style={[styles.sumRow, { fontWeight: 700 }]}>
            <Text>= Netto-Einkommen</Text>
            <Text>{formatMoney(nettoEinkommen)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text>− Freibetrag (§11b SGB II)</Text>
            <Text>{formatMoney(freibetrag)}</Text>
          </View>
          <View style={styles.sumRowStrong}>
            <Text>Anrechenbares Einkommen auf Bürgergeld</Text>
            <Text>{formatMoney(anrechenbar)}</Text>
          </View>
        </View>

        {/* Unterschrift */}
        <View style={{ marginTop: 28 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 40,
            }}
          >
            <View style={{ width: 200 }}>
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: "#0f172a",
                  paddingTop: 4,
                }}
              >
                <Text style={{ fontSize: 8, color: "#475569" }}>
                  Ort, Datum
                </Text>
              </View>
            </View>
            <View style={{ width: 200 }}>
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: "#0f172a",
                  paddingTop: 4,
                }}
              >
                <Text style={{ fontSize: 8, color: "#475569" }}>
                  Unterschrift
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Interne Berechnung — bitte zusätzlich die offizielle SA40-Anlage-EKS
            der BA ausfüllen. Erstellt mit Kolos Digital Finanzen ·{" "}
            {new Date().toLocaleDateString("de-DE")}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
