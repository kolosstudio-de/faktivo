/**
 * Mahnung-Versand via Resend (oder Dry-Run im Dev ohne API-Key).
 *
 * Spiegelt die Architektur von `send-invoice.ts`, weicht aber in folgenden
 * Punkten ab:
 *
 *  - **Betreff & Body** sind Stufen-spezifisch (Zahlungserinnerung / 1. Mahnung /
 *    Letzte Mahnung); per Stufe gibt es eigene Default-Texte mit §286 / §288
 *    BGB-konformer Verzugszins-Formulierung.
 *  - **Verzugspauschale** (€40 §288 V BGB) erscheint nur, wenn die Forderung
 *    gegen einen Unternehmer (B2B) gerichtet ist.
 *  - **Anhang** ist das Mahnung-PDF, nicht die Original-Rechnung.
 *  - **Audit-Trail**: Erfolgreicher Versand setzt `sent_at` + `status='sent'`
 *    in `mahnungen` und legt ein `audit_log`-Event `send_mahnung` an.
 *
 * Stand 2026-06-03 — schließt die im Regression-Test gefundene Lücke
 * (`broken #4`: Mahnung-Dialog konnte PDF erzeugen, aber nicht senden).
 */

import { Resend } from "resend"
import { renderToStream } from "@react-pdf/renderer"

import { createClient } from "@/lib/supabase/server"
import { MahnungPdf } from "@/lib/pdf/mahnung-pdf"
import { formatMoney } from "@/lib/money"
import type {
  Client,
  Invoice,
  Mahnung,
  MahnungStufe,
  Settings,
} from "@/types/database.types"

export interface SendMahnungOptions {
  customMessage?: string
  bcc?: string
}

export interface SendMahnungResult {
  ok: boolean
  provider: "resend" | "dry-run"
  id?: string
  previewText?: string
  error?: string
}

