"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  ArrowDown,
  ArrowUp,
  Minus,
  PieChart as PieChartIcon,
} from "lucide-react"
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/money"
import { useRouter } from "@/i18n/navigation"
import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
} from "@/types/database.types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type Period =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "all_time"
  | "last_7_months"
  | "last_12_months"
  | "custom"
type ScopeFilter = "all" | "business" | "personal"
type KindFilter = "expense" | "income"
type SortKey = "amount" | "count" | "name"

interface Props {
  categories: Category[]
  expenses: ExpenseEntry[]
  income: IncomeEntry[]
  locale?: string
  /** Default period if no URL param is set. Defaults to "last_7_months". */
  defaultPeriod?: Period
}

const PALETTE = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#9333ea",
  "#e11d48",
  "#0ea5e9",
  "#16a34a",
]

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getPeriodRange(
  period: Period,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } | null {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  switch (period) {
    case "this_month":
      return {
        from: fmtDate(new Date(Date.UTC(y, m, 1))),
        to: fmtDate(new Date(Date.UTC(y, m + 1, 0))),
      }
    case "last_month":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 1, 1))),
        to: fmtDate(new Date(Date.UTC(y, m, 0))),
      }
    case "this_quarter": {
      const q = Math.floor(m / 3)
      return {
        from: fmtDate(new Date(Date.UTC(y, q * 3, 1))),
        to: fmtDate(new Date(Date.UTC(y, q * 3 + 3, 0))),
      }
    }
    case "this_year":
      return {
        from: fmtDate(new Date(Date.UTC(y, 0, 1))),
        to: fmtDate(new Date(Date.UTC(y, 11, 31))),
      }
    case "last_year":
      return {
        from: fmtDate(new Date(Date.UTC(y - 1, 0, 1))),
        to: fmtDate(new Date(Date.UTC(y - 1, 11, 31))),
      }
    case "last_7_months":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 6, 1))),
        to: fmtDate(new Date(Date.UTC(y, m + 1, 0))),
      }
    case "last_12_months":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 11, 1))),
        to: fmtDate(new Date(Date.UTC(y, m + 1, 0))),
      }
    case "custom": {
      const f = customFrom ?? ""
      const t = customTo ?? ""
      if (/^\d{4}-\d{2}-\d{2}$/.test(f) && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return { from: f, to: t }
      }
      return null
    }
    case "all_time":
      return null
  }
}

function getPreviousPeriodRange(
  period: Period
): { from: string; to: string } | null {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  switch (period) {
    case "this_month":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 1, 1))),
        to: fmtDate(new Date(Date.UTC(y, m, 0))),
      }
    case "last_month":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 2, 1))),
        to: fmtDate(new Date(Date.UTC(y, m - 1, 0))),
      }
    case "this_quarter": {
      const q = Math.floor(m / 3)
      return {
        from: fmtDate(new Date(Date.UTC(y, (q - 1) * 3, 1))),
        to: fmtDate(new Date(Date.UTC(y, q * 3, 0))),
      }
    }
    case "this_year":
      return {
        from: fmtDate(new Date(Date.UTC(y - 1, 0, 1))),
        to: fmtDate(new Date(Date.UTC(y - 1, 11, 31))),
      }
    case "last_year":
      return {
        from: fmtDate(new Date(Date.UTC(y - 2, 0, 1))),
        to: fmtDate(new Date(Date.UTC(y - 2, 11, 31))),
      }
    case "last_7_months":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 13, 1))),
        to: fmtDate(new Date(Date.UTC(y, m - 6, 0))),
      }
    case "last_12_months":
      return {
        from: fmtDate(new Date(Date.UTC(y, m - 23, 1))),
        to: fmtDate(new Date(Date.UTC(y, m - 11, 0))),
      }
    case "custom":
    case "all_time":
      return null
  }
}

interface Bucket {
  categoryId: string | null
  categoryName: string
  scope: "business" | "personal"
  color: string
  sum: number
  count: number
  avg: number
  pct: number
  prevSum: number
  trendPct: number | null
}

