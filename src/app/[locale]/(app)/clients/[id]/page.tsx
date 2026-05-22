import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import {
  ArrowLeft,
  Building2,
  Download,
  FileText,
  Mail,
  Phone,
  Plus,
  Receipt,
  User as UserIcon,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import type {
  Client,
  Invoice,
  InvoiceStatus,
  Quote,
  QuoteStatus,
} from "@/types/database.types"
import { formatMoney } from "@/lib/money"
import { clientDisplayName, addressLine } from "@/lib/utils/client-display"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InvoiceStatusBadge,
  QuoteStatusBadge,
} from "@/components/ui/status-badge"

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [clientRes, invRes, quoteRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("invoices")
      .select(
        "id, number, issue_date, due_date, status, total_cents, paid_cents, currency, is_kleinunternehmer_at_issue"
      )
      .eq("client_id", id)
      .order("issue_date", { ascending: false }),
    supabase
      .from("quotes")
      .select("id, number, issue_date, valid_until, status, total_cents, currency")
      .eq("client_id", id)
      .order("issue_date", { ascending: false }),
  ])

  if (!clientRes.data) notFound()
  const client = clientRes.data as Client
  const invoices = (invRes.data ?? []) as Invoice[]
  const quotes = (quoteRes.data ?? []) as Quote[]

  // Aggregate stats
  const totalRevenue = invoices
    .filter((i) => i.status !== "cancelled")
    .reduce((s, i) => s + i.total_cents, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paid_cents, 0)
  const outstanding = invoices
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + (i.total_cents - i.paid_cents), 0)
  const overdueCount = invoices.filter(
    (i) =>
      i.due_date &&
      i.due_date < new Date().toISOString().slice(0, 10) &&
      i.status !== "paid" &&
      i.status !== "cancelled"
  ).length

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      {/* HEADER */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3">
          <Link href="/clients">
            <ArrowLeft /> Zurück
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              {client.type === "company" ? (
                <Building2 className="size-5 text-primary" />
              ) : (
                <UserIcon className="size-5 text-primary" />
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {clientDisplayName(client)}
              </h1>
              {client.archived_at ? (
                <Badge variant="outline">archiviert</Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Mail className="size-3" />
                  {client.email}
                </a>
              ) : null}
              {client.phone ? (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="size-3" />
                  {client.phone}
                </a>
              ) : null}
              {client.address?.street ? (
                <span>
                  {client.address.street}, {addressLine(client.address)}
                </span>
              ) : null}
              {client.ust_id ? (
                <span className="font-mono">USt-IdNr.: {client.ust_id}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/quotes/new?client=${client.id}`}>
                <Plus /> Angebot
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/invoices/new?client=${client.id}`}>
                <Plus /> Rechnung
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Umsatz gesamt" value={formatMoney(totalRevenue)} />
        <StatCard
          label="Bezahlt"
          value={formatMoney(totalPaid)}
          tone="emerald"
        />
        <StatCard
          label="Offen"
          value={formatMoney(outstanding)}
          tone={outstanding > 0 ? "amber" : "muted"}
        />
        <StatCard
          label="Überfällig"
          value={`${overdueCount}`}
          tone={overdueCount > 0 ? "rose" : "muted"}
          suffix={overdueCount === 1 ? "Rechnung" : "Rechnungen"}
        />
      </div>

      {/* EXPORT */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <a
            href={`/api/client/${client.id}/statement`}
            target="_blank"
            rel="noreferrer"
          >
            <Download />
            Kontoauszug als CSV
          </a>
        </Button>
      </div>

      {/* INVOICES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4" />
            Rechnungen
          </CardTitle>
          <CardDescription>{invoices.length} insgesamt</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Noch keine Rechnungen für diesen Kunden.
            </p>
          ) : (
            <div className="grid divide-y">
              {invoices.map((inv) => {
                const out = inv.total_cents - inv.paid_cents
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between gap-3 px-1 py-3 text-sm"
                  >
                    <div className="grid leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {inv.number ?? "Entwurf"}
                        </span>
                        <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                        {inv.is_kleinunternehmer_at_issue ? (
                          <Badge variant="outline" className="text-[10px]">
                            §19
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {inv.issue_date}
                        {inv.due_date ? ` · fällig ${inv.due_date}` : ""}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono tabular-nums">
                        {formatMoney(inv.total_cents)}
                      </div>
                      {out > 0 ? (
                        <div className="text-xs text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                          offen: {formatMoney(out)}
                        </div>
                      ) : inv.status === "paid" ? (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          bezahlt
                        </div>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QUOTES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Angebote
          </CardTitle>
          <CardDescription>{quotes.length} insgesamt</CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Noch keine Angebote.
            </p>
          ) : (
            <div className="grid divide-y">
              {quotes.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotes/${q.id}`}
                  className="hover:bg-muted/40 flex items-center justify-between gap-3 px-1 py-3 text-sm"
                >
                  <div className="grid leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {q.number ?? "Entwurf"}
                      </span>
                      <QuoteStatusBadge status={q.status as QuoteStatus} />
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {q.issue_date}
                      {q.valid_until ? ` · gültig bis ${q.valid_until}` : ""}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums">
                    {formatMoney(q.total_cents)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {client.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Interne Notiz</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {client.notes}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = "primary",
  suffix,
}: {
  label: string
  value: string
  tone?: "primary" | "emerald" | "amber" | "rose" | "muted"
  suffix?: string
}) {
  const toneClass = {
    primary: "text-foreground",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    muted: "text-muted-foreground",
  }[tone]
  return (
    <div className="bg-card grid gap-1 rounded-2xl border p-5">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </span>
      <div className={`font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {suffix ? (
        <span className="text-muted-foreground text-xs">{suffix}</span>
      ) : null}
    </div>
  )
}
