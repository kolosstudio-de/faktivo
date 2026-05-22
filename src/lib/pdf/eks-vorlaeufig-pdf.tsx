/**
 * Vorläufige EKS-Prognose — Anlage EKS am Anfang des Bewilligungszeitraums.
 *
 * Wird ZU BEGINN des BWZ erstellt. Liefert dem Jobcenter eine monatliche
 * Schätzung der voraussichtlichen Einkünfte aus selbständiger Tätigkeit als
 * Basis für die vorläufige Festsetzung des Bürgergelds (§41a SGB II).
 *
 * Endgültige Festsetzung erfolgt erst NACH Ablauf des BWZ über
 * eks-endgueltig-pdf.tsx.
 */

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "@/lib/money"
import type { EksPrognoseMonth, Settings } from "@/types/database.types"

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#475569", marginBottom: 16 },
  meta: { fontSize: 9, color: "#475569", marginBottom: 1 },
  section: { marginTop: 16 },
  sectionH: {
    fontSize: 11,
    fontWeight: 700,
    backgroundColor: "#f1f5f9",
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  table: { marginTop: 4 },
  thead: {
    flexDirection: "row",
    paddingVertical: 4,
    backgroundColor: "#e2e8f0",
    fontSize: 8,
    fontWeight: 700,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderColor: "#e2e8f0",
  },
  trTotal: {
    flexDirection: "row",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderColor: "#0f172a",
    fontWeight: 700,
    backgroundColor: "#f8fafc",
  },
  cMonth: { width: 90, paddingHorizontal: 4 },
  cAmount: { flex: 1, paddingHorizontal: 4, textAlign: "right" },
  totalsBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    borderColor: "#3b82f6",
    borderWidth: 1,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsRowStrong: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 6,
    borderTopWidth: 1,
    fontWeight: 700,
    fontSize: 12,
  },
  disclaimerBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderColor: "#d97706",
    borderWidth: 1,
    borderRadius: 6,
  },
  signature: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBlock: {
    flex: 1,
    paddingHorizontal: 8,
  },
  signatureLine: {
    borderTopWidth: 0.6,
    borderColor: "#0f172a",
    marginTop: 32,
    paddingTop: 4,
    fontSize: 8,
    color: "#475569",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7.5,
    color: "#94a3b8",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderColor: "#e2e8f0",
    paddingTop: 6,
  },
})

export interface EksVorlaeufigPdfInput {
  settings: Settings
  bwzStart: string
  bwzEnd: string
  months: EksPrognoseMonth[]
}

export function EksVorlaeufigPdf(input: EksVorlaeufigPdfInput) {
  const { settings, bwzStart, bwzEnd, months } = input

  const issuerName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "—"

  const totalEinnahmen = months.reduce((s, m) => s + m.einnahmenCents, 0)
  const totalAusgaben = months.reduce((s, m) => s + m.ausgabenCents, 0)
  const totalSaldo = Math.max(0, totalEinnahmen - totalAusgaben)
  const avgMonatlich =
    months.length > 0 ? Math.round(totalSaldo / months.length) : 0

  return (
    <Document title={`EKS Vorläufig ${bwzStart}–${bwzEnd}`}>
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.title}>
              Anlage EKS — vorläufige Berechnung
            </Text>
            <Text style={styles.subtitle}>
              Bewilligungszeitraum {bwzStart} bis {bwzEnd} ·
              {" §41a SGB II / §3 ALG II-V"}
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
            <Text style={styles.meta}>
              Erstellt: {new Date().toLocaleDateString("de-DE")}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionH}>
            Monatliche Schätzung der voraussichtlichen Einkünfte
          </Text>
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={styles.cMonth}>Monat</Text>
              <Text style={styles.cAmount}>Geschätzte Einnahmen</Text>
              <Text style={styles.cAmount}>Geschätzte Ausgaben</Text>
              <Text style={styles.cAmount}>Saldo</Text>
            </View>
            {months.map((m) => {
              const saldo = Math.max(0, m.einnahmenCents - m.ausgabenCents)
              return (
                <View key={m.month} style={styles.tr}>
                  <Text style={styles.cMonth}>{m.month.slice(0, 7)}</Text>
                  <Text style={styles.cAmount}>
                    {formatMoney(m.einnahmenCents)}
                  </Text>
                  <Text style={styles.cAmount}>
                    {formatMoney(m.ausgabenCents)}
                  </Text>
                  <Text style={styles.cAmount}>{formatMoney(saldo)}</Text>
                </View>
              )
            })}
            <View style={styles.trTotal}>
              <Text style={styles.cMonth}>Σ Gesamt</Text>
              <Text style={styles.cAmount}>{formatMoney(totalEinnahmen)}</Text>
              <Text style={styles.cAmount}>{formatMoney(totalAusgaben)}</Text>
              <Text style={styles.cAmount}>{formatMoney(totalSaldo)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Voraussichtliche Einnahmen (BWZ gesamt)</Text>
            <Text>{formatMoney(totalEinnahmen)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Voraussichtliche Ausgaben (BWZ gesamt)</Text>
            <Text>{formatMoney(totalAusgaben)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Anzahl Monate im Bewilligungszeitraum</Text>
            <Text>{months.length}</Text>
          </View>
          <View style={styles.totalsRowStrong}>
            <Text>Voraussichtliches Durchschnitts-Einkommen je Monat</Text>
            <Text>{formatMoney(avgMonatlich)}</Text>
          </View>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>
            Hinweis — Vorläufige Werte
          </Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.4 }}>
            Vorläufige Werte. Endgültige Festsetzung erfolgt nach Ende des
            Bewilligungszeitraums anhand der tatsächlich erzielten Einkünfte
            (§41a Abs. 3 SGB II). Sollte das tatsächliche Einkommen erheblich
            von dieser Prognose abweichen, wird das Jobcenter rückwirkend eine
            Rückforderung (zu viel gezahltes Bürgergeld) oder Nachzahlung (zu
            wenig gezahltes Bürgergeld) festsetzen.
          </Text>
          <Text style={{ fontSize: 8, marginTop: 8, color: "#475569" }}>
            Berechnungsgrundlagen: §41a SGB II (Vorläufige Entscheidung),
            §3 ALG II-V (Selbständigen-Einkommen), §11b SGB II (Freibeträge).
          </Text>
        </View>

        <View style={styles.signature}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine}>
              <Text>Ort, Datum</Text>
            </View>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine}>
              <Text>Unterschrift Antragsteller:in ({issuerName})</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Erstellt mit Faktivo / Kolos Digital ·{" "}
            {new Date().toLocaleDateString("de-DE")} · Selbst-Berechnung gemäß
            §41a SGB II / §3 ALG II-V (Vorläufige EKS-Prognose)
          </Text>
        </View>
      </Page>
    </Document>
  )
}
