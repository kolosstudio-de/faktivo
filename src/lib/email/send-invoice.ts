import { Resend } from "resend"

import { createClient } from "@/lib/supabase/server"
import { renderToStream } from "@react-pdf/renderer"
import { DocumentPdf } from "@/lib/pdf/document-pdf"
import { formatMoney } from "@/lib/money"
import type {
  Client,
  Invoice,
  LineItem,
  Settings,
} from "@/types/database.types"

async function renderPdfBuffer(
  invoice: Invoice,
  lines: LineItem[],
  client: Client,
  settings: Settings
): Promise<Buffer> {
  const stream = await renderToStream(
    DocumentPdf({
      kind: "invoice",
      doc: invoice,
      lines,
      client,
      settings,
    })
  )
  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

export interface SendInvoiceResult {
  ok: boolean
  provider: "resend" | "mailpit-local" | "dry-run"
  id?: string
  previewText?: string
  error?: string
}

/**
 * Send invoice by email. Uses Resend if configured, otherwise
 * logs to console (dev) and returns dry-run success.
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  options?: { customMessage?: string; bcc?: string }
): Promise<SendInvoiceResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, provider: "dry-run", error: "unauthorized" }

  const [invRes, linesRes, settingsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("parent_id", invoiceId)
      .eq("parent_kind", "invoice")
      .order("position"),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ])

  if (!invRes.data || !settingsRes.data) {
    return { ok: false, provider: "dry-run", error: "invoice or settings missing" }
  }
  const invoice = invRes.data as Invoice
  const settings = settingsRes.data as Settings
  const lines = (linesRes.data ?? []) as LineItem[]

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single()

  if (!client) {
    return { ok: false, provider: "dry-run", error: "client missing" }
  }
  const typedClient = client as Client

  if (!typedClient.email) {
    return { ok: false, provider: "dry-run", error: "Kunde hat keine Email" }
  }

  const pdfBuffer = await renderPdfBuffer(invoice, lines, typedClient, settings)

  const senderName =
    settings.company_name?.trim() ||
    [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
    "Kolos Digital"
  const from =
    settings.email_from_invoice ||
    process.env.EMAIL_FROM ||
    `${senderName} <noreply@kolos.digital>`
  const replyTo = user.email ?? undefined

  const greeting = `Sehr geehrte${typedClient.type === "company" ? " Damen und Herren" : typedClient.last_name ? ` Frau / Herr ${typedClient.last_name}` : ""},`

  const customBody = options?.customMessage
    ? `\n\n${options.customMessage}\n\n`
    : ""

  // ─── Template-Variablen-Substitution ──────────────────────────────────
  const clientName =
    typedClient.type === "company"
      ? typedClient.company_name ?? "Damen und Herren"
      : `${typedClient.first_name ?? ""} ${typedClient.last_name ?? ""}`.trim() ||
        "Damen und Herren"

  const replaceVars = (template: string): string =>
    template
      .replace(/\{\{invoice_number\}\}/g, invoice.number ?? "")
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{amount\}\}/g, formatMoney(invoice.total_cents))
      .replace(/\{\{due_date\}\}/g, invoice.due_date ?? "—")
      .replace(/\{\{iban\}\}/g, settings.iban ?? "")
      .replace(/\{\{sender_name\}\}/g, senderName)

  // Default-Template wenn kein User-Template gesetzt
  const defaultBody = `${greeting}

anbei erhalten Sie unsere Rechnung ${invoice.number} vom ${invoice.issue_date}
über ${formatMoney(invoice.total_cents)}.
${customBody}
${
  invoice.due_date
    ? `Bitte überweisen Sie den Betrag bis spätestens ${invoice.due_date}` +
      (settings.iban ? ` auf das Konto ${settings.iban}.` : ".") +
      "\n\nVerwendungszweck: " +
      (invoice.number ?? "")
    : ""
}

Bei Rückfragen melden Sie sich gerne per Antwort auf diese E-Mail.

Mit freundlichen Grüßen
${senderName}
${settings.website ?? ""}`.trim()

  const plainBody = settings.email_template_invoice_body
    ? replaceVars(settings.email_template_invoice_body) + customBody
    : defaultBody

  const htmlBody = plainBody
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.6"><p>${htmlBody}</p></body></html>`

  const subject = settings.email_template_invoice_subject
    ? replaceVars(settings.email_template_invoice_subject)
    : `Rechnung ${invoice.number} · ${senderName}`
  const filename = `Rechnung-${invoice.number ?? "Entwurf"}.pdf`

  // Fall back to dry-run if no Resend key
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log("[send-invoice-email DRY RUN]", {
      to: typedClient.email,
      from,
      subject,
      preview: plainBody.slice(0, 200),
      pdfSize: pdfBuffer.length,
    })
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
      to: typedClient.email,
      replyTo,
      bcc: options?.bcc,
      subject,
      html,
      text: plainBody,
      attachments: [
        {
          filename,
          content: pdfBuffer,
        },
      ],
    })
    if (result.error) {
      return { ok: false, provider: "resend", error: result.error.message }
    }
    return { ok: true, provider: "resend", id: result.data?.id }
  } catch (e) {
    return {
      ok: false,
      provider: "resend",
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