export function CategoriesBreakdownClient({
  categories,
  expenses,
  income,
  defaultPeriod,
}: Props) {
  const t = useTranslations("Categories")
  const router = useRouter()

  const [period, setPeriod] = React.useState<Period>(
    defaultPeriod ?? "last_7_months"
  )
  const [scope, setScope] = React.useState<ScopeFilter>("all")
  const [kind, setKind] = React.useState<KindFilter>("expense")
  const [sortKey, setSortKey] = React.useState<SortKey>("amount")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")
  const [customFrom, setCustomFrom] = React.useState<string>("")
  const [customTo, setCustomTo] = React.useState<string>("")

  const range = getPeriodRange(period, customFrom, customTo)
  const prevRange = getPreviousPeriodRange(period)

  const categoryById = React.useMemo(() => {
    const m = new Map<string, Category>()
    categories.forEach((c) => m.set(c.id, c))
    return m
  }, [categories])

  // filter helpers
  const filterEntries = React.useCallback(
    <T extends { occurred_on: string; scope: "business" | "personal" }>(
      entries: T[],
      r: { from: string; to: string } | null
    ): T[] => {
      return entries.filter((e) => {
        if (scope !== "all" && e.scope !== scope) return false
        if (r) {
          if (e.occurred_on < r.from || e.occurred_on > r.to) return false
        }
        return true
      })
    },
    [scope]
  )

  // current dataset — normalize to common shape so type stays uniform
  type Entry = {
    occurred_on: string
    scope: "business" | "personal"
    amount_cents: number
    category_id: string | null
  }
  const dataset: Entry[] = React.useMemo(() => {
    const src = kind === "expense" ? expenses : income
    return src.map((e) => ({
      occurred_on: e.occurred_on,
      scope: e.scope,
      amount_cents: e.amount_cents,
      category_id: e.category_id,
    }))
  }, [kind, expenses, income])

  const currentEntries = React.useMemo(
    () => filterEntries(dataset, range),
    [filterEntries, dataset, range]
  )
  const previousEntries = React.useMemo(
    () => (prevRange ? filterEntries(dataset, prevRange) : []),
    [filterEntries, dataset, prevRange]
  )

  // aggregate by category
  const aggregate = React.useMemo(() => {
    const groupSum = new Map<
      string,
      { sum: number; count: number; scope: "business" | "personal" }
    >()
    let grandTotal = 0
    for (const e of currentEntries) {
      const key = e.category_id ?? "__uncategorized__"
      grandTotal += e.amount_cents
      const existing = groupSum.get(key)
      if (existing) {
        existing.sum += e.amount_cents
        existing.count += 1
      } else {
        groupSum.set(key, {
          sum: e.amount_cents,
          count: 1,
          scope: e.scope,
        })
      }
    }

    const prevByCat = new Map<string, number>()
    for (const e of previousEntries) {
      const key = e.category_id ?? "__uncategorized__"
      prevByCat.set(key, (prevByCat.get(key) ?? 0) + e.amount_cents)
    }

    const buckets: Bucket[] = []
    let paletteIdx = 0
    for (const [key, v] of groupSum) {
      const cat = key === "__uncategorized__" ? null : categoryById.get(key)
      const color =
        cat?.color && cat.color.length > 0
          ? cat.color
          : PALETTE[paletteIdx++ % PALETTE.length]
      const prevSum = prevByCat.get(key) ?? 0
      const trendPct =
        prevRange == null
          ? null
          : prevSum === 0
            ? v.sum > 0
              ? 100
              : 0
            : ((v.sum - prevSum) / prevSum) * 100
      buckets.push({
        categoryId: cat?.id ?? null,
        categoryName: cat?.name ?? "—",
        scope: v.scope,
        color,
        sum: v.sum,
        count: v.count,
        avg: v.count > 0 ? v.sum / v.count : 0,
        pct: grandTotal > 0 ? (v.sum / grandTotal) * 100 : 0,
        prevSum,
        trendPct,
      })
    }

    buckets.sort((a, b) => b.sum - a.sum)

    // Group <1% as "Other"
    const major: Bucket[] = []
    const minor: Bucket[] = []
    for (const b of buckets) {
      if (b.pct < 1 && buckets.length > 6) minor.push(b)
      else major.push(b)
    }

    let combined: Bucket[] = major
    if (minor.length > 0) {
      const sumMinor = minor.reduce((s, b) => s + b.sum, 0)
      const countMinor = minor.reduce((s, b) => s + b.count, 0)
      combined = [
        ...major,
        {
          categoryId: null,
          categoryName: t("otherCategoriesLabel", { count: minor.length }),
          scope: "business" as const,
          color: "#94a3b8",
          sum: sumMinor,
          count: countMinor,
          avg: countMinor > 0 ? sumMinor / countMinor : 0,
          pct: grandTotal > 0 ? (sumMinor / grandTotal) * 100 : 0,
          prevSum: 0,
          trendPct: null,
        },
      ]
    }

    return { buckets: combined, grandTotal }
  }, [currentEntries, previousEntries, categoryById, prevRange, t])

  const sortedBuckets = React.useMemo(() => {
    const arr = [...aggregate.buckets]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === "amount") cmp = a.sum - b.sum
      else if (sortKey === "count") cmp = a.count - b.count
      else cmp = a.categoryName.localeCompare(b.categoryName)
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [aggregate.buckets, sortKey, sortDir])

  const top3 = aggregate.buckets.slice(0, 3)
  const top10 = aggregate.buckets.slice(0, 10)

  const dateLabel = range ? `${range.from} → ${range.to}` : t("periodAllTime")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const handleRowClick = (b: Bucket) => {
    if (!b.categoryId) return
    const effectiveScope = scope === "all" ? b.scope : scope
    const path = `/finances/${effectiveScope}/${kind === "expense" ? "expenses" : "income"}`
    const params = new URLSearchParams()
    params.set("category_id", b.categoryId)
    if (range) {
      params.set("from", range.from)
      params.set("to", range.to)
    }
    router.push(`${path}?${params.toString()}`)
  }

  return (
    <div className="grid gap-6">
      {/* Filter bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <CardDescription>{dateLabel}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[auto_auto_auto_1fr] md:items-end">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("period")}
            </label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as Period)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">
                  {t("periodThisMonth")}
                </SelectItem>
                <SelectItem value="last_month">
                  {t("periodLastMonth")}
                </SelectItem>
                <SelectItem value="last_7_months">
                  {t("periodLast7Months")}
                </SelectItem>
                <SelectItem value="last_12_months">
                  {t("periodLast12Months")}
                </SelectItem>
                <SelectItem value="this_quarter">
                  {t("periodThisQuarter")}
                </SelectItem>
                <SelectItem value="this_year">
                  {t("periodThisYear")}
                </SelectItem>
                <SelectItem value="last_year">
                  {t("periodLastYear")}
                </SelectItem>
                <SelectItem value="all_time">{t("periodAllTime")}</SelectItem>
                <SelectItem value="custom">{t("periodCustom")}</SelectItem>
              </SelectContent>
            </Select>
            {period === "custom" ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-md border px-2 text-sm bg-background"
                  aria-label={t("periodCustomFrom")}
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-md border px-2 text-sm bg-background"
                  aria-label={t("periodCustomTo")}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("scope")}
            </label>
            <Tabs
              value={scope}
              onValueChange={(v) => setScope(v as ScopeFilter)}
            >
              <TabsList>
                <TabsTrigger value="all">{t("scopeAll")}</TabsTrigger>
                <TabsTrigger value="business">
                  {t("scopeBusiness")}
                </TabsTrigger>
                <TabsTrigger value="personal">
                  {t("scopePersonal")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("kind")}
            </label>
            <Tabs value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
              <TabsList>
                <TabsTrigger value="expense">{t("kindExpense")}</TabsTrigger>
                <TabsTrigger value="income">{t("kindIncome")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="md:text-right">
            <div className="text-xs uppercase text-muted-foreground tracking-wide">
              {t("total")}
            </div>
            <div
              className={cn(
                "text-2xl font-semibold tabular-nums",
                kind === "expense" ? "text-rose-600" : "text-emerald-600"
              )}
            >
              {formatMoney(aggregate.grandTotal)}
            </div>
          </div>
        </CardContent>
      </Card>

      {aggregate.buckets.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 py-16 text-center">
            <PieChartIcon className="size-10 text-muted-foreground" />
            <div className="text-base font-medium">{t("emptyTitle")}</div>
            <div className="text-sm text-muted-foreground">
              {t("emptyHint")}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/finances/${scope === "all" ? "business" : scope}/expenses`
                  )
                }
              >
                {t("emptyAddExpense")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(
                    `/finances/${scope === "all" ? "business" : scope}/income`
                  )
                }
              >
                {t("emptyAddIncome")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Donut + Legend card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("title")}</CardTitle>
              <CardDescription>
                {top3.length > 0 && (
                  <span>
                    {t("top3Label")}{" "}
                    {top3
                      .map(
                        (b) =>
                          `${b.categoryName} (${b.pct.toFixed(0)}%)`
                      )
                      .join(", ")}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-center">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={top10.map((b) => ({
                        name: b.categoryName,
                        value: b.sum,
                        pct: b.pct,
                        color: b.color,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={1}
                    >
                      {top10.map((b, i) => (
                        <Cell key={i} fill={b.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, item) => {
                        const num = Number(value)
                        const payload = (item as { payload?: { pct?: number; name?: string } })
                          ?.payload
                        const pct = payload?.pct ?? 0
                        return [
                          `${formatMoney(num)} (${pct.toFixed(1)}%)`,
                          payload?.name ?? "",
                        ]
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-2">
                {aggregate.buckets.slice(0, 5).map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="truncate">{b.categoryName}</span>
                    </div>
                    <div className="shrink-0 tabular-nums text-muted-foreground">
                      {b.pct.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("title")}</CardTitle>
              <CardDescription>{dateLabel}</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 w-8" />
                    <th
                      className="px-2 py-2 cursor-pointer select-none"
                      onClick={() => toggleSort("name")}
                    >
                      {t("colName")}
                    </th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer select-none"
                      onClick={() => toggleSort("amount")}
                    >
                      {t("colAmount")}
                    </th>
                    <th className="px-2 py-2 w-[24%]">{t("colPct")}</th>
                    <th
                      className="px-2 py-2 text-right cursor-pointer select-none"
                      onClick={() => toggleSort("count")}
                    >
                      {t("colCount")}
                    </th>
                    <th className="px-2 py-2 text-right">{t("colAvg")}</th>
                    <th className="px-2 py-2 text-right">{t("colTrend")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBuckets.map((b, i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-b last:border-b-0 transition-colors",
                        b.categoryId
                          ? "cursor-pointer hover:bg-muted/40"
                          : ""
                      )}
                      onClick={() => handleRowClick(b)}
                    >
                      <td className="px-2 py-2">
                        <span
                          className="block size-3 rounded-full"
                          style={{ backgroundColor: b.color }}
                        />
                      </td>
                      <td className="px-2 py-2 font-medium">
                        {b.categoryName}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatMoney(b.sum)}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${Math.min(100, b.pct)}%`,
                                backgroundColor: b.color,
                              }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {b.pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {b.count}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {formatMoney(b.avg)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {b.trendPct == null ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="size-3" />
                            {t("noTrend")}
                          </span>
                        ) : b.trendPct > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                            <ArrowUp className="size-3" />
                            {b.trendPct.toFixed(0)}%
                          </span>
                        ) : b.trendPct < 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <ArrowDown className="size-3" />
                            {Math.abs(b.trendPct).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Minus className="size-3" />
                            0%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

    </div>
  )
}
