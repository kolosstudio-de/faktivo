/**
 * Endgültige EKS-Festsetzung — Bescheid-Anhang für den gesamten Bewilligungszeitraum.
 *
 * Wird am Ende des BWZ erstellt. Vergleicht Vorläufige Prognose mit Ist-Einkünften
 * und weist Rückforderung oder Nachzahlung explizit aus — Format ist an die
 * SA40-Anlage-EKS-Logik angelehnt, ergänzt um die Tabelle vorläufig vs endgültig.
 */

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "@/lib/money"
import type { Settings } from "@/types/database.types"
import type { RueckforderungResult } from "@/lib/jobcenter"

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
  cMonth: { width: 60, paddingHorizontal: 4 },
  cAmount: { flex: 1, paddingHorizontal: 4, textAlign: "right" },
  totalsBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#ecfeff",
    borderRadius: 6,
    borderColor: "#06b6d4",
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
    fontSize: 13,
  },
  saldoForderungBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#fef2f2",
    borderColor: "#dc2626",
    borderWidth: 1,
    borderRadius: 6,
  },
  saldoNachzahlungBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#f0fdf4",
    borderColor: "#16a34a",
    borderWidth: 1,
    borderRadius: 6,
  },
  saldoNeutralBox: {
    marginTop: 12,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderColor: "#94a3b8",
    borderWidth: 1,
    borderRadius: 6,
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

export interface EksEndgueltigPdfInput {
  settings: Settings
  bwzStart: string
  bwzEnd: string
  rueckforderung: RueckforderungResult
  hasMinorChildren: boolean
}

export function EksEndgueltigPdf(input: EksEndgueltigPdfInput) {
  const { settings, bwzStart, bwzEnd, rueckforderung, hasMinorChildren } = input

  const issuerName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "—"

  const saldo = rueckforderung.saldoCents
  const saldoBox =
    saldo > 0
      ? styles.saldoForderungBox
      : saldo < 0
        ? styles.saldoNachzahlungBox
        : styles.saldoNeutralBox
  const saldoTitle =
    saldo > 0
      ? "Voraussichtliche Rückforderung an Jobcenter"
      : saldo < 0
        ? "Voraussichtliche Nachzahlung vom Jobcenter"
        : "Bewilligungszeitraum ausgeglichen"

  return (
    <Document title={`EKS Endgültig ${bwzStart}–${bwzEnd}`}>
      <Page size="A4" style={styles.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.title}>
              Endgültige Anlage EKS — Bescheid-Anhang
            </Text>
            <Text style={styles.subtitle}>
              Bewilligungszeitraum {bwzStart} bis {bwzEnd} ·
              {" §41a SGB II"}
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
            Monatliche Gegenüberstellung Prognose vs. Ist
          </Text>
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={styles.cMonth}>Monat</Text>
              <Text style={styles.cAmount}>Prognose</Text>
              <Text style={styles.cAmount}>Ist</Text>
              <Text style={styles.cAmount}>Anrech. Prog</Text>
              <Text style={styles.cAmount}>Anrech. Ist</Text>
              <Text style={styles.cAmount}>Vorläufig</Text>
              <Text style={styles.cAmount}>Endgültig</Text>
              <Text style={styles.cAmount}>Differenz</Text>
            </View>
            {rueckforderung.rows.map((r) => (
              <View key={r.month} style={styles.tr}>
                <Text style={styles.cMonth}>{r.month.slice(0, 7)}</Text>
                <Text style={styles.cAmount}>
                  {formatMoney(r.prognoseEinkommenCents)}
                </Text>
                <Text style={styles.cAmount}>
                  {formatMoney(r.istEinkommenCents)}
                </Text>
                <Text style={styles.cAmount}>
                  {formatMoney(r.anrechenbarPrognoseCents)}
                </Text>
                <Text style={styles.cAmount}>
                  {formatMoney(r.anrechenbarIstCents)}
                </Text>
                <Text style={styles.cAmount}>
                  {formatMoney(r.zahlungVorlaeufigCents)}
                </Text>
                <Text style={styles.cAmount}>
                  {formatMoney(r.zahlungEndgueltigCents)}
                </Text>
                <Text
                  style={[
                    styles.cAmount,
                    {
                      color:
                        r.diffCents > 0
                          ? "#dc2626"
                          : r.diffCents < 0
                            ? "#16a34a"
                            : "#0f172a",
                    },
                  ]}
                >
                  {formatMoney(r.diffCents)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Bedarf monatlich (Bürgergeld + KdU + Mehrbedarfe)</Text>
            <Text>{formatMoney(rueckforderung.bedarfMonatlichCents)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Vorläufig erhalten (Summe aller Monate)</Text>
            <Text>{formatMoney(rueckforderung.totalVorlaeufigCents)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Endgültiger Anspruch (Summe aller Monate)</Text>
            <Text>{formatMoney(rueckforderung.totalEndgueltigCents)}</Text>
          </View>
          <View style={styles.totalsRowStrong}>
            <Text>{saldoTitle}</Text>
            <Text>{formatMoney(Math.abs(saldo))}</Text>
          </View>
        </View>

        <View style={saldoBox}>
          <Text style={{ fontWeight: 700, marginBottom: 4 }}>{saldoTitle}</Text>
          <Text style={{ fontSize: 8, lineHeight: 1.4 }}>
            {saldo > 0
              ? "Da die tatsächlichen Einkünfte höher als die Prognose lagen, wurde im BWZ zu viel Bürgergeld vorläufig gezahlt. Diese Summe ist gemäß §41a Abs. 5 SGB II an das Jobcenter zurückzuzahlen."
              : saldo < 0
                ? "Da die tatsächlichen Einkünfte niedriger als die Prognose lagen, hat die antragstellende Person Anspruch auf Nachzahlung dieser Summe."
                : "Prognose und Ist-Einkommen stimmen überein — keine Rückforderung oder Nachzahlung."}
          </Text>
          <Text style={{ fontSize: 8, marginTop: 8, color: "#475569" }}>
            Berechnungsgrundlagen: §11b SGB II (Freibeträge), §3 ALG II-V
            (Selbständigen-Einkommen), §41a SGB II (Endgültige Festsetzung).
            {hasMinorChildren
              ? " Tier-2-Cap erhöht auf 1.500 € wegen minderjährigem Kind."
              : ""}
          </Text>
        </View>

        <Text
          style={{ marginTop: 24, fontSize: 8, color: "#64748b", lineHeight: 1.5 }}
        >
          Hinweis: Diese Berechnung dient als Anhang zur offiziellen Anlage EKS.
          Die endgültige Festsetzung erfolgt durch das Jobcenter im
          Bescheid-Verfahren — der hier ausgewiesene Saldo kann von der amtlichen
          Festsetzung abweichen, falls das Jobcenter weitere Faktoren (z.B.
          Veränderungen der Bedarfsgemeinschaft, KdU-Anpassungen oder
          Zuflussprinzip vs. Zahlungsprinzip) berücksichtigt.
        </Text>

        <View style={styles.footer} fixed>
          <Text>
            Erstellt mit Kolos Digital Finanzen ·{" "}
            {new Date().toLocaleDateString("de-DE")} · Selbst-Berechnung gemäß
            §11b SGB II / §41a SGB II
          </Text>
        </View>
      </Page>
    </Document>
  )
}