async function renderPdfBuffer(
  mahnung: Mahnung,
  invoice: Invoice,
  client: Client,
  settings: Settings,
): Promise<Buffer> {
  const stream = await renderToStream(
    MahnungPdf({ mahnung, invoice, client, settings }),
  )
  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/** Hülle für Stufen-spezifischen Default-Text. Anrede + Schluss generisch. */
function defaultBodyDe({
  stufe,
  greeting,
  invoiceNumber,
  outstandingFormatted,
  totalFormatted,
  dueDate,
  iban,
  senderName,
  website,
  isB2b,
  hasVerzugspauschale,
  feeFormatted,
  zinsenFormatted,
  pauschaleFormatted,
}: {
  stufe: MahnungStufe
  greeting: string
  invoiceNumber: string
  outstandingFormatted: string
  totalFormatted: string
  dueDate: string
  iban: string
  senderName: string
  website: string
  isB2b: boolean
  hasVerzugspauschale: boolean
  feeFormatted: string
  zinsenFormatted: string
  pauschaleFormatted: string
}): string {
  const headerByStufe: Record<MahnungStufe, string> = {
    "1": `bei der Durchsicht unserer Unterlagen ist uns aufgefallen, dass die offene Rechnung ${invoiceNumber} über ${outstandingFormatted} bislang nicht ausgeglichen wurde. Bitte sehen Sie diese Mail als freundliche Zahlungserinnerung — eventuelle Überschneidungen mit Ihrer bereits erfolgten Zahlung bitten wir zu entschuldigen.`,
    "2": `trotz unserer Zahlungserinnerung ist die Rechnung ${invoiceNumber} weiterhin offen. Wir bitten Sie hiermit erneut um Ausgleich der Forderung in Höhe von ${outstandingFormatted}.`,
    "3": `wir haben Sie bereits zweimal an die offene Rechnung ${invoiceNumber} (${outstandingFormatted}) erinnert. Dies ist unsere letzte Mahnung vor Übergabe an ein Inkassobüro bzw. gerichtliche Geltendmachung.`,
  }

  const breakdown = [
    `Hauptforderung:           ${outstandingFormatted}`,
    `Mahngebühr (Stufe ${stufe}):    ${feeFormatted}`,
    `Verzugszinsen (§288 BGB): ${zinsenFormatted}`,
    hasVerzugspauschale
      ? `Verzugspauschale (§288 V BGB):  ${pauschaleFormatted}`
      : null,
    `─`.repeat(40),
    `Gesamt:                  ${totalFormatted}`,
  ]
    .filter(Boolean)
    .join("\n")

  const closing = isB2b
    ? `Bitte überweisen Sie den Gesamtbetrag bis spätestens ${dueDate} unter Angabe der Rechnungsnummer ${invoiceNumber} auf folgendes Konto:\n\n  IBAN: ${iban || "—"}`
    : `Bitte überweisen Sie den Gesamtbetrag bis spätestens ${dueDate} unter Angabe der Rechnungsnummer ${invoiceNumber}${iban ? `\nIBAN: ${iban}` : ""}.`

  const legalNote =
    stufe === "3"
      ? `\n\nFalls die Zahlung bis zum genannten Datum nicht bei uns eingeht, behalten wir uns vor, die Forderung ohne weitere Ankündigung gerichtlich oder über ein Inkassounternehmen einzuziehen. Die hierdurch entstehenden zusätzlichen Kosten gehen zu Ihren Lasten.`
      : ""

  return `${greeting}

${headerByStufe[stufe]}

${breakdown}

${closing}${legalNote}

Mit freundlichen Grüßen
${senderName}
${website}`.trim()
}

const SUBJECT_BY_STUFE: Record<MahnungStufe, string> = {
  "1": "Zahlungserinnerung",
  "2": "1. Mahnung",
  "3": "Letzte Mahnung",
}

/**
 * Sendet die Mahnung an die Client-Email-Adresse. Aktualisiert die Mahnung-
 * Row auf `status='sent'` + `sent_at=now()`. Idempotent ist nicht garantiert
 * — der Aufrufer (Route-Handler) sollte vor dem Senden prüfen, ob `sent_at`
 * bereits gesetzt ist, oder ein explizites "Re-Send"-Flag verlangen.
 */
export async function sendMahnungEmail(
  mahnungId: string,
  options?: SendMahnungOptions,
): Promise<SendMahnungResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, provider: "dry-run", error: "unauthorized" }

  const { data: mahnungData } = await supabase
    .from("mahnungen")
    .select("*")
    .eq("id", mahnungId)
    .single()
  if (!mahnungData) {
    return { ok: false, provider: "dry-run", error: "mahnung not found" }
  }
  const mahnung = mahnungData as Mahnung

  const [invRes, settingsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", mahnung.invoice_id).single(),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ])
  if (!invRes.data || !settingsRes.data) {
    return { ok: false, provider: "dry-run", error: "related docs missing" }
  }
  const invoice = invRes.data as Invoice
  const settings = settingsRes.data as Settings

  const { data: clientData } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single()
  if (!clientData) {
    return { ok: false, provider: "dry-run", error: "client missing" }
  }
  const client = clientData as Client
  if (!client.email) {
    return { ok: false, provider: "dry-run", error: "Kunde hat keine Email" }
  }

  const pdfBuffer = await renderPdfBuffer(mahnung, invoice, client, settings)

  // ─── Templatevariablen + Texte ────────────────────────────────────────
  const senderName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "Kolos Digital"
  const from =
    settings.email_from_invoice ||
    process.env.EMAIL_FROM ||
    `${senderName} <noreply@kolos.digital>`
  const replyTo = user.email ?? undefined
  const website = settings.website ?? ""

  const isB2b = client.type === "company"
  const clientName =
    isB2b
      ? client.company_name ?? "Damen und Herren"
      : `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim() ||
        "Damen und Herren"

  // §286/§288 BGB-Anrede: "Sehr geehrte Damen und Herren" für Firmen,
  // "Sehr geehrte/r Frau/Herr <Nachname>" für Privatpersonen mit bekanntem Namen.
  const greeting = isB2b
    ? "Sehr geehrte Damen und Herren,"
    : client.last_name?.trim()
      ? `Sehr geehrte/r Frau / Herr ${client.last_name},`
      : "Sehr geehrte Damen und Herren,"

  const outstandingFormatted = formatMoney(mahnung.base_amount_cents)
  const totalFormatted = formatMoney(mahnung.total_cents)
  const feeFormatted = formatMoney(mahnung.fee_cents)
  const zinsenFormatted = formatMoney(mahnung.verzugszinsen_cents)
  const pauschaleFormatted = formatMoney(mahnung.verzugspauschale_cents)
  const dueDate = mahnung.due_at
    ? new Date(mahnung.due_at).toLocaleDateString("de-DE")
    : "—"

  // Wenn der User ein eigenes Template hinterlegt hat, nehmen wir das mit
  // Variablensubstitution; ansonsten bauen wir den default-Text per Stufe.
  const replaceVars = (template: string): string =>
    template
      .replace(/\{\{invoice_number\}\}/g, invoice.number ?? "")
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{stufe\}\}/g, mahnung.stufe)
      .replace(/\{\{stufe_label\}\}/g, SUBJECT_BY_STUFE[mahnung.stufe])
      .replace(/\{\{outstanding\}\}/g, outstandingFormatted)
      .replace(/\{\{total\}\}/g, totalFormatted)
      .replace(/\{\{due_date\}\}/g, dueDate)
      .replace(/\{\{iban\}\}/g, settings.iban ?? "")
      .replace(/\{\{sender_name\}\}/g, senderName)

  const customBody = options?.customMessage
    ? `\n\n${options.customMessage}\n\n`
    : ""

  const plainBody = settings.email_template_mahnung_body
    ? replaceVars(settings.email_template_mahnung_body) + customBody
    : defaultBodyDe({
        stufe: mahnung.stufe,
        greeting,
        invoiceNumber: invoice.number ?? "—",
        outstandingFormatted,
        totalFormatted,
        dueDate,
        iban: settings.iban ?? "",
        senderName,
        website,
        isB2b,
        hasVerzugspauschale: mahnung.verzugspauschale_cents > 0,
        feeFormatted,
        zinsenFormatted,
        pauschaleFormatted,
      }) + customBody

  const htmlBody = plainBody
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.6"><p>${htmlBody}</p></body></html>`

  const subject = settings.email_template_mahnung_subject
    ? replaceVars(settings.email_template_mahnung_subject)
    : `${SUBJECT_BY_STUFE[mahnung.stufe]} zur Rechnung ${invoice.number} · ${senderName}`
  const filename = `Mahnung-Stufe-${mahnung.stufe}-${invoice.number ?? "Entwurf"}.pdf`

  // Hilfsfunktion: nach Erfolg DB-Status + Audit aktualisieren
  const markSent = async () => {
    await supabase
      .from("mahnungen")
      .update({ sent_at: new Date().toISOString(), status: "sent" })
      .eq("id", mahnungId)
    await supabase.from("audit_log").insert({
      user_id: user.id,
      actor: user.id,
      action: "send_mahnung",
      entity: "mahnung",
      entity_id: mahnungId,
      diff: {
        provider_used: process.env.RESEND_API_KEY ? "resend" : "dry-run",
        to: client.email,
        subject,
      },
    })
  }

  // Fall back to dry-run if no Resend key (lokales Dev ohne ausgehende Mails)
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log("[send-mahnung-email DRY RUN]", {
      to: client.email,
      from,
      subject,
      preview: plainBody.slice(0, 200),
      pdfSize: pdfBuffer.length,
    })
    await markSent()
    return {
      ok: true,
      provider: "dry-run",
      previewText: plainBody.slice(0, 500),
    }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from,
      to: client.email,
      replyTo,
      bcc: options?.bcc,
      subject,
      html,
      text: plainBody,
      attachments: [{ filename, content: pdfBuffer }],
    })
    if (result.error) {
      return { ok: false, provider: "resend", error: result.error.message }
    }
    await markSent()
    return { ok: true, provider: "resend", id: result.data?.id }
  } catch (e) {
    return {
      ok: false,
      provider: "resend",
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
