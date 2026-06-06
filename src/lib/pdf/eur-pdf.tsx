import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "@/lib/money"
import { computeEur } from "@/lib/eur/compute"
import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
  Settings,
} from "@/types/database.types"

/**
 * Anlage EÜR (Einnahmen-Überschuss-Rechnung) — § 4 Abs. 3 EStG.
 * Maps invoice revenue + income/expense entries to the official EÜR Zeilen.
 *
 * NOT the official BMF PDF form (Zeilen 11-99). This is an internal computation
 * organized along the same line numbers, so the user can transfer values to
 * ELSTER or hand off to Steuerberater.
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
  title: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#475569", marginBottom: 20 },
  sectionH: {
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: "#f1f5f9",
    padding: 6,
    borderRadius: 4,
    marginTop: 14,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderColor: "#e2e8f0",
  },
  zeile: { width: 40, color: "#64748b", fontFamily: "Helvetica-Bold" },
  label: { flex: 1, paddingHorizontal: 4 },
  amount: { width: 90, textAlign: "right" },
  total: { fontWeight: 700 },
  summaryBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "#ecfeff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#06b6d4",
    color: "#0e7490",
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
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
})

export interface EurPdfInput {
  settings: Settings
  year: number
  invoices: Invoice[]
  extraIncome: IncomeEntry[]
  expenses: (ExpenseEntry & { category?: Category | null })[]
}

export function EurPdf(input: EurPdfInput) {
  const { settings, year, invoices, extraIncome, expenses } = input

  // EÜR-Berechnung kommt aus dem pure Module `@/lib/eur/compute` —
  // testbar via scripts/test-eur.mjs, ohne PDF-Stream mocken zu müssen.
  const result = computeEur({ year, invoices, extraIncome, expenses })
  const einnahmenUmsatz = result.einnahmenUmsatzCents
  const einnahmenExtra = result.einnahmenExtraCents
  const einnahmenGesamt = result.einnahmenGesamtCents
  const ausgabenGesamt = result.ausgabenGesamtCents
  const gewinn = result.gewinnCents
  const sortedZeilen = result.ausgabenByZeile.map(
    (b) => [b.zeile, { label: b.label, amount: b.amountCents }] as const,
  )

  const issuerName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "—"

  return (
    <Document title={`EÜR ${year}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Anlage EÜR — {year}</Text>
        <Text style={styles.subtitle}>
          Einnahmen-Überschuss-Rechnung gemäß § 4 Abs. 3 EStG · {issuerName}
          {settings.tax_id ? ` · St-Nr. ${settings.tax_id}` : ""}
        </Text>

        {/* A. Betriebseinnahmen */}
        <Text style={styles.sectionH}>A. Betriebseinnahmen (Zeilen 11–24)</Text>
        <View style={styles.row}>
          <Text style={styles.zeile}>Z14</Text>
          <Text style={styles.label}>Umsätze aus selbständiger Tätigkeit</Text>
          <Text style={styles.amount}>{formatMoney(einnahmenUmsatz)}</Text>
        </View>
        {einnahmenExtra > 0 ? (
          <View style={styles.row}>
            <Text style={styles.zeile}>Z17</Text>
            <Text style={styles.label}>Sonstige Betriebseinnahmen</Text>
            <Text style={styles.amount}>{formatMoney(einnahmenExtra)}</Text>
          </View>
        ) : null}
        <View style={[styles.row, styles.total]}>
          <Text style={styles.zeile}>Z22</Text>
          <Text style={styles.label}>Summe Betriebseinnahmen</Text>
          <Text style={styles.amount}>{formatMoney(einnahmenGesamt)}</Text>
        </View>

        {/* B. Betriebsausgaben */}
        <Text style={styles.sectionH}>B. Betriebsausgaben (Zeilen 25–58)</Text>
        {sortedZeilen.length === 0 ? (
          <Text style={{ paddingVertical: 6, color: "#94a3b8" }}>
            Keine Betriebsausgaben erfasst.
          </Text>
        ) : (
          sortedZeilen.map(([z, v]) => (
            <View key={z} style={styles.row}>
              <Text style={styles.zeile}>Z{z}</Text>
              <Text style={styles.label}>{v.label}</Text>
              <Text style={styles.amount}>{formatMoney(v.amount)}</Text>
            </View>
          ))
        )}
        <View style={[styles.row, styles.total]}>
          <Text style={styles.zeile}>Z66</Text>
          <Text style={styles.label}>Summe Betriebsausgaben</Text>
          <Text style={styles.amount}>{formatMoney(ausgabenGesamt)}</Text>
        </View>

        {/* C. Ergebnis */}
        <View style={styles.summaryBox}>
          <View style={styles.sumRow}>
            <Text>Einnahmen</Text>
            <Text>{formatMoney(einnahmenGesamt)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text>− Ausgaben</Text>
            <Text>{formatMoney(ausgabenGesamt)}</Text>
          </View>
          <View style={styles.sumRowStrong}>
            <Text>Z89 = Gewinn / Verlust {year}</Text>
            <Text>{formatMoney(gewinn)}</Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 16,
            padding: 8,
            backgroundColor: "#fef3c7",
            borderRadius: 6,
            fontSize: 8,
            color: "#78350f",
          }}
        >
          <Text style={{ fontWeight: 700, marginBottom: 2 }}>Hinweis</Text>
          <Text>
            Diese Übersicht ist die interne Kalkulation. Die offizielle Anlage
            EÜR (BMF-Formular) wird per ELSTER elektronisch übermittelt —
            übertrage die Werte per Zeile oder nutze DATEV-Export für deine/n
            Steuerberater:in.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Erstellt mit Kolos Digital Finanzen · Stand{" "}
            {new Date().toLocaleDateString("de-DE")} · SKR03-Mapping
          </Text>
        </View>
      </Page>
    </Document>
  )
}
