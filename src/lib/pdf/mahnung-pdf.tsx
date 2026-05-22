import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

import { formatMoney } from "@/lib/money"
import { clientDisplayName } from "@/lib/utils/client-display"
import type {
  Client,
  Invoice,
  Mahnung,
  MahnungStufe,
  Settings,
} from "@/types/database.types"

const TITLE_BY_STUFE: Record<MahnungStufe, string> = {
  "1": "Zahlungserinnerung",
  "2": "Mahnung",
  "3": "Letzte Mahnung",
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  logoSquare: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#0f766e",
    color: "#f0fdfa",
    textAlign: "center",
    fontSize: 16,
    fontWeight: 700,
    paddingTop: 14,
  },
  issuerBlock: { textAlign: "right", fontSize: 9, color: "#475569" },
  issuerName: { color: "#0f172a", fontSize: 10, fontWeight: 700 },
  addressCol: { marginBottom: 28 },
  labelTiny: {
    color: "#94a3b8",
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 0.5,
    marginBottom: 4,
    color: "#b91c1c",
  },
  subHeading: { fontSize: 12, color: "#475569", marginBottom: 20 },
  paragraph: { fontSize: 10, lineHeight: 1.5, marginBottom: 12 },
  table: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 8,
    marginBottom: 16,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderColor: "#e2e8f0",
  },
  trLabel: { flex: 1, paddingHorizontal: 4 },
  trAmount: { width: 110, textAlign: "right", paddingHorizontal: 4 },
  total: { fontSize: 13, fontWeight: 700 },
  paymentBlock: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    fontSize: 9,
    lineHeight: 1.5,
    color: "#78350f",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 48,
    right: 48,
    fontSize: 7.5,
    color: "#94a3b8",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderColor: "#e2e8f0",
    paddingTop: 8,
  },
})

interface Props {
  mahnung: Mahnung
  invoice: Invoice
  client: Client
  settings: Settings
}

