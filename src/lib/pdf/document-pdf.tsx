import path from "node:path"
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"

import { formatMoney, vatBreakdown } from "@/lib/money"
import {
  invoiceNotices,
  kleinunternehmerLabel,
  normalizeInvoiceLocale,
  type InvoiceLocale,
} from "@/lib/vat"
import { clientDisplayName } from "@/lib/utils/client-display"
import type {
  Client,
  Invoice,
  LineItem,
  Quote,
  Settings,
} from "@/types/database.types"

/**
 * Schriftart-Registrierung: DejaVu Serif (volles Unicode — Latin, Cyrillic,
 * Greek, German Umlaute, Sonderzeichen). Wird einmal pro Prozess geladen,
 * react-pdf cached intern. Times-Roman wäre eingebaut, hat aber NUR Latin —
 * russische/ukrainische Namen würden als „?" rendern.
 *
 * Public-Pfad: public/fonts/DejaVuSerif*.ttf (kein HTTP-Roundtrip, läuft
 * direkt vom Dateisystem in der Server-Component).
 */
const FONT_DIR = path.join(process.cwd(), "public", "fonts")

Font.register({
  family: "DejaVu Serif",
  fonts: [
    { src: path.join(FONT_DIR, "DejaVuSerif.ttf"), fontWeight: "normal" },
    { src: path.join(FONT_DIR, "DejaVuSerif-Bold.ttf"), fontWeight: "bold" },
  ],
})

// Hyphenation deaktivieren — react-pdf trennt sonst lange Wörter unschön.
Font.registerHyphenationCallback((word) => [word])

/**
 * KLASSISCHES DEUTSCHES RECHNUNGS-LAYOUT — Times-Roman, schwarzer Text auf
 * weißem Papier, mittiger Titel, zweispaltige Adresse (Empfänger LINKS,
 * Anbieter RECHTS), umrandete Positionstabelle, Zahlungsbedingungen +
 * Bankverbindung am Ende, optional SEPA-Girocode.
 *
 * Format-Vorbild: typische deutsche Freiberufler-/Kleinunternehmer-Rechnung,
 * § 14 UStG-konform, gut lesbar in Print + Mail.
 */

// ─── Styles ─────────────────────────────────────────────────────────────

