import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import type {
  Client,
  LineItem,
  Quote,
  QuoteStatus,
  Settings,
} from "@/types/database.types"
import { formatMoney } from "@/lib/money"
import { clientDisplayName, addressLine } from "@/lib/utils/client-display"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { QuoteStatusBadge } from "@/components/ui/status-badge"
import { DocumentForm } from "@/components/forms/document-form"
import { QuoteActions } from "@/components/forms/quote-actions"

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Quotes" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [settingsRes, quoteRes, linesRes] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user!.id).single(),
    supabase.from("quotes").select("*").eq("id", id).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("parent_id", id)
      .eq("parent_kind", "quote")
      .order("position"),
  ])

  if (!quoteRes.data || !settingsRes.data) notFound()
  const quote = quoteRes.data as Quote
  const settings = settingsRes.data as Settings
  const lines = (linesRes.data ?? []) as LineItem[]

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", quote.client_id)
    .single()

  const isDraft = quote.status === "draft"

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3">
          <Link href="/quotes">
            <ArrowLeft /> {t("backLabel")}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl font-semibold">
                {quote.number ?? t("draftFallback")}
              </h1>
              <QuoteStatusBadge status={quote.status as QuoteStatus} />
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {quote.issue_date} · {clientDisplayName(client as Client)}
            </p>
          </div>
          <QuoteActions
            quote={quote}
            lines={lines}
            isKleinunternehmer={settings.is_kleinunternehmer}
          />
        </div>
      </div>

      {isDraft ? (
        <DocumentForm
          kind="quote"
          settings={settings}
          existing={{ doc: quote, lines }}
        />
      ) : quote.is_imported && quote.pdf_url ? (
        <ImportedQuotePdfViewer
          quote={quote}
          client={client as Client}
          labels={{
            customer: t("importedCustomer"),
            date: t("importedDate"),
            total: t("importedTotal"),
          }}
        />
      ) : (
        <ReadOnlyPreview
          quote={quote}
          client={client as Client}
          lines={lines}
          isKleinunternehmer={settings.is_kleinunternehmer}
          labels={{
            customer: t("detailCustomer"),
            tableDescription: t("tableDescription"),
            tableQuantity: t("tableQuantity"),
            tableUnitPrice: t("tableUnitPrice"),
            tableVat: t("tableVat"),
            tableTotal: t("tableTotal"),
            tableNetSum: t("tableNetSum"),
            tableVatTotal: t("tableVatTotal"),
            tableGrandTotal: t("tableGrandTotal"),
            noteLabel: t("noteLabel"),
          }}
        />
      )}
    </div>
  )
}

interface ImportedQuoteLabels {
  customer: string
  date: string
  total: string
}

function ImportedQuotePdfViewer({
  quote,
  client,
  labels,
}: {
  quote: Quote
  client: Client
  labels: ImportedQuoteLabels
}) {
  return (
    <div className="bg-card grid gap-4 rounded-2xl border p-4">
      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
        <div>
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.customer}
          </span>
          <div className="font-medium">{clientDisplayName(client)}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.date}
          </span>
          <div className="font-mono">{quote.issue_date}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.total}
          </span>
          <div className="font-mono text-base font-semibold">
            {formatMoney(quote.total_cents)}
          </div>
        </div>
      </div>
      <iframe
        src={`/api/pdf/quote/${quote.id}#view=FitH`}
        title={`PDF ${quote.number ?? ""}`}
        className="h-[80vh] w-full rounded-xl border bg-white"
      />
    </div>
  )
}

interface ReadOnlyLabels {
  customer: string
  tableDescription: string
  tableQuantity: string
  tableUnitPrice: string
  tableVat: string
  tableTotal: string
  tableNetSum: string
  tableVatTotal: string
  tableGrandTotal: string
  noteLabel: string
}

function ReadOnlyPreview({
  quote,
  client,
  lines,
  isKleinunternehmer,
  labels,
}: {
  quote: Quote
  client: Client
  lines: LineItem[]
  isKleinunternehmer: boolean
  labels: ReadOnlyLabels
}) {
  return (
    <div className="bg-card grid gap-6 rounded-2xl border p-8">
      <div className="grid gap-1">
        <span className="text-muted-foreground text-xs tracking-wide uppercase">
          {labels.customer}
        </span>
        <div className="text-sm">
          <div className="font-medium">{clientDisplayName(client)}</div>
          {client?.address ? (
            <div className="text-muted-foreground">
              {client.address.street}
              {client.address.street ? ", " : ""}
              {addressLine(client.address)}
            </div>
          ) : null}
        </div>
      </div>

      <Separator />

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">{labels.tableDescription}</th>
              <th className="px-3 py-2 text-right font-medium">{labels.tableQuantity}</th>
              <th className="px-3 py-2 text-right font-medium">{labels.tableUnitPrice}</th>
              {!isKleinunternehmer ? (
                <th className="px-3 py-2 text-right font-medium">{labels.tableVat}</th>
              ) : null}
              <th className="px-3 py-2 text-right font-medium">{labels.tableTotal}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{l.position}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(l.quantity).toLocaleString("de-DE")} {l.unit}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatMoney(l.unit_price_cents)}
                </td>
                {!isKleinunternehmer ? (
                  <td className="px-3 py-2 text-right">{Number(l.vat_rate)}%</td>
                ) : null}
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatMoney(l.line_total_cents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 border-t">
              <td className="px-3 py-2" colSpan={isKleinunternehmer ? 4 : 5}>
                {labels.tableNetSum}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatMoney(quote.subtotal_cents)}
              </td>
            </tr>
            {!isKleinunternehmer ? (
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground" colSpan={5}>
                  {labels.tableVatTotal}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatMoney(quote.vat_cents)}
                </td>
              </tr>
            ) : null}
            <tr className="border-t text-base font-semibold">
              <td className="px-3 py-2" colSpan={isKleinunternehmer ? 4 : 5}>
                {labels.tableGrandTotal}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatMoney(quote.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {quote.notes ? (
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.noteLabel}
          </span>
          <p className="whitespace-pre-wrap">{quote.notes}</p>
        </div>
      ) : null}
    </div>
  )
}