export function MahnungPdf({ mahnung, invoice, client, settings }: Props) {
  const title = TITLE_BY_STUFE[mahnung.stufe]
  const issuerInitials = (settings.company_name ?? "KD")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const issuerAddr = settings.address ?? {}
  const clientAddr = client.address ?? {}

  const dueDisplay = mahnung.due_at ?? invoice.due_date ?? "sofort"

  const bodyText = (() => {
    if (mahnung.stufe === "1") {
      return `Sehr geehrte Damen und Herren,\n\ntrotz unserer Rechnung ${invoice.number} vom ${invoice.issue_date}${invoice.due_date ? ` (fällig ${invoice.due_date})` : ""} konnten wir bis heute keinen Zahlungseingang feststellen. Sicher haben Sie es bei der Vielzahl Ihrer Verpflichtungen nur übersehen — wir bitten Sie, den offenen Betrag bis ${dueDisplay} zu begleichen.`
    }
    if (mahnung.stufe === "2") {
      return `Sehr geehrte Damen und Herren,\n\ntrotz unserer Zahlungserinnerung konnten wir für die Rechnung ${invoice.number} vom ${invoice.issue_date} bisher keinen Zahlungseingang verzeichnen. Wir mahnen den offenen Betrag hiermit an und bitten um Überweisung bis ${dueDisplay}.\n\nGemäß §286/§288 BGB entstehen ab Eintritt des Verzugs Verzugszinsen.`
    }
    return `Sehr geehrte Damen und Herren,\n\ntrotz mehrfacher Zahlungsaufforderung ist die offene Forderung aus Rechnung ${invoice.number} vom ${invoice.issue_date} bisher nicht beglichen. Wir fordern Sie letztmalig auf, den Gesamtbetrag bis ${dueDisplay} zu überweisen.\n\nNach fruchtlosem Ablauf dieser Frist werden wir die Forderung ohne weitere Ankündigung in ein gerichtliches Mahnverfahren geben. Weitere Kosten (Rechts­anwalt, Inkasso, Gericht) werden Ihnen dann in Rechnung gestellt.`
  })()

  return (
    <Document
      author={settings.company_name ?? "Kolos Digital"}
      title={`${title} zu ${invoice.number}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.logoSquare}>
            <Text>{issuerInitials}</Text>
          </View>
          <View style={styles.issuerBlock}>
            <Text style={styles.issuerName}>
              {settings.company_name || "Kolos Digital"}
            </Text>
            <Text>{issuerAddr.street}</Text>
            <Text>
              {[issuerAddr.zip, issuerAddr.city].filter(Boolean).join(" ")}
            </Text>
            {settings.tax_id ? (
              <Text>Steuer-Nr.: {settings.tax_id}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.addressCol}>
          <Text style={styles.labelTiny}>Empfänger</Text>
          <Text style={{ fontWeight: 700 }}>{clientDisplayName(client)}</Text>
          {clientAddr.street ? <Text>{clientAddr.street}</Text> : null}
          <Text>
            {[clientAddr.zip, clientAddr.city].filter(Boolean).join(" ")}
          </Text>
        </View>

        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.subHeading}>
          zur Rechnung {invoice.number} vom {invoice.issue_date}
        </Text>

        <Text style={styles.paragraph}>{bodyText}</Text>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.trLabel}>Offener Rechnungsbetrag</Text>
            <Text style={styles.trAmount}>
              {formatMoney(mahnung.base_amount_cents)}
            </Text>
          </View>
          {mahnung.fee_cents > 0 ? (
            <View style={styles.tr}>
              <Text style={styles.trLabel}>Mahngebühr (Stufe {mahnung.stufe})</Text>
              <Text style={styles.trAmount}>
                {formatMoney(mahnung.fee_cents)}
              </Text>
            </View>
          ) : null}
          {mahnung.verzugspauschale_cents > 0 ? (
            <View style={styles.tr}>
              <Text style={styles.trLabel}>
                Verzugspauschale (§288 V BGB)
              </Text>
              <Text style={styles.trAmount}>
                {formatMoney(mahnung.verzugspauschale_cents)}
              </Text>
            </View>
          ) : null}
          {mahnung.verzugszinsen_cents > 0 ? (
            <View style={styles.tr}>
              <Text style={styles.trLabel}>Verzugszinsen (§288 BGB)</Text>
              <Text style={styles.trAmount}>
                {formatMoney(mahnung.verzugszinsen_cents)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.tr, { borderTopWidth: 1, borderColor: "#0f172a" }]}>
            <Text style={[styles.trLabel, styles.total]}>Zu zahlen</Text>
            <Text style={[styles.trAmount, styles.total]}>
              {formatMoney(mahnung.total_cents)}
            </Text>
          </View>
        </View>

        {settings.iban ? (
          <View style={styles.paymentBlock}>
            <Text style={{ fontWeight: 700 }}>
              Bitte überweisen Sie auf folgendes Konto:
            </Text>
            <Text>
              IBAN: {settings.iban}
              {settings.bic ? `  ·  BIC: ${settings.bic}` : ""}
              {settings.bank_name ? `  ·  ${settings.bank_name}` : ""}
            </Text>
            <Text>
              Verwendungszweck: Rechnung {invoice.number} · {title}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 20, fontSize: 9, lineHeight: 1.5 }}>
          <Text>
            Sollte sich Ihre Zahlung mit diesem Schreiben gekreuzt haben,
            betrachten Sie es bitte als gegenstandslos.
          </Text>
          <Text style={{ marginTop: 8 }}>Mit freundlichen Grüßen</Text>
          <Text style={{ marginTop: 12, fontWeight: 700 }}>
            {settings.company_name ||
              [settings.first_name, settings.last_name]
                .filter(Boolean)
                .join(" ")}
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {settings.company_name ?? "Kolos Digital"}
            {settings.ust_id ? `  ·  USt-IdNr. ${settings.ust_id}` : ""}
            {settings.tax_id ? `  ·  St-Nr. ${settings.tax_id}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
