"use client"

/**
 * Multi-month Anlage-EKS report.
 *
 * Drives the /reports/jobcenter page when the user wants to see / export the
 * whole Bewilligungszeitraum at once (e.g. Aug 2025 – Feb 2026).
 *
 * Reads `from` / `to` from the URL and provides a period selector + custom
 * date pickers. Renders a per-month breakdown:
 *
 *   month · Einnahmen · Ausgaben · Saldo · Freibetrag · Anrechenbar
 *
 * Plus a "Bürgergeld erhalten" informational column when the banking import
 * has flagged transactions as `is_buergergeld=true`.
 */

import * as React from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
} from "date-fns"
import { de, enUS, ru, uk } from "date-fns/locale"
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  FileDown,
  Info,
  Sigma,
} from "lucide-react"

import { formatMoney } from "@/lib/money"
import { calcFreibetrag } from "@/lib/jobcenter"
import type {
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
import { Input } from "@/components/ui/input"

const DATEFNS_LOCALES: Record<string, typeof de> = {
  de,
  en: enUS,
  ru,
  uk,
}

type ExpenseRow = ExpenseEntry & {
  category?: {
    name: string
    is_jobcenter_relevant: boolean
    skr_code: string | null
  } | null
}

interface BankBuergergeldRow {
  booking_date: string
  amount_cents: number
  counterparty_name: string | null
  is_buergergeld: boolean
}

interface Props {
  periodStart: string
  periodEnd: string
  months: string[] // ISO firsts-of-month
  invoices: Invoice[]
  income: IncomeEntry[]
  expenses: ExpenseRow[]
  bankBuergergeld: BankBuergergeldRow[]
  bwzStart: string | null
  bwzEnd: string | null
  hasMinorChildren: boolean
  bedarfMonatlichCents: number | null
  locale: string
}

type PresetKey =
  | "current_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_7_months"
  | "last_12_months"
  | "bwz"
  | "custom"

function monthKey(d: string): string {
  return d.slice(0, 7) + "-01"
}

export function EksRangeReport({
  periodStart,
  periodEnd,
  months,
  invoices,
  income,
  expenses,
  bankBuergergeld,
  bwzStart,
  bwzEnd,
  hasMinorChildren,
  bedarfMonatlichCents,
  locale,
}: Props) {
  const t = useTranslations("Jobcenter")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const dfLocale = DATEFNS_LOCALES[locale] ?? de

  const [from, setFrom] = React.useState(periodStart)
  const [to, setTo] = React.useState(periodEnd)

  React.useEffect(() => {
    setFrom(periodStart)
    setTo(periodEnd)
  }, [periodStart, periodEnd])

  // ─── Aggregate per month ────────────────────────────────────────────────
  const rows = React.useMemo(() => {
    type Bucket = {
      month: string
      einnahmenCents: number
      ausgabenCents: number
      buergergeldCents: number
      invoiceCount: number
      incomeCount: number
      expenseCount: number
    }
    const map = new Map<string, Bucket>()
    for (const m of months) {
      map.set(m, {
        month: m,
        einnahmenCents: 0,
        ausgabenCents: 0,
        buergergeldCents: 0,
        invoiceCount: 0,
        incomeCount: 0,
        expenseCount: 0,
      })
    }
    for (const inv of invoices) {
      const k = monthKey(inv.issue_date)
      const b = map.get(k)
      if (b) {
        b.einnahmenCents += inv.total_cents
        b.invoiceCount += 1
      }
    }
    for (const e of income) {
      if (e.scope !== "business") continue
      if (!e.jobcenter_relevant) continue
      const k = monthKey(e.occurred_on)
      const b = map.get(k)
      if (b) {
        b.einnahmenCents += e.amount_cents
        b.incomeCount += 1
      }
    }
    for (const e of expenses) {
      if (e.scope !== "business") continue
      if (!e.is_deductible) continue
      if (e.category && e.category.is_jobcenter_relevant === false) continue
      const k = monthKey(e.occurred_on)
      const b = map.get(k)
      if (b) {
        b.ausgabenCents += e.amount_cents
        b.expenseCount += 1
      }
    }
    for (const bt of bankBuergergeld) {
      const k = monthKey(bt.booking_date)
      const b = map.get(k)
      if (b) {
        b.buergergeldCents += Math.abs(bt.amount_cents)
      }
    }

    return months.map((m) => {
      const b = map.get(m)!
      const saldoCents = Math.max(0, b.einnahmenCents - b.ausgabenCents)
      const fb = calcFreibetrag({
        einkommenCents: saldoCents,
        hasMinorChildren,
      })
      const anrechenbarCents = Math.max(0, saldoCents - fb.totalCents)
      return {
        ...b,
        saldoCents,
        freibetragCents: fb.totalCents,
        anrechenbarCents,
      }
    })
  }, [months, invoices, income, expenses, bankBuergergeld, hasMinorChildren])

  const totals = React.useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        einnahmenCents: acc.einnahmenCents + r.einnahmenCents,
        ausgabenCents: acc.ausgabenCents + r.ausgabenCents,
        saldoCents: acc.saldoCents + r.saldoCents,
        freibetragCents: acc.freibetragCents + r.freibetragCents,
        anrechenbarCents: acc.anrechenbarCents + r.anrechenbarCents,
        buergergeldCents: acc.buergergeldCents + r.buergergeldCents,
      }),
      {
        einnahmenCents: 0,
        ausgabenCents: 0,
        saldoCents: 0,
        freibetragCents: 0,
        anrechenbarCents: 0,
        buergergeldCents: 0,
      }
    )
  }, [rows])

  // ─── Verification: detect Bewilligung mismatch (banking vs settings) ─────
  const expectedBuergergeldCents = bedarfMonatlichCents
    ? bedarfMonatlichCents * months.length
    : null
  const buergergeldDelta =
    expectedBuergergeldCents !== null
      ? totals.buergergeldCents - expectedBuergergeldCents
      : null

  // ─── Preset / custom range navigation ───────────────────────────────────
  const presetFromKey = React.useMemo<PresetKey>(() => {
    const now = new Date()
    if (bwzStart && bwzEnd && periodStart === bwzStart && periodEnd === bwzEnd)
      return "bwz"
    const mStart = format(startOfMonth(now), "yyyy-MM-dd")
    const mEnd = format(endOfMonth(now), "yyyy-MM-dd")
    if (periodStart === mStart && periodEnd === mEnd) return "current_month"
    const lmStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd")
    const lmEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd")
    if (periodStart === lmStart && periodEnd === lmEnd) return "last_month"
    const yStart = format(startOfYear(now), "yyyy-MM-dd")
    const yEnd = format(endOfYear(now), "yyyy-MM-dd")
    if (periodStart === yStart && periodEnd === yEnd) return "this_year"
    return "custom"
  }, [periodStart, periodEnd, bwzStart, bwzEnd])

  function navigate(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("from", nextFrom)
    params.set("to", nextTo)
    params.delete("month")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function applyPreset(p: PresetKey) {
    const now = new Date()
    if (p === "bwz" && bwzStart && bwzEnd) {
      navigate(bwzStart, bwzEnd)
      return
    }
    if (p === "current_month") {
      navigate(
        format(startOfMonth(now), "yyyy-MM-dd"),
        format(endOfMonth(now), "yyyy-MM-dd")
      )
      return
    }
    if (p === "last_month") {
      const lm = subMonths(now, 1)
      navigate(
        format(startOfMonth(lm), "yyyy-MM-dd"),
        format(endOfMonth(lm), "yyyy-MM-dd")
      )
      return
    }
    if (p === "this_year") {
      navigate(
        format(startOfYear(now), "yyyy-MM-dd"),
        format(endOfYear(now), "yyyy-MM-dd")
      )
      return
    }
    if (p === "last_year") {
      const prev = subMonths(now, 12)
      navigate(
        format(startOfYear(prev), "yyyy-MM-dd"),
        format(endOfYear(prev), "yyyy-MM-dd")
      )
      return
    }
    if (p === "last_7_months") {
      navigate(
        format(startOfMonth(subMonths(now, 6)), "yyyy-MM-dd"),
        format(endOfMonth(now), "yyyy-MM-dd")
      )
      return
    }
    if (p === "last_12_months") {
      navigate(
        format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd"),
        format(endOfMonth(now), "yyyy-MM-dd")
      )
      return
    }
    // p === "custom" → nothing, user picks dates
  }

  const pdfUrl = `/api/reports/eks?from=${periodStart}&to=${periodEnd}`

  return (
    <div className="grid gap-4">
      {/* ─── Period selector ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="size-4" />
            {t("rangePickerTitle")}
          </CardTitle>
          <CardDescription>{t("rangePickerHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[200px_1fr_auto] md:items-end">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("rangePreset")}
            </label>
            <Select
              value={presetFromKey}
              onValueChange={(v) => applyPreset(v as PresetKey)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bwzStart && bwzEnd ? (
                  <SelectItem value="bwz">{t("presetBwz")}</SelectItem>
                ) : null}
                <SelectItem value="current_month">
                  {t("presetCurrentMonth")}
                </SelectItem>
                <SelectItem value="last_month">{t("presetLastMonth")}</SelectItem>
                <SelectItem value="last_7_months">
                  {t("presetLast7Months")}
                </SelectItem>
                <SelectItem value="last_12_months">
                  {t("presetLast12Months")}
                </SelectItem>
                <SelectItem value="this_year">{t("presetThisYear")}</SelectItem>
                <SelectItem value="last_year">{t("presetLastYear")}</SelectItem>
                <SelectItem value="custom">{t("presetCustom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("rangeFrom")}
              </label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("rangeTo")}
              </label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(from, to)}
              disabled={!from || !to || from > to}
            >
              {tCommon("apply")}
            </Button>
            <Button type="button" asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <FileDown />
                {t("downloadEksPdf")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Aggregate cards ───────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          label={t("totalEinnahmen")}
          value={formatMoney(totals.einnahmenCents)}
          tone="emerald"
          hint={t("monthsCount", { count: months.length })}
        />
        <SummaryCard
          label={t("totalAusgaben")}
          value={formatMoney(totals.ausgabenCents)}
          tone="rose"
          hint={t("deductibleHint")}
        />
        <SummaryCard
          label={t("totalSaldo")}
          value={formatMoney(totals.saldoCents)}
          tone="blue"
          hint={t("saldoHint")}
        />
        <SummaryCard
          label={t("totalAnrechenbar")}
          value={formatMoney(totals.anrechenbarCents)}
          tone="primary"
          hint={t("anrechenbarHint")}
        />
      </div>

      {/* ─── Bürgergeld-Verifikationskarte ────────────────────────────── */}
      {totals.buergergeldCents > 0 || expectedBuergergeldCents ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4" />
              {t("verifyTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {t("verifyBankSum")}
              </span>
              <span className="font-mono tabular-nums">
                {formatMoney(totals.buergergeldCents)}
              </span>
            </div>
            {expectedBuergergeldCents !== null ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("verifyExpected", { count: months.length })}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(expectedBuergergeldCents)}
                  </span>
                </div>
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 border-t pt-2 ${
                    Math.abs(buergergeldDelta ?? 0) > 100
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  <span className="font-medium">
                    {Math.abs(buergergeldDelta ?? 0) > 100
                      ? t("verifyMismatch")
                      : t("verifyMatch")}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(Math.abs(buergergeldDelta ?? 0))}
                  </span>
                </div>
              </>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {t("verifyHint")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Per-Month-Tabelle ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" />
            {t("monthlyBreakdownTitle")}
          </CardTitle>
          <CardDescription>{t("monthlyBreakdownHint")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground border-b text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left font-medium">
                  {t("colMonth")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colEinnahmen")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colAusgaben")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colSaldo")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colFreibetrag")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colAnrechenbar")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colBuergergeld")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.month} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    {format(parseISO(r.month), "MMM yyyy", { locale: dfLocale })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(r.einnahmenCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    {formatMoney(r.ausgabenCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatMoney(r.saldoCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                    {formatMoney(r.freibetragCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                    {formatMoney(r.anrechenbarCents)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                    {r.buergergeldCents > 0
                      ? formatMoney(r.buergergeldCents)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 border-t-2 font-semibold">
                <td className="px-3 py-2 flex items-center gap-1.5">
                  <Sigma className="size-3.5" />
                  {t("colTotal")}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(totals.einnahmenCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600 dark:text-rose-400">
                  {formatMoney(totals.ausgabenCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatMoney(totals.saldoCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                  {formatMoney(totals.freibetragCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatMoney(totals.anrechenbarCents)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                  {totals.buergergeldCents > 0
                    ? formatMoney(totals.buergergeldCents)
                    : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* ─── Methodik-Footer ─────────────────────────────────────────── */}
      <div className="bg-amber-500/5 text-muted-foreground flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs leading-relaxed">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p>{t("methodologyHint")}</p>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone: "emerald" | "rose" | "blue" | "primary"
}) {
  const toneClass = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-600 dark:text-rose-400",
    blue: "text-blue-600 dark:text-blue-400",
    primary: "text-primary",
  }[tone]
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </div>
        {hint ? (
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
