import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowLeft, Info, Lock, Shield } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import type {
  Client,
  Invoice,
  InvoiceStatus,
  LineItem,
  Settings,
} from "@/types/database.types"
import { formatMoney } from "@/lib/money"
import { clientDisplayName, addressLine } from "@/lib/utils/client-display"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InvoiceStatusBadge } from "@/components/ui/status-badge"
import { DocumentForm } from "@/components/forms/document-form"
import { InvoiceActions } from "@/components/forms/invoice-actions"
import { PaymentsList } from "@/components/tables/payments-list"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Invoices" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [settingsRes, invRes, linesRes] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user!.id).single(),
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("parent_id", id)
      .eq("parent_kind", "invoice")
      .order("position"),
  ])

  if (!invRes.data || !settingsRes.data) notFound()
  const invoice = invRes.data as Invoice
  const settings = settingsRes.data as Settings
  const lines = (linesRes.data ?? []) as LineItem[]

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single()

  const isDraft = invoice.status === "draft"
  const isLocked = Boolean(invoice.locked_at)
  const outstanding = invoice.total_cents - invoice.paid_cents

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3">
          <Link href="/invoices">
            <ArrowLeft /> {t("backLabel")}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold">
                {invoice.number ?? t("draftFallback")}
              </h1>
              <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
              {isLocked ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Lock className="size-3" />
                  {t("gobdBadge")}
                </Badge>
              ) : null}
              {invoice.is_kleinunternehmer_at_issue ? (
                <Badge variant="outline">§19</Badge>
              ) : null}
              {invoice.reverse_charge ? (
                <Badge variant="outline">§13b</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm">
              {invoice.issue_date} · {clientDisplayName(client as Client)}
            </p>
          </div>
          <InvoiceActions
            invoice={invoice}
            clientEmail={(client as Client | null)?.email ?? null}
          />
        </div>
      </div>

      {isDraft ? (
        <>
          <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">{t("draftBannerTitle")}</p>
              <p>
                {t("draftBannerHint")}
              </p>
            </div>
          </div>
          <DocumentForm
            kind="invoice"
            settings={settings}
            existing={{ doc: invoice, lines }}
          />
        </>
      ) : (
        <>
          {invoice.is_imported && invoice.pdf_url ? (
            <ImportedPdfViewer
              invoice={invoice}
              client={client as Client}
              labels={{
                customer: t("importedCustomer"),
                date: t("importedDate"),
                netVat: t("importedNetVat"),
                total: t("importedTotal"),
              }}
            />
          ) : (
            <LockedPreview
              invoice={invoice}
              client={client as Client}
              lines={lines}
              labels={{
                recipient: t("detailRecipient"),
                ustId: t("detailUstId"),
                invoiceDate: t("detailInvoiceDate"),
                serviceDate: t("detailServiceDate"),
                due: t("detailDue"),
                tableDescription: t("tableDescription"),
                tableQuantity: t("tableQuantity"),
                tableUnitPrice: t("tableUnitPrice"),
                tableVat: t("tableVat"),
                tableTotal: t("tableTotal"),
                tableNetSum: t("tableNetSum"),
                tableVatTotal: t("tableVatTotal"),
                tableGrandTotal: t("tableGrandTotal"),
                kleinunternehmer: t("kleinunternehmerNote"),
                reverseCharge: t("reverseChargeNote"),
                noteLabel: t("noteLabel"),
              }}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t("recordPayment")}</span>
                <div className="font-mono text-sm">
                  <span className="text-muted-foreground mr-2">{t("outstanding")}:</span>
                  <span
                    className={
                      outstanding > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {formatMoney(outstanding)}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentsList invoiceId={invoice.id} />
            </CardContent>
          </Card>

          {isLocked ? (
            <div className="text-muted-foreground flex items-start gap-2 rounded-xl border bg-muted/20 p-3 text-xs">
              <Shield className="mt-0.5 size-4 shrink-0" />
              <p>
                {t("lockedNote")}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

interface ImportedLabels {
  customer: string
  date: string
  netVat: string
  total: string
}

function ImportedPdfViewer({
  invoice,
  client,
  labels,
}: {
  invoice: Invoice
  client: Client
  labels: ImportedLabels
}) {
  return (
    <div className="bg-card grid gap-4 rounded-2xl border p-4">
      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
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
          <div className="font-mono">{invoice.issue_date}</div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.netVat}
          </span>
          <div className="font-mono">
            {formatMoney(invoice.subtotal_cents)} ·{" "}
            {formatMoney(invoice.vat_cents)}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.total}
          </span>
          <div className="font-mono text-base font-semibold">
            {formatMoney(invoice.total_cents)}
          </div>
        </div>
      </div>
      <iframe
        src={`/api/pdf/invoice/${invoice.id}#view=FitH`}
        title={`PDF ${invoice.number ?? ""}`}
        className="h-[80vh] w-full rounded-xl border bg-white"
      />
    </div>
  )
}

interface LockedLabels {
  recipient: string
  ustId: string
  invoiceDate: string
  serviceDate: string
  due: string
  tableDescription: string
  tableQuantity: string
  tableUnitPrice: string
  tableVat: string
  tableTotal: string
  tableNetSum: string
  tableVatTotal: string
  tableGrandTotal: string
  kleinunternehmer: string
  reverseCharge: string
  noteLabel: string
}

function LockedPreview({
  invoice,
  client,
  lines,
  labels,
}: {
  invoice: Invoice
  client: Client
  lines: LineItem[]
  labels: LockedLabels
}) {
  const isKleinunt = invoice.is_kleinunternehmer_at_issue

  return (
    <div className="bg-card grid gap-6 rounded-2xl border p-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.recipient}
          </span>
          <div className="mt-1 text-sm">
            <div className="font-medium">{clientDisplayName(client)}</div>
            {client.address?.street ? (
              <div className="text-muted-foreground">{client.address.street}</div>
            ) : null}
            <div className="text-muted-foreground">
              {addressLine(client.address)}
            </div>
            {client.ust_id ? (
              <div className="text-muted-foreground">{labels.ustId} {client.ust_id}</div>
            ) : null}
          </div>
        </div>
        <div className="md:text-right">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{labels.invoiceDate}</dt>
            <dd className="font-mono">{invoice.issue_date}</dd>
            {invoice.delivery_date ? (
              <>
                <dt className="text-muted-foreground">{labels.serviceDate}</dt>
                <dd className="font-mono">{invoice.delivery_date}</dd>
              </>
            ) : null}
            {invoice.due_date ? (
              <>
                <dt className="text-muted-foreground">{labels.due}</dt>
                <dd className="font-mono">{invoice.due_date}</dd>
              </>
            ) : null}
          </dl>
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
              {!isKleinunt ? (
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
                {!isKleinunt ? (
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
              <td className="px-3 py-2" colSpan={isKleinunt ? 4 : 5}>
                {labels.tableNetSum}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatMoney(invoice.subtotal_cents)}
              </td>
            </tr>
            {!isKleinunt ? (
              <tr className="border-t">
                <td className="px-3 py-2 text-muted-foreground" colSpan={5}>
                  {labels.tableVatTotal}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatMoney(invoice.vat_cents)}
                </td>
              </tr>
            ) : null}
            <tr className="border-t text-base font-semibold">
              <td className="px-3 py-2" colSpan={isKleinunt ? 4 : 5}>
                {labels.tableGrandTotal}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatMoney(invoice.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.notes ? (
        <div className="text-sm">
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            {labels.noteLabel}
          </span>
          <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      ) : null}

      {isKleinunt ? (
        <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-500/20 p-3 text-xs">
          {labels.kleinunternehmer}
        </div>
      ) : null}
      {invoice.reverse_charge ? (
        <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-xl border border-blue-500/20 p-3 text-xs">
          {labels.reverseCharge}
        </div>
      ) : null}
    </div>
  )
}
