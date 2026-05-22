import { getTranslations, setRequestLocale } from "next-intl/server"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Clock,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { format, startOfMonth, startOfYear, subMonths, endOfMonth } from "date-fns"
import { de, enUS, ru, uk } from "date-fns/locale"
import type { Locale as DateFnsLocale } from "date-fns"

const DATEFNS_LOCALES: Record<string, DateFnsLocale> = {
  de,
  en: enUS,
  ru,
  uk,
}

import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import { formatMoney } from "@/lib/money"
import { clientDisplayName } from "@/lib/utils/client-display"
import type {
  Client,
  IncomeEntry,
  Invoice,
  InvoiceStatus,
  Payment,
} from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KpiCard } from "@/components/dashboards/kpi-card"
import { GettingStarted } from "@/components/dashboards/getting-started"
import { OpenInvoices } from "@/components/dashboards/open-invoices"
import { PlanBanner } from "@/components/dashboards/plan-banner"
import { CashFlowForecast } from "@/components/dashboards/cash-flow-forecast"
import { ProfileHealth } from "@/components/dashboards/profile-health"
import { RevenueChart } from "@/components/dashboards/revenue-chart"
import { InvoiceStatusBadge } from "@/components/ui/status-badge"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Dashboard" })
  const tExtra = await getTranslations({ locale, namespace: "DashboardExtra" })
  const dfLocale = DATEFNS_LOCALES[locale] ?? de

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date()
  const mtdStart = startOfMonth(now)
  const mtdEnd = endOfMonth(now)
  const ytdStart = startOfYear(now)
  const twelveMonthsAgo = subMonths(startOfMonth(now), 11)

  const [
    { data: settings },
    { data: invoices },
    { data: recentInvoices },
    { data: recentPayments },
    { data: jobcenterIncome },
    { data: allIncome },
    { data: allExpense },
  ] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user!.id).single(),
    supabase
      .from("invoices")
      .select("id, status, total_cents, paid_cents, issue_date, due_date, locked_at")
      .gte("issue_date", format(twelveMonthsAgo, "yyyy-MM-dd"))
      .not("status", "in", '("draft","cancelled")'),
    supabase
      .from("invoices")
      .select(
        "id, number, issue_date, status, total_cents, paid_cents, client:clients(type, company_name, first_name, last_name)"
      )
      .order("issue_date", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select(
        "id, paid_at, amount_cents, method, reference, invoice_id, invoice:invoices(number)"
      )
      .order("paid_at", { ascending: false })
      .limit(5),
    supabase
      .from("income_entries")
      .select("amount_cents, occurred_on, jobcenter_relevant, scope")
      .eq("scope", "business")
      .eq("jobcenter_relevant", true)
      .gte("occurred_on", format(mtdStart, "yyyy-MM-dd"))
      .lte("occurred_on", format(mtdEnd, "yyyy-MM-dd")),
    // ─── Income/expense entries (bank-imported or manual) — feed the
    //     revenue cards alongside formal invoices. Otherwise the dashboard
    //     shows 0 € for freelancers who haven't issued any invoice yet.
    supabase
      .from("income_entries")
      .select("amount_cents, occurred_on, scope")
      .gte("occurred_on", format(twelveMonthsAgo, "yyyy-MM-dd")),
    supabase
      .from("expense_entries")
      .select("amount_cents, occurred_on, scope")
      .gte("occurred_on", format(twelveMonthsAgo, "yyyy-MM-dd")),
  ])

  const allInv = (invoices ?? []) as Pick<
    Invoice,
    "status" | "total_cents" | "paid_cents" | "issue_date" | "due_date" | "locked_at"
  >[]

  // Revenue = formal invoices + income_entries (banking imports, salaries, etc.)
  // This way a freelancer who tracks income via bank imports sees real
  // numbers even before/without issuing formal invoices.
  const incomeEntries = (allIncome ?? []) as Array<{
    amount_cents: number
    occurred_on: string
    scope: "business" | "personal"
  }>
  const expenseEntries = (allExpense ?? []) as Array<{
    amount_cents: number
    occurred_on: string
    scope: "business" | "personal"
  }>

  const mtdInvoiceRevenue = allInv
    .filter((i) => i.issue_date >= format(mtdStart, "yyyy-MM-dd"))
    .reduce((s, i) => s + i.total_cents, 0)
  const ytdInvoiceRevenue = allInv
    .filter((i) => i.issue_date >= format(ytdStart, "yyyy-MM-dd"))
    .reduce((s, i) => s + i.total_cents, 0)
  // Revenue = business invoices + business income_entries. Personal income
  // (Bürgergeld, gifts, etc.) does NOT count as business revenue and is
  // tracked separately on /finances/personal/income.
  const mtdEntryIncome = incomeEntries
    .filter(
      (e) =>
        e.scope === "business" &&
        e.occurred_on >= format(mtdStart, "yyyy-MM-dd")
    )
    .reduce((s, e) => s + e.amount_cents, 0)
  const ytdEntryIncome = incomeEntries
    .filter(
      (e) =>
        e.scope === "business" &&
        e.occurred_on >= format(ytdStart, "yyyy-MM-dd")
    )
    .reduce((s, e) => s + e.amount_cents, 0)
  const mtdRevenue = mtdInvoiceRevenue + mtdEntryIncome
  const ytdRevenue = ytdInvoiceRevenue + ytdEntryIncome
  // Expenses (business only, for the dashboard "Netto" / "Ausgaben" cards).
  const mtdExpenses = expenseEntries
    .filter(
      (e) =>
        e.scope === "business" &&
        e.occurred_on >= format(mtdStart, "yyyy-MM-dd") &&
        e.occurred_on <= format(mtdEnd, "yyyy-MM-dd")
    )
    .reduce((s, e) => s + e.amount_cents, 0)
  const ytdExpenses = expenseEntries
    .filter(
      (e) =>
        e.scope === "business" &&
        e.occurred_on >= format(ytdStart, "yyyy-MM-dd")
    )
    .reduce((s, e) => s + e.amount_cents, 0)
  const mtdNet = mtdRevenue - mtdExpenses
  const ytdNet = ytdRevenue - ytdExpenses
  const openBalance = allInv
    .filter((i) => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + (i.total_cents - i.paid_cents), 0)
  const overdueCount = allInv.filter(
    (i) => i.due_date && i.due_date < format(now, "yyyy-MM-dd") && i.status !== "paid"
  ).length

  const jcInvoiceIncome = allInv
    .filter((i) => i.issue_date >= format(mtdStart, "yyyy-MM-dd"))
    .reduce((s, i) => s + i.total_cents, 0)
  const jcExtraIncome = (jobcenterIncome ?? []).reduce(
    (s, e: Pick<IncomeEntry, "amount_cents">) => s + e.amount_cents,
    0
  )
  const jobcenterMonth = jcInvoiceIncome + jcExtraIncome

  // Monthly series: 12 months ending this month
  const monthly = new Map<string, number>()
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, 11 - i)
    monthly.set(format(d, "yyyy-MM"), 0)
  }
  for (const inv of allInv) {
    const key = inv.issue_date.slice(0, 7)
    if (monthly.has(key)) {
      monthly.set(key, (monthly.get(key) ?? 0) + inv.total_cents)
    }
  }
  // Also count bank-imported BUSINESS income towards the monthly revenue
  // chart. Personal income (Bürgergeld, gifts, etc.) is excluded — it is
  // not "revenue" by accounting standards.
  for (const e of incomeEntries) {
    if (e.scope !== "business") continue
    const key = e.occurred_on.slice(0, 7)
    if (monthly.has(key)) {
      monthly.set(key, (monthly.get(key) ?? 0) + e.amount_cents)
    }
  }
  // expenseEntries used for KPI cards above.
  void expenseEntries
  const chartData = [...monthly.entries()].map(([month, revenue]) => ({
    month: format(new Date(month + "-01"), "MMM", { locale: dfLocale }),
    revenue,
  }))

  const userFirstName = (user?.email ?? "").split("@")[0]
  const monthLabel = format(now, "MMMM yyyy", { locale: dfLocale })

  type RecentInvoice = Pick<Invoice, "id" | "number" | "issue_date" | "status" | "total_cents" | "paid_cents"> & {
    client: Pick<Client, "type" | "company_name" | "first_name" | "last_name">
  }
  type RecentPayment = Pick<Payment, "id" | "paid_at" | "amount_cents" | "method" | "reference" | "invoice_id"> & {
    invoice: { number: string | null } | null
  }

  const invRows = (recentInvoices ?? []) as unknown as RecentInvoice[]
  const payRows = (recentPayments ?? []) as unknown as RecentPayment[]

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("greeting", { name: userFirstName })}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("welcomeHint", { month: monthLabel })}
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus />
            {t("createInvoice")}
          </Link>
        </Button>
      </header>

      <GettingStarted locale={locale} />

      <ProfileHealth locale={locale} />

      <PlanBanner locale={locale} />

      {/* KPI CARDS — Row 1: revenue + open + jobcenter */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("mtdRevenue")}
          value={formatMoney(mtdRevenue)}
          icon={TrendingUp}
          tone="emerald"
          hint={format(now, "MMMM yyyy", { locale: dfLocale })}
        />
        <KpiCard
          label={t("ytdRevenue")}
          value={formatMoney(ytdRevenue)}
          icon={BarChart3}
          tone="primary"
          hint={format(now, "yyyy")}
        />
        <KpiCard
          label={t("openInvoices")}
          value={formatMoney(openBalance)}
          icon={Wallet}
          tone="amber"
          hint={`${overdueCount} ${t("overdue").toLowerCase()}`}
        />
        <KpiCard
          label={t("jobcenterRelevant")}
          value={formatMoney(jobcenterMonth)}
          icon={AlertCircle}
          tone="blue"
          hint={tExtra("anlageEksMonth")}
        />
      </div>

      {/* KPI CARDS — Row 2: expenses + net */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("mtdExpenses")}
          value={formatMoney(mtdExpenses)}
          icon={TrendingUp}
          tone="amber"
          hint={format(now, "MMMM yyyy", { locale: dfLocale })}
        />
        <KpiCard
          label={t("ytdExpenses")}
          value={formatMoney(ytdExpenses)}
          icon={BarChart3}
          tone="amber"
          hint={format(now, "yyyy")}
        />
        <KpiCard
          label={t("mtdNet")}
          value={formatMoney(mtdNet)}
          icon={TrendingUp}
          tone={mtdNet >= 0 ? "emerald" : "amber"}
          hint={format(now, "MMMM yyyy", { locale: dfLocale })}
        />
        <KpiCard
          label={t("ytdNet")}
          value={formatMoney(ytdNet)}
          icon={BarChart3}
          tone={ytdNet >= 0 ? "emerald" : "amber"}
          hint={format(now, "yyyy")}
        />
      </div>

      {/* CASH FLOW FORECAST */}
      <CashFlowForecast userId={user!.id} openBalance={openBalance} locale={locale} />


      {/* CHART */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            {t("revenueByMonth")}
          </CardTitle>
          <CardDescription>
            {tExtra("last12Months")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={chartData} />
        </CardContent>
      </Card>

      <OpenInvoices locale={locale} />

      {/* RECENT */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-4" />
                {t("recentInvoices")}
              </CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/invoices">
                {tExtra("viewAll")}
                <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {invRows.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t("noInvoices")}
              </p>
            ) : (
              <div className="grid divide-y">
                {invRows.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between gap-3 px-1 py-3 text-sm"
                  >
                    <div className="grid leading-tight">
                      <span className="font-mono text-xs">
                        {inv.number ?? tExtra("draftInvoiceFallback")}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {clientDisplayName(inv.client)} · {inv.issue_date}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                      <span className="font-mono tabular-nums">
                        {formatMoney(inv.total_cents)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" />
                {t("recentPayments")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {payRows.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t("noPayments")}
              </p>
            ) : (
              <div className="grid divide-y">
                {payRows.map((p) => (
                  <Link
                    key={p.id}
                    href={`/invoices/${p.invoice_id}`}
                    className="hover:bg-muted/40 flex items-center justify-between gap-3 px-1 py-3 text-sm"
                  >
                    <div className="grid leading-tight">
                      <span className="font-mono text-xs">
                        {p.invoice?.number ?? "—"}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Clock className="size-3" />
                        {p.paid_at}
                        {p.reference ? (
                          <Badge variant="outline" className="text-[10px]">
                            {p.reference}
                          </Badge>
                        ) : null}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(p.amount_cents)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {settings ? null : (
        <EmptySettingsHint
          title={tExtra("emptySettingsTitle")}
          hint={tExtra("emptySettingsHint")}
          cta={tExtra("goToSettings")}
        />
      )}
    </div>
  )
}

function EmptySettingsHint({
  title,
  hint,
  cta,
}: {
  title: string
  hint: string
  cta: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <AlertCircle className="text-amber-500 mt-0.5 size-5" />
        <div className="grid gap-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{hint}</p>
          <Button variant="link" size="sm" asChild className="justify-self-start px-0">
            <Link href="/settings">
              {cta} <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
