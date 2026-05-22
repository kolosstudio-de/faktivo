#!/usr/bin/env node
/**
 * Standalone PDF-Render-Test — schreibt /tmp/faktivo-test.pdf damit man
 * visuell prüfen kann, ob das neue Layout der Referenz entspricht.
 *
 * Run: node scripts/test-pdf-render.mjs
 *
 * Bypasst Supabase / Auth — verwendet hardcoded Sample-Daten, die der
 * Referenz-Rechnung RE-2026-006 entsprechen.
 */
import { renderToStream, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import React from "react"
import fs from "node:fs"
import QRCode from "qrcode"

// ───────────────────────────────────────────────────────────────────────
// Inline-Kopie von src/lib/pdf/document-pdf.tsx (um Path-Aliase zu umgehen)
// ───────────────────────────────────────────────────────────────────────

const BORDER = "#1a1a1a"
const TEXT = "#000000"
const MUTED = "#333333"

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 64, fontSize: 10.5, fontFamily: "Times-Roman", color: TEXT, lineHeight: 1.35 },
  title: { fontSize: 18, fontFamily: "Times-Bold", textAlign: "center", letterSpacing: 1, marginBottom: 60 },
  addressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 36 },
  addressCol: { width: "48%" },
  addressName: { fontFamily: "Times-Bold", marginBottom: 1 },
  addressStreetBold: { fontFamily: "Times-Bold", marginBottom: 1 },
  metaBlock: { marginBottom: 14 },
  metaLine: { flexDirection: "row" },
  metaLabel: { fontFamily: "Times-Bold", width: 110 },
  klein: { marginBottom: 18, marginTop: 2 },
  table: { borderWidth: 0.7, borderColor: BORDER, marginTop: 4 },
  tableHead: { flexDirection: "row", borderBottomWidth: 0.7, borderColor: BORDER, paddingVertical: 6, minHeight: 22 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: BORDER, paddingVertical: 8, minHeight: 28, alignItems: "flex-start" },
  tableRowTall: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: BORDER, paddingVertical: 8, minHeight: 60, alignItems: "flex-start" },
  tableRowTotal: { flexDirection: "row", paddingVertical: 10, minHeight: 30, alignItems: "center" },
  colPos: { width: 44, paddingHorizontal: 8, borderRightWidth: 0.5, borderColor: BORDER, textAlign: "left" },
  colDesc: { flex: 1, paddingHorizontal: 10, borderRightWidth: 0.5, borderColor: BORDER },
  colQty: { width: 64, paddingHorizontal: 6, borderRightWidth: 0.5, borderColor: BORDER, textAlign: "right" },
  colVat: { width: 38, paddingHorizontal: 4, borderRightWidth: 0.5, borderColor: BORDER, textAlign: "right" },
  colBetrag: { width: 86, paddingHorizontal: 8, textAlign: "right" },
  bold: { fontFamily: "Times-Bold" },
  sectionHeading: { fontFamily: "Times-Bold", marginTop: 18, marginBottom: 4 },
  sectionBody: { lineHeight: 1.45 },
  paragraph: { marginBottom: 2 },
  girocodeBlock: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 18 },
  girocodeImg: { width: 110, height: 110 },
  girocodeCaption: { fontSize: 8, color: MUTED, width: 110, textAlign: "center", marginTop: 4 },
  pageFooter: { position: "absolute", bottom: 24, left: 64, right: 64, fontSize: 8, color: MUTED, textAlign: "center" },
})

function MarkedText({ children, style }) {
  const parts = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, match, key = 0
  while ((match = re.exec(children)) !== null) {
    if (match.index > last) parts.push(React.createElement(Text, { key: key++ }, children.slice(last, match.index)))
    parts.push(React.createElement(Text, { key: key++, style: styles.bold }, match[1]))
    last = re.lastIndex
  }
  if (last < children.length) parts.push(React.createElement(Text, { key: key++ }, children.slice(last)))
  return React.createElement(Text, { style }, parts)
}