const BORDER = "#1a1a1a"
const TEXT = "#000000"
const MUTED = "#333333"

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    fontSize: 10.5,
    fontFamily: "DejaVu Serif",
    color: TEXT,
    lineHeight: 1.35,
  },

  // Header — centered title
  title: {
    fontSize: 18,
    fontFamily: "DejaVu Serif", fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 1,
    marginBottom: 60,
  },

  // Two-column address block
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  addressCol: { width: "48%" },
  addressName: { fontFamily: "DejaVu Serif", fontWeight: "bold", marginBottom: 1 },
  addressStreetBold: { fontFamily: "DejaVu Serif", fontWeight: "bold", marginBottom: 1 },

  // Meta row (Rechnungsnummer / Rechnungsdatum)
  metaBlock: { marginBottom: 14 },
  metaLine: { flexDirection: "row" },
  metaLabel: {
    fontFamily: "DejaVu Serif",
    fontWeight: "bold",
    width: 140,
    paddingRight: 6,
  },

  klein: { marginBottom: 18, marginTop: 2 },

  // Items table
  table: {
    borderWidth: 0.7,
    borderColor: BORDER,
    marginTop: 4,
  },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 0.7,
    borderColor: BORDER,
    paddingVertical: 6,
    minHeight: 22,
  },
  tableHeadCell: { fontFamily: "DejaVu Serif" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 6,
    minHeight: 22,
    alignItems: "flex-start",
  },
  tableRowTall: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 6,
    minHeight: 50,
    alignItems: "flex-start",
  },
  tableRowTotal: {
    flexDirection: "row",
    paddingVertical: 8,
    minHeight: 26,
    alignItems: "center",
  },

  // Column widths — Pos | Bezeichnung | Menge × E-Preis | USt | Betrag
  colPos: {
    width: 44,
    paddingHorizontal: 8,
    borderRightWidth: 0.5,
    borderColor: BORDER,
    textAlign: "left",
  },
  colDesc: {
    flex: 1,
    paddingHorizontal: 10,
    borderRightWidth: 0.5,
    borderColor: BORDER,
  },
  colQty: {
    width: 64,
    paddingHorizontal: 6,
    borderRightWidth: 0.5,
    borderColor: BORDER,
    textAlign: "right",
  },
  colVat: {
    width: 38,
    paddingHorizontal: 4,
    borderRightWidth: 0.5,
    borderColor: BORDER,
    textAlign: "right",
  },
  colBetrag: {
    width: 86,
    paddingHorizontal: 8,
    textAlign: "right",
  },

  bold: { fontFamily: "DejaVu Serif", fontWeight: "bold" },

  sectionHeading: {
    fontFamily: "DejaVu Serif", fontWeight: "bold",
    marginTop: 14,
    marginBottom: 3,
  },
  sectionBody: { lineHeight: 1.3 },
  paragraph: { marginBottom: 1 },

  noticeBox: {
    marginTop: 14,
    fontSize: 9.5,
    color: MUTED,
    lineHeight: 1.4,
    fontStyle: "italic",
  },

  // Totals (only shown when NOT Kleinunternehmer — for VAT breakdown)
  totalsBox: {
    alignSelf: "flex-end",
    width: 240,
    marginTop: -1, // joins with table border
    borderWidth: 0.7,
    borderTopWidth: 0,
    borderColor: BORDER,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderColor: BORDER,
  },
  totalsRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#f5f5f5",
  },

  // SEPA Girocode (right-aligned next to Bankverbindung)
  girocodeBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 18,
  },
  girocodeImg: { width: 110, height: 110 },
  girocodeCaption: {
    fontSize: 8,
    color: MUTED,
    width: 110,
    textAlign: "center",
    marginTop: 4,
  },

  // Branding — logo in issuer column
  logoImg: {
    maxHeight: 50,
    maxWidth: 180,
    marginBottom: 4,
    objectFit: "contain",
  },

  // Branding — signature + stamp footer row
  brandingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 18,
  },
  signatureBlock: { width: "50%" },
  signatureImg: {
    maxHeight: 60,
    maxWidth: 200,
    objectFit: "contain",
    marginBottom: 2,
  },
  signatureCaption: {
    fontSize: 9,
    color: MUTED,
    borderTopWidth: 0.5,
    borderColor: BORDER,
    paddingTop: 2,
    width: 200,
  },
  stampBlock: {
    width: "40%",
    alignItems: "flex-end",
  },
  stampImg: {
    maxHeight: 80,
    maxWidth: 120,
    objectFit: "contain",
    transform: "rotate(-3deg)",
  },

  // Page footer (page X of Y, fixed)
  pageFooter: {
    position: "absolute",
    bottom: 24,
    left: 64,
    right: 64,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
  },
})

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Rendert Text mit **fett** Markern als gemischt-formatierten Text.
 * Beispiel: "Bitte überweisen unter Angabe der Rechnungsnummer **RE-2026-006**."
 *  → "Bitte überweisen unter Angabe der Rechnungsnummer " + <Bold>RE-2026-006</Bold> + "."
 */
function MarkedText({
  children,
  style,
}: {
  children: string
  style?: Style | Style[]
}) {
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(children)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={key++}>{children.slice(last, match.index)}</Text>)
    }
    parts.push(
      <Text key={key++} style={styles.bold}>
        {match[1]}
      </Text>
    )
    last = re.lastIndex
  }
  if (last < children.length) {
    parts.push(<Text key={key++}>{children.slice(last)}</Text>)
  }
  return <Text style={style}>{parts}</Text>
}

function formatGermanDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

function joinAddressLine(zip?: string, city?: string): string {
  return [zip, city].filter(Boolean).join(" ")
}

// ─── Main Component ─────────────────────────────────────────────────────

interface DocumentPdfProps {
  kind: "invoice" | "quote"
  doc: Invoice | Quote
  lines: LineItem[]
  client: Client
  settings: Settings
  /** Optional: vorab generierter SEPA-Girocode-DataURL */
  girocodeDataUrl?: string
  /** Logo URL/data URL for letterhead */
  logoUrl?: string
  /** Signature URL/data URL — only rendered when showSignature is true */
  signatureDataUrl?: string
  showSignature?: boolean
  /** Stamp URL/data URL — only rendered when showStamp is true */
  stampDataUrl?: string
  showStamp?: boolean
  /**
   * Sprache des Rechnungs-PDFs. Wirkt aktuell auf die Steuer-Hinweise (§19/§13b)
   * und das Kleinunternehmer-Label über der Positions-Tabelle. Default `"de"`
   * — die juristisch eindeutige Sprache für deutsche Steuer-Belege. Wenn der
   * Endkunde im Ausland sitzt, kann der Aufrufer (`/api/pdf/...`) auf en/ru/uk
   * wechseln; die §-Verweise bleiben in jedem Fall deutsch.
   */
  locale?: InvoiceLocale
}

