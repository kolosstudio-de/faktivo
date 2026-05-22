"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  ChevronDown,
  Filter,
  HomeIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatMoney } from "@/lib/money"
import type {
  Category,
  Client,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
} from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Types ───────────────────────────────────────────────────────────────

type InvoiceLite = Pick<
  Invoice,
  | "id"
  | "number"
  | "client_id"
  | "issue_date"
  | "total_cents"
  | "paid_cents"
  | "status"
  | "locked_at"
  | "currency"
>

interface ClientWithStats extends Client {
  invoiceCount: number
  totalRevenue: number
  paidRevenue: number
  outstandingRevenue: number
  lastInvoiceDate: string | null
  avgInvoice: number
}

type Scope = "all" | "business" | "personal"
type DateRange =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "last_12_months"

interface Props {
  invoices: InvoiceLite[]
  expenses: ExpenseEntry[]
  income: IncomeEntry[]
  categories: Category[]
  clients: ClientWithStats[]
}

// ─── Date helpers ────────────────────────────────────────────────────────

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = now.getMonth()
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  switch (range) {
    case "this_month":
      return {
        from: fmt(new Date(yyyy, mm, 1)),
        to: fmt(new Date(yyyy, mm + 1, 0)),
      }
    case "last_month":
      return {
        from: fmt(new Date(yyyy, mm - 1, 1)),
        to: fmt(new Date(yyyy, mm, 0)),
      }
    case "this_quarter": {
      const q = Math.floor(mm / 3)
      return {
        from: fmt(new Date(yyyy, q * 3, 1)),
        to: fmt(new Date(yyyy, q * 3 + 3, 0)),
      }
    }
    case "this_year":
      return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` }
    case "last_year":
      return { from: `${yyyy - 1}-01-01`, to: `${yyyy - 1}-12-31` }
    case "last_12_months": {
      const start = new Date(yyyy, mm - 11, 1)
      return { from: fmt(start), to: fmt(now) }
    }
  }
}

const DATE_RANGE_KEYS: Record<DateRange, string> = {
  this_month: "rangeThisMonth",
  last_month: "rangeLastMonth",
  this_quarter: "rangeThisQuarter",
  this_year: "rangeThisYear",
  last_year: "rangeLastYear",
  last_12_months: "rangeLast12Months",
}

// ─── Color palette ───────────────────────────────────────────────────────

const COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
  "#94a3b8", // slate-400
]

// ─── Component ───────────────────────────────────────────────────────────

export function AnalyticsPageClient({
  invoices,
  expenses,
  income,
  categories,
  clients,
}: Props) {
  const t = useTranslations("Analytics")
  const [scope, setScope] = React.useState<Scope>("all")
  const [dateRange, setDateRange] = React.useState<DateRange>("this_year")

  const range = React.useMemo(() => getDateRange(dateRange), [dateRange])
  const catMap = React.useMemo(() => {
    const m = new Map<string, Category>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])
  const clientMap = React.useMemo(() => {
    const m = new Map<string, ClientWithStats>()
    for (const c of clients) m.set(c.id, c)
    return m
  }, [clients])

  // ─── Filter ───────────────────────────────────────────────────────────
  const filteredInvoices = React.useMemo(
    () =>
      invoices.filter(
        (inv) => inv.issue_date >= range.from && inv.issue_date <= range.to
      ),
    [invoices, range]
  )
  const filteredExpenses = React.useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.occurred_on >= range.from &&
          e.occurred_on <= range.to &&
          (scope === "all" || e.scope === scope)
      ),
    [expenses, range, scope]
  )
  const filteredIncome = React.useMemo(
    () =>
      income.filter(
        (e) =>
          e.occurred_on >= range.from &&
          e.occurred_on <= range.to &&
          (scope === "all" || e.scope === scope)
      ),
    [income, range, scope]
  )

  // Total income = invoices + extra income (filtered by scope on extra)
  const invoiceIncome = filteredInvoices.reduce(
    (s, i) => s + i.total_cents,
    0
  )
  const extraIncomeBusiness = filteredIncome
    .filter((i) => i.scope === "business")
    .reduce((s, i) => s + i.amount_cents, 0)
  const extraIncomePersonal = filteredIncome
    .filter((i) => i.scope === "personal")
    .reduce((s, i) => s + i.amount_cents, 0)

  const totalIncome =
    scope === "personal"
      ? extraIncomePersonal
      : scope === "business"
        ? invoiceIncome + extraIncomeBusiness
        : invoiceIncome + extraIncomeBusiness + extraIncomePersonal

  const totalExpense = filteredExpenses.reduce(
    (s, e) => s + e.amount_cents,
    0
  )
  const netCashFlow = totalIncome - totalExpense
  const savingRate =
    totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0

  // ─── By Category ──────────────────────────────────────────────────────
  const expensesByCategory = React.useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; count: number; skr03: string | null }
    >()
    for (const e of filteredExpenses) {
      const cat = e.category_id ? catMap.get(e.category_id) : null
      const key = cat?.id ?? "uncategorized"
      const name = cat?.name ?? t("uncategorized")
      const cur = map.get(key) ?? {
        name,
        total: 0,
        count: 0,
        skr03: cat?.skr_code ?? null,
      }
      cur.total += e.amount_cents
      cur.count++
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filteredExpenses, catMap, t])

  // ─── By Vendor ────────────────────────────────────────────────────────
  const expensesByVendor = React.useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    for (const e of filteredExpenses) {
      const name = (e.vendor ?? t("noVendor")).trim() || t("noVendor")
      const cur = map.get(name) ?? { name, total: 0, count: 0 }
      cur.total += e.amount_cents
      cur.count++
      map.set(name, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10)
  }, [filteredExpenses, t])

  // ─── Monthly Income/Expense bars ──────────────────────────────────────
  const monthlyData = React.useMemo(() => {
    // 12 months ending at range.to
    const buckets = new Map<
      string,
      { month: string; income: number; expense: number; net: number }
    >()
    const start = new Date(range.from + "T00:00:00Z")
    const end = new Date(range.to + "T00:00:00Z")
    const cur = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
    )
    while (cur <= end) {
      const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`
      buckets.set(key, { month: key, income: 0, expense: 0, net: 0 })
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
    const monthOf = (d: string) => d.slice(0, 7)

    if (scope !== "personal") {
      for (const inv of filteredInvoices) {
        const k = monthOf(inv.issue_date)
        const b = buckets.get(k)
        if (b) b.income += inv.total_cents
      }
    }
    for (const i of filteredIncome) {
      const k = monthOf(i.occurred_on)
      const b = buckets.get(k)
      if (b) b.income += i.amount_cents
    }
    for (const e of filteredExpenses) {
      const k = monthOf(e.occurred_on)
      const b = buckets.get(k)
      if (b) b.expense += e.amount_cents
    }
    for (const b of buckets.values()) b.net = b.income - b.expense
    return [...buckets.values()]
  }, [filteredInvoices, filteredIncome, filteredExpenses, range, scope])

  // ─── Top clients (filtered to range) ──────────────────────────────────
  const topClients = React.useMemo(() => {
    const map = new Map<
      string,
      { revenue: number; count: number; client: ClientWithStats | null }
    >()
    for (const inv of filteredInvoices) {
      const cur = map.get(inv.client_id) ?? {
        revenue: 0,
        count: 0,
        client: clientMap.get(inv.client_id) ?? null,
      }
      cur.revenue += inv.total_cents
      cur.count++
      map.set(inv.client_id, cur)
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [filteredInvoices, clientMap])

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6">
      {/* FILTER BAR */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
            <Filter className="size-3.5" />
            {t("filterLabel")}
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase">
              {t("period")}
            </span>
            <Select
              value={dateRange}
              onValueChange={(v) => v && setDateRange(v as DateRange)}
            >
              <SelectTrigger className="w-44">
                <SelectValue>
                  <Calendar className="mr-1.5 inline size-3.5" />
                  {t(DATE_RANGE_KEYS[dateRange])}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DATE_RANGE_KEYS) as DateRange[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(DATE_RANGE_KEYS[k])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <span className="text-muted-foreground text-[10px] font-medium uppercase">
              {t("scope")}
            </span>
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              {(["all", "business", "personal"] as Scope[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={scope === s ? "default" : "ghost"}
                  onClick={() => setScope(s)}
                  className="h-7 rounded-md text-xs"
                >
                  {s === "all"
                    ? t("scopeAll")
                    : s === "business"
                      ? t("scopeBusiness")
                      : t("scopePersonal")}
                </Button>
              ))}
            </div>
          </div>
          <div className="text-muted-foreground ml-auto text-xs">
            {range.from} → {range.to}
          </div>
        </CardContent>
      </Card>

      {/* STATS CARDS */}
      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          icon={ArrowUpRight}
          label={t("statIncome")}
          value={formatMoney(totalIncome)}
          tone="emerald"
          hint={t("invoiceCount", { count: filteredInvoices.length })}
        />
        <StatCard
          icon={ArrowDownRight}
          label={t("statExpenses")}
          value={formatMoney(totalExpense)}
          tone="rose"
          hint={t("bookingCount", { count: filteredExpenses.length })}
        />
        <StatCard
          icon={TrendingUp}
          label={netCashFlow >= 0 ? t("statProfit") : t("statLoss")}
          value={formatMoney(netCashFlow)}
          tone={netCashFlow >= 0 ? "primary" : "rose"}
          hint={t("statIncomeMinusExpenses")}
        />
        <StatCard
          icon={Wallet}
          label={t("statSavingRate")}
          value={`${savingRate}%`}
          tone={savingRate >= 20 ? "emerald" : savingRate >= 0 ? "amber" : "rose"}
          hint={
            savingRate >= 20
              ? t("savingHintGood")
              : savingRate >= 0
                ? t("savingHintTight")
                : t("savingHintNegative")
          }
        />
      </div>

      {/* MONTHLY BARS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" />
            {t("monthlyTitle")}
          </CardTitle>
          <CardDescription>{t("monthlyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData.map((m) => ({
                  ...m,
                  income: m.income / 100,
                  expense: m.expense / 100,
                  net: m.net / 100,
                }))}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(v) =>
                    `${Number(v).toLocaleString("de-DE", { maximumFractionDigits: 2 })} €`
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="income"
                  fill="#10b981"
                  name={t("statIncome")}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  fill="#ef4444"
                  name={t("statExpenses")}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* CATEGORY PIE + TOP VENDORS */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="size-4" />
              {t("topCategoriesTitle")}
            </CardTitle>
            <CardDescription>{t("topCategoriesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {t("noExpensesInRange")}
              </p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory.slice(0, 8).map((c) => ({
                        name: c.name,
                        value: c.total / 100,
                      }))}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={(props: { name?: string; percent?: number }) =>
                        `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {expensesByCategory.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) =>
                        `${Number(v).toLocaleString("de-DE", {
                          maximumFractionDigits: 2,
                        })} €`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ChevronDown className="size-4" />
              {t("topVendorsTitle")}
            </CardTitle>
            <CardDescription>{t("topVendorsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByVendor.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noData")}</p>
            ) : (
              <div className="grid gap-1.5">
                {expensesByVendor.map((v, i) => {
                  const max = expensesByVendor[0].total
                  const pct = (v.total / max) * 100
                  return (
                    <div key={v.name} className="grid gap-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm">
                          {i + 1}. {v.name}
                        </span>
                        <span className="font-mono text-xs tabular-nums shrink-0">
                          {formatMoney(v.total)} · {v.count}×
                        </span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-rose-500 h-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CATEGORY TABLE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChartIcon className="size-4" />
            {t("categoryBreakdownTitle")}
          </CardTitle>
          <CardDescription>{t("categoryBreakdownDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {expensesByCategory.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("noExpensesInRange")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("tableCategory")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableSkr03")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableCount")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableAverage")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableTotal")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableShare")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expensesByCategory.map((c) => {
                    const pct =
                      totalExpense > 0 ? (c.total / totalExpense) * 100 : 0
                    return (
                      <tr key={c.name}>
                        <td className="px-3 py-2 font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground font-mono text-xs">
                          {c.skr03 ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {c.count}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(Math.round(c.total / c.count))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                          {formatMoney(c.total)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-muted-foreground text-xs">
                              {pct.toFixed(1)}%
                            </span>
                            <div className="bg-muted h-2 w-16 overflow-hidden rounded-full">
                              <div
                                className="bg-rose-500 h-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TOP CLIENTS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" />
            {t("topClientsTitle")}
          </CardTitle>
          <CardDescription>{t("topClientsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("noInvoicesInRange")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("tableClient")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableInvoices")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableAvgInvoice")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableTotal")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("tableStatus")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topClients.map((c) => {
                    const cl = c.client
                    const name = cl
                      ? cl.type === "company"
                        ? cl.company_name
                        : `${cl.first_name ?? ""} ${cl.last_name ?? ""}`.trim()
                      : t("clientUnknown")
                    const profit =
                      cl && cl.totalRevenue > 0
                        ? cl.outstandingRevenue / cl.totalRevenue
                        : 0
                    const status =
                      profit < 0.1
                        ? { label: t("clientStatusPaying"), color: "text-emerald-600 dark:text-emerald-400" }
                        : profit < 0.5
                          ? { label: t("clientStatusPartial"), color: "text-amber-600 dark:text-amber-400" }
                          : { label: t("clientStatusDebt"), color: "text-rose-600 dark:text-rose-400" }
                    return (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-medium">{name}</td>
                        <td className="px-3 py-2 text-right">{c.count}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(Math.round(c.revenue / c.count))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                          {formatMoney(c.revenue)}
                        </td>
                        <td className={`px-3 py-2 text-right text-xs ${status.color}`}>
                          {status.label}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── StatCard ────────────────────────────────────────────────────────────

const TONE_CLASSES: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  rose: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
  primary: "text-primary bg-primary/10",
  amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  hint?: string
  tone: "emerald" | "rose" | "primary" | "amber"
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </CardTitle>
          <div
            className={`grid size-7 place-items-center rounded-lg ${TONE_CLASSES[tone]}`}
          >
            <Icon className="size-3.5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-mono text-2xl font-semibold tabular-nums">
          {value}
        </div>
        {hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

void HomeIcon // keep import for future use