function fmtMoney(cents) {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function germanDate(iso) {
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

// ─── Sample data matching reference RE-2026-006 ─────────────────────────

const settings = {
  first_name: "Vasyl", last_name: "Kolos",
  company_name: "Faktivo",
  address: { street: "Rückäckerweg 4", zip: "93055", city: "Regensburg", country: "DE" },
  phone: "+491753797913",
  email_from_invoice: "info@keepitvideo.de",
  is_kleinunternehmer: true,
  iban: "DE22 1001 1001 2078 5839 00",
  bic: "NTSBDEB1XXX",
  bank_name: "N26",
  tax_id: "244/238/91587",
  ust_id: null,
}

const client = {
  type: "person",
  first_name: "Oleksandr", last_name: "Halushka",
  company_name: null,
  address: { street: "Bahnhofstraße 11", zip: "93164", city: "Laaber", country: "DE" },
  phone: "+4916093409671",
  email: null,
}

const inv = {
  number: "RE-2026-006",
  issue_date: "2026-03-26",
  delivery_date: null, due_date: null,
  total_cents: 50000, subtotal_cents: 50000,
  is_kleinunternehmer_at_issue: true,
  reverse_charge: false,
  payment_terms: null,
  notes: null,
}

const lines = [
  { id: "1", position: 1, description: "Etappe 2 – Umsetzung der Bereiche & Formular", quantity: 1, unit: "", unit_price_cents: 50000, vat_rate: 0, line_total_cents: 50000 },
  { id: "2", position: 2, description: "Vollständige DE-Version (Beta), Galerien, Formular-Funktionalität.", quantity: 1, unit: "", unit_price_cents: 0, vat_rate: 0, line_total_cents: 0 },
]

// ─── Build EPC payload + QR ──────────────────────────────────────────────

const epcPayload = [
  "BCD", "002", "1", "SCT",
  "NTSBDEB1XXX",
  "Vasyl Kolos",
  "DE22100110012078583900",
  "EUR500.00",
  "", "",
  "RE-2026-006",
  "",
].join("\n")

const giroDataUrl = await QRCode.toDataURL(epcPayload, {
  errorCorrectionLevel: "M", margin: 0, width: 220,
  color: { dark: "#000000", light: "#ffffff" },
})

// ─── Build PDF (matches DocumentPdf component) ──────────────────────────

const isKleinunt = true
const titleText = "RECHNUNG"
const issuerFullName = "Vasyl Kolos"
const docNumber = inv.number
const clientName = `${client.first_name} ${client.last_name}`
const paymentTermsText = `Der Rechnungsbetrag ist innerhalb von 14 Tagen nach Rechnungsdatum ohne Abzug fällig. Bitte überweisen Sie den Gesamtbetrag unter Angabe der Rechnungsnummer **${docNumber}**.`

const pdf = React.createElement(Document, { author: issuerFullName, title: `${titleText} ${docNumber}` },
  React.createElement(Page, { size: "A4", style: styles.page },
    // Title
    React.createElement(Text, { style: styles.title }, titleText),
    // Address row
    React.createElement(View, { style: styles.addressRow },
      React.createElement(View, { style: styles.addressCol },
        React.createElement(Text, { style: styles.addressName }, clientName),
        React.createElement(Text, { style: styles.addressStreetBold }, client.address.street),
        React.createElement(Text, null, `${client.address.zip} ${client.address.city}`),
        React.createElement(Text, null, `Tel.: ${client.phone}`),
      ),
      React.createElement(View, { style: styles.addressCol },
        React.createElement(Text, { style: styles.addressName }, issuerFullName),
        React.createElement(Text, null, settings.address.street),
        React.createElement(Text, null, `${settings.address.zip} ${settings.address.city}`),
        React.createElement(Text, null, `Tel.: ${settings.phone}`),
        React.createElement(Text, null, `E-Mail: ${settings.email_from_invoice}`),
      ),
    ),
    // Meta
    React.createElement(View, { style: styles.metaBlock },
      React.createElement(View, { style: styles.metaLine },
        React.createElement(Text, { style: styles.metaLabel }, "Rechnungsnummer:"),
        React.createElement(Text, null, docNumber),
      ),
      React.createElement(View, { style: styles.metaLine },
        React.createElement(Text, { style: styles.metaLabel }, "Rechnungsdatum:"),
        React.createElement(Text, null, germanDate(inv.issue_date)),
      ),
    ),
    React.createElement(Text, { style: styles.klein }, "Kleinunternehmer gem. § 19 UStG"),
    // Table
    React.createElement(View, { style: styles.table },
      React.createElement(View, { style: styles.tableHead, fixed: true },
        React.createElement(Text, { style: styles.colPos }, "Pos."),
        React.createElement(Text, { style: styles.colDesc }, "Bezeichnung"),
        React.createElement(Text, { style: styles.colBetrag }, "Betrag\n(netto)"),
      ),
      ...lines.map((l) => {
        const isFreeDescription = l.unit_price_cents === 0 && l.quantity === 1
        return React.createElement(View, { key: l.id, style: isFreeDescription ? styles.tableRowTall : styles.tableRow, wrap: false },
          React.createElement(Text, { style: styles.colPos }, String(l.position)),
          React.createElement(Text, { style: styles.colDesc }, l.description),
          React.createElement(Text, { style: styles.colBetrag }, isFreeDescription ? "" : fmtMoney(l.line_total_cents)),
        )
      }),
      React.createElement(View, { style: styles.tableRowTotal },
        React.createElement(Text, { style: styles.colPos }, " "),
        React.createElement(Text, { style: [styles.colDesc, styles.bold] }, "Gesamtpreis"),
        React.createElement(Text, { style: [styles.colBetrag, styles.bold] }, fmtMoney(inv.total_cents)),
      ),
    ),
    // Zahlungsbedingungen
    React.createElement(Text, { style: styles.sectionHeading }, "Zahlungsbedingungen:"),
    React.createElement(View, { style: styles.sectionBody },
      React.createElement(MarkedText, { style: styles.paragraph }, paymentTermsText),
    ),
    // Bank + Girocode
    React.createElement(View, { style: styles.girocodeBlock },
      React.createElement(View, { style: { flex: 1 } },
        React.createElement(Text, { style: styles.sectionHeading }, "Bankverbindung"),
        React.createElement(View, { style: styles.sectionBody },
          React.createElement(Text, null, `Kontoinhaber: ${issuerFullName}`),
          React.createElement(Text, null, `Bank: ${settings.bank_name}`),
          React.createElement(Text, null, `IBAN: ${settings.iban}`),
          React.createElement(Text, null, `BIC: ${settings.bic}`),
          React.createElement(Text, null, `Steuernummer: ${settings.tax_id}`),
        ),
      ),
      React.createElement(View, null,
        React.createElement(Image, { src: giroDataUrl, style: styles.girocodeImg }),
        React.createElement(Text, { style: styles.girocodeCaption }, "Scan-to-Pay (SEPA-Girocode)"),
      ),
    ),
    React.createElement(Text, { style: styles.pageFooter, fixed: true, render: ({ pageNumber, totalPages }) => totalPages > 1 ? `${issuerFullName} · ${titleText} ${docNumber} · Seite ${pageNumber} von ${totalPages}` : `${issuerFullName} · ${titleText} ${docNumber}` }),
  )
)

const stream = await renderToStream(pdf)
const chunks = []
for await (const c of stream) chunks.push(typeof c === "string" ? Buffer.from(c) : c)
const buf = Buffer.concat(chunks)
fs.writeFileSync("/tmp/faktivo-test.pdf", buf)
console.log(`✓ /tmp/faktivo-test.pdf · ${buf.length} bytes`)