export function DocumentPdf(props: DocumentPdfProps) {
  const {
    kind,
    doc,
    lines,
    client,
    settings,
    girocodeDataUrl,
    logoUrl,
    signatureDataUrl,
    showSignature,
    stampDataUrl,
    showStamp,
    locale: localeProp,
  } = props
  // Final-Locale für Steuer-Notizen: prop > settings.invoice_language_default > "de".
  // normalizeInvoiceLocale fängt Garbage-Input (z. B. "ua" oder "de-DE") ab.
  const locale: InvoiceLocale = normalizeInvoiceLocale(
    localeProp ?? settings.invoice_language_default
  )
  const isInvoice = kind === "invoice"
  const inv = doc as Invoice
  const q = doc as Quote

  const isKleinunt =
    isInvoice && (inv.is_kleinunternehmer_at_issue ?? settings.is_kleinunternehmer ?? false)
  const isReverseCharge = isInvoice && (inv.reverse_charge ?? false)

  const notices = invoiceNotices(
    {
      isKleinunternehmer: isKleinunt,
      reverseCharge: isReverseCharge,
    },
    locale
  ).filter((n) => {
    // Den §19-Hinweis filtern wir raus — dieser wird bereits als
    // Kurz-Label (siehe `kleinunternehmerLabel(locale)`) über der Tabelle
    // angezeigt. Regex passt auf alle Locale-Varianten (alle enthalten "§ 19").
    if (isKleinunt && /§\s*19|Kleinunternehmer|small.?business|Малы[йи].?бизнес|малий\s+бізнес/i.test(n)) {
      return false
    }
    return true
  })

  const breakdown = vatBreakdown(
    lines.map((l) => ({
      vat_rate: Number(l.vat_rate),
      line_subtotal_cents: l.line_subtotal_cents,
      line_vat_cents: l.line_vat_cents,
    }))
  )

  const issuerAddr = settings.address ?? {}
  const clientAddr = client.address ?? {}
  const issuerFullName =
    [settings.first_name, settings.last_name].filter(Boolean).join(" ").trim() ||
    settings.company_name ||
    "Anbieter"

  const docNumber =
    doc.number ?? (isInvoice ? "ENTWURF" : "ANGEBOT-ENTWURF")
  const titleText = isInvoice ? "RECHNUNG" : "ANGEBOT"

  // Default payment terms text if user didn't set any
  const paymentTermsText =
    isInvoice && inv.payment_terms?.trim()
      ? inv.payment_terms
      : isInvoice
        ? `Der Rechnungsbetrag ist innerhalb von 14 Tagen nach Rechnungsdatum ohne Abzug fällig. Bitte überweisen Sie den Gesamtbetrag unter Angabe der Rechnungsnummer **${docNumber}**.`
        : ""

  const totalEur = doc.total_cents / 100
  const showGirocode =
    isInvoice && !!girocodeDataUrl && !!settings.iban && totalEur > 0

  return (
    <Document
      author={issuerFullName}
      title={`${titleText} ${docNumber}`}
      subject={`${titleText} ${docNumber} — ${clientDisplayName(client)}`}
    >
      <Page size="A4" style={styles.page}>
        {/* TITLE — centered */}
        <Text style={styles.title}>{titleText}</Text>

        {/* TWO-COLUMN ADDRESS: Empfänger LEFT, Anbieter RIGHT */}
        <View style={styles.addressRow}>
          <View style={styles.addressCol}>
            <Text style={styles.addressName}>{clientDisplayName(client)}</Text>
            {clientAddr.street ? (
              <Text style={styles.addressStreetBold}>{clientAddr.street}</Text>
            ) : null}
            {clientAddr.zip || clientAddr.city ? (
              <Text>{joinAddressLine(clientAddr.zip, clientAddr.city)}</Text>
            ) : null}
            {clientAddr.country && clientAddr.country !== "DE" ? (
              <Text>{clientAddr.country}</Text>
            ) : null}
            {client.phone ? <Text>Tel.: {client.phone}</Text> : null}
            {client.email ? <Text>E-Mail: {client.email}</Text> : null}
          </View>

          <View style={styles.addressCol}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoUrl} style={styles.logoImg} />
            ) : null}
            <Text style={styles.addressName}>{issuerFullName}</Text>
            {issuerAddr.street ? <Text>{issuerAddr.street}</Text> : null}
            {issuerAddr.zip || issuerAddr.city ? (
              <Text>{joinAddressLine(issuerAddr.zip, issuerAddr.city)}</Text>
            ) : null}
            {issuerAddr.country && issuerAddr.country !== "DE" ? (
              <Text>{issuerAddr.country}</Text>
            ) : null}
            {settings.phone ? <Text>Tel.: {settings.phone}</Text> : null}
            {settings.email_from_invoice ? (
              <Text>E-Mail: {settings.email_from_invoice}</Text>
            ) : null}
          </View>
        </View>

        {/* META: Rechnungsnummer + Rechnungsdatum */}
        <View style={styles.metaBlock}>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>
              {isInvoice ? "Rechnungsnummer:" : "Angebotsnummer:"}
            </Text>
            <Text>{docNumber}</Text>
          </View>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>
              {isInvoice ? "Rechnungsdatum:" : "Angebotsdatum:"}
            </Text>
            <Text>{formatGermanDate(doc.issue_date)}</Text>
          </View>
          {isInvoice && inv.delivery_date ? (
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Leistungsdatum:</Text>
              <Text>{formatGermanDate(inv.delivery_date)}</Text>
            </View>
          ) : null}
          {isInvoice && inv.due_date ? (
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Fällig am:</Text>
              <Text>{formatGermanDate(inv.due_date)}</Text>
            </View>
          ) : null}
          {!isInvoice && q.valid_until ? (
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Gültig bis:</Text>
              <Text>{formatGermanDate(q.valid_until)}</Text>
            </View>
          ) : null}
        </View>

        {/* Kleinunternehmer-Hinweis (single line above table).
            Locale wirkt nur auf den erklärenden Text — der §-Verweis bleibt
            in jeder Sprache erhalten. */}
        {isKleinunt ? (
          <Text style={styles.klein}>{kleinunternehmerLabel(locale)}</Text>
        ) : null}

        {/* POSITIONS TABLE */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHead} fixed>
            <Text style={[styles.colPos, styles.tableHeadCell]}>Pos.</Text>
            <Text style={[styles.colDesc, styles.tableHeadCell]}>Bezeichnung</Text>
            {!isKleinunt ? (
              <>
                <Text style={[styles.colQty, styles.tableHeadCell]}>Menge</Text>
                <Text style={[styles.colVat, styles.tableHeadCell]}>USt</Text>
              </>
            ) : null}
            <Text style={[styles.colBetrag, styles.tableHeadCell]}>
              Betrag{"\n"}
              {isKleinunt ? "(netto)" : "(brutto)"}
            </Text>
          </View>

          {/* Position rows */}
          {lines.map((l) => {
            const isFreeDescription = l.unit_price_cents === 0 && l.quantity === 1
            return (
              <View
                key={l.id}
                style={isFreeDescription ? styles.tableRowTall : styles.tableRow}
                wrap={false}
              >
                <Text style={styles.colPos}>{l.position}</Text>
                <Text style={styles.colDesc}>{l.description}</Text>
                {!isKleinunt ? (
                  <>
                    <Text style={styles.colQty}>
                      {Number(l.quantity).toLocaleString("de-DE")}
                      {l.unit ? ` ${l.unit}` : ""}
                    </Text>
                    <Text style={styles.colVat}>
                      {Number(l.vat_rate).toFixed(0)}%
                    </Text>
                  </>
                ) : null}
                <Text style={styles.colBetrag}>
                  {/* Empty Betrag for "free description" rows (0€ × 1) */}
                  {isFreeDescription ? "" : formatMoney(l.line_total_cents)}
                </Text>
              </View>
            )
          })}

          {/* Gesamtpreis row (inside table) */}
          <View style={styles.tableRowTotal}>
            <Text style={styles.colPos}> </Text>
            <Text style={[styles.colDesc, styles.bold]}>
              {isKleinunt ? "Gesamtpreis" : "Gesamtsumme"}
            </Text>
            {!isKleinunt ? (
              <>
                <Text style={styles.colQty}> </Text>
                <Text style={styles.colVat}> </Text>
              </>
            ) : null}
            <Text style={[styles.colBetrag, styles.bold]}>
              {formatMoney(doc.total_cents)}
            </Text>
          </View>
        </View>

        {/* USt-Aufschlüsselung — nur wenn NICHT Kleinunternehmer */}
        {!isKleinunt && breakdown.length > 0 ? (
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text>Nettosumme</Text>
              <Text>{formatMoney(doc.subtotal_cents)}</Text>
            </View>
            {breakdown.map((b) => (
              <View key={b.rate} style={styles.totalsRow}>
                <Text>USt {b.rate}%</Text>
                <Text>{formatMoney(b.vatCents)}</Text>
              </View>
            ))}
            <View style={styles.totalsRowGrand}>
              <Text style={styles.bold}>Gesamtbetrag (brutto)</Text>
              <Text style={styles.bold}>{formatMoney(doc.total_cents)}</Text>
            </View>
          </View>
        ) : null}

        {/* Reverse-Charge / weitere Hinweise */}
        {notices.length > 0 ? (
          <View style={styles.noticeBox}>
            {notices.map((n, i) => (
              <Text key={i}>{n}</Text>
            ))}
          </View>
        ) : null}

        {/* ZAHLUNGSBEDINGUNGEN (invoice only) — wrap=false: hält Heading
            + Text auf einer Seite, kein Orphan beim Page-Break. */}
        {isInvoice && paymentTermsText ? (
          <View wrap={false}>
            <Text style={styles.sectionHeading}>Zahlungsbedingungen:</Text>
            <View style={styles.sectionBody}>
              {paymentTermsText.split("\n").map((line, i) => (
                <MarkedText key={i} style={styles.paragraph}>
                  {line}
                </MarkedText>
              ))}
            </View>
          </View>
        ) : null}

        {/* BANKVERBINDUNG + GIROCODE (invoice only, side-by-side, wrap=false) */}
        {isInvoice && settings.iban ? (
          <View style={styles.girocodeBlock} wrap={false}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeading}>Bankverbindung</Text>
              <View style={styles.sectionBody}>
                <Text>Kontoinhaber: {issuerFullName}</Text>
                {settings.bank_name ? (
                  <Text>Bank: {settings.bank_name}</Text>
                ) : null}
                <Text>IBAN: {settings.iban}</Text>
                {settings.bic ? <Text>BIC: {settings.bic}</Text> : null}
                {settings.tax_id ? (
                  <Text>Steuernummer: {settings.tax_id}</Text>
                ) : null}
                {settings.ust_id ? (
                  <Text>USt-IdNr.: {settings.ust_id}</Text>
                ) : null}
              </View>
            </View>
            {showGirocode ? (
              <View>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={girocodeDataUrl!} style={styles.girocodeImg} />
                <Text style={styles.girocodeCaption}>
                  Scan-to-Pay (SEPA-Girocode)
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ANGEBOT only — no Bankverbindung */}
        {!isInvoice && doc.notes ? (
          <>
            <Text style={styles.sectionHeading}>Anmerkungen</Text>
            <Text style={styles.sectionBody}>{doc.notes}</Text>
          </>
        ) : null}

        {/* BRANDING FOOTER — signature (links) + stamp (rechts).
            Wird nur gerendert, wenn entsprechendes URL gesetzt UND Toggle
            am Dokument aktiv ist. Eines von beiden reicht für Render. */}
        {(signatureDataUrl && showSignature) ||
        (stampDataUrl && showStamp) ? (
          <View style={styles.brandingFooter} wrap={false}>
            <View style={styles.signatureBlock}>
              {signatureDataUrl && showSignature ? (
                <>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={signatureDataUrl} style={styles.signatureImg} />
                  <Text style={styles.signatureCaption}>
                    {issuerFullName} · {formatGermanDate(doc.issue_date)}
                  </Text>
                </>
              ) : null}
            </View>
            <View style={styles.stampBlock}>
              {stampDataUrl && showStamp ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={stampDataUrl} style={styles.stampImg} />
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Page footer with pagination — fixed (visible on every page) */}
        <Text
          style={styles.pageFooter}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1
              ? `${issuerFullName} · ${titleText} ${docNumber} · Seite ${pageNumber} von ${totalPages}`
              : `${issuerFullName} · ${titleText} ${docNumber}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
