"use client"

/**
 * Vorläufige Anlage EKS — Prognose-Formular am START des Bewilligungszeitraums.
 *
 * Workflow (§41a SGB II):
 *   1. User wählt BWZ-Start und -Ende (defaults aus settings).
 *   2. Pro Monat schätzt User Einnahmen / Ausgaben.
 *      - Kann via "Auto-Vorschlag aus Banking" mit den letzten 6 Monaten
 *        vorgefüllt werden (Durchschnitt → alle Monate gleich).
 *      - Oder via "Durchschnitt pro Monat" einen Pauschalwert eintragen.
 *   3. "Speichern" → INSERT in jobcenter_reports kind='vorlaeufig'.
 *   4. "PDF exportieren" → /api/reports/eks-vorlaeufig.
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  CalendarRange,
  FileDown,
  Loader2,
  RefreshCw,
  Save,
  Sigma,
  Sparkles,
} from "lucide-react"

import { formatMoney } from "@/lib/money"
import { useSupabase } from "@/lib/hooks/use-supabase"
import type {
  EksPrognoseMonth,
  EksPrognosePayload,
  JobcenterReport,
  Settings,
} from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface Props {
  settings: Settings | null
  userId: string
}

function parseCents(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace(/\s/g, "")
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n * 100))
}

function formatEditable(cents: number): string {
  if (!cents) return ""
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(
    cents / 100
  )
}

function bwzMonths(startISO: string, endISO: string): string[] {
  if (!startISO || !endISO || startISO > endISO) return []
  const out: string[] = []
  const s = new Date(startISO + "T00:00:00Z")
  const e = new Date(endISO + "T00:00:00Z")
  const cursor = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1))
  while (cursor <= e) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return out
}

function defaultBwz(settings: Settings | null): { start: string; end: string } {
  if (
    settings?.bewilligungszeitraum_start &&
    settings?.bewilligungszeitraum_end
  ) {
    return {
      start: settings.bewilligungszeitraum_start,
      end: settings.bewilligungszeitraum_end,
    }
  }
  // Default: next 6 months from today (1st-of-this-month → end of month+5).
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 6, 0)
  )
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function EksVorlaeufigForm({ settings, userId }: Props) {
  const t = useTranslations("Jobcenter")
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const fromDoc = searchParams?.get("from_doc") === "1"

  const defaults = React.useMemo(() => defaultBwz(settings), [settings])
  const [bwzStart, setBwzStart] = React.useState<string>(defaults.start)
  const [bwzEnd, setBwzEnd] = React.useState<string>(defaults.end)
  const [avgInput, setAvgInput] = React.useState<string>("")
  const months = React.useMemo(
    () => bwzMonths(bwzStart, bwzEnd),
    [bwzStart, bwzEnd]
  )
  // Manual edits override the loaded report — we treat the latest loaded
  // report-id as the "source of truth identity" and reset overrides when it
  // changes. Overrides are merged on top of the loaded data, so user can
  // tweak individual cells without losing the rest.
  const [overrides, setOverrides] = React.useState<
    Record<string, { einnahmenCents: number; ausgabenCents: number }>
  >({})
  const [lastLoadedKey, setLastLoadedKey] = React.useState<string | null>(null)

  // ─── Load latest vorläufig report (if any) for this BWZ ──────────────
  const loadedReport = useQuery({
    queryKey: ["jobcenter-vorlaeufig", userId, bwzStart, bwzEnd],
    queryFn: async () => {
      if (!bwzStart || !bwzEnd) return null
      const { data, error } = await supabase
        .from("jobcenter_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("kind", "vorlaeufig")
        .eq("period_start", bwzStart)
        .eq("period_end", bwzEnd)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as JobcenterReport | null) ?? null
    },
  })

  // Derived: per-month base values from the loaded report.
  const loadedMonthData = React.useMemo<
    Record<string, { einnahmenCents: number; ausgabenCents: number }>
  >(() => {
    const report = loadedReport.data
    if (!report) return {}
    const payload = report.prognose_payload as EksPrognosePayload | null
    if (!payload?.months) return {}
    const map: Record<
      string,
      { einnahmenCents: number; ausgabenCents: number }
    > = {}
    for (const m of payload.months) {
      map[m.month] = {
        einnahmenCents: m.einnahmenCents,
        ausgabenCents: m.ausgabenCents,
      }
    }
    return map
  }, [loadedReport.data])

  // Reset overrides when the loaded report changes (new period or saved row).
  // This is the documented React pattern for "deriving state from props":
  // detect the change during render and call setState to schedule a re-render
  // with the corrected state. The same render also returns the stale UI, but
  // React discards it and re-renders immediately. No useEffect needed.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const loadedKey =
    (loadedReport.data?.id ?? "none") + ":" + bwzStart + ":" + bwzEnd
  if (lastLoadedKey !== loadedKey) {
    setLastLoadedKey(loadedKey)
    if (Object.keys(overrides).length > 0) {
      setOverrides({})
    }
  }

  // Effective map = loaded ∪ overrides (overrides win per month).
  const monthData = React.useMemo(() => {
    const merged: Record<
      string,
      { einnahmenCents: number; ausgabenCents: number }
    > = { ...loadedMonthData }
    for (const [m, v] of Object.entries(overrides)) {
      merged[m] = v
    }
    return merged
  }, [loadedMonthData, overrides])

  function setMonthData(
    updater:
      | Record<string, { einnahmenCents: number; ausgabenCents: number }>
      | ((
          cur: Record<
            string,
            { einnahmenCents: number; ausgabenCents: number }
          >
        ) => Record<
          string,
          { einnahmenCents: number; ausgabenCents: number }
        >)
  ) {
    setOverrides((cur) =>
      typeof updater === "function" ? updater({ ...loadedMonthData, ...cur }) : updater
    )
  }

  function setRowValue(
    m: string,
    field: "einnahmenCents" | "ausgabenCents",
    value: number
  ) {
    setMonthData((cur) => ({
      ...cur,
      [m]: {
        einnahmenCents:
          field === "einnahmenCents"
            ? value
            : cur[m]?.einnahmenCents ?? 0,
        ausgabenCents:
          field === "ausgabenCents" ? value : cur[m]?.ausgabenCents ?? 0,
      },
    }))
  }

  function applyAverage() {
    const cents = parseCents(avgInput)
    if (!cents) return
    setMonthData(() => {
      const next: typeof monthData = {}
      for (const m of months) {
        next[m] = { einnahmenCents: cents, ausgabenCents: 0 }
      }
      return next
    })
    toast.success(t("vorlaeufigAvgApplied"))
  }

  // ─── Auto-Vorschlag aus Banking ───────────────────────────────────────
  const autoFromBanking = useMutation({
    mutationFn: async () => {
      // Window: last 6 calendar months ending at today's month start.
      const today = new Date()
      const endDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
      )
      const startDate = new Date(
        Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - 5, 1)
      )
      const from = startDate.toISOString().slice(0, 10)
      const to = endDate.toISOString().slice(0, 10)

      const [invRes, incomeRes, expenseRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("issue_date, total_cents, status")
          .eq("user_id", userId)
          .gte("issue_date", from)
          .lte("issue_date", to)
          .not("status", "in", '("draft","cancelled")'),
        supabase
          .from("income_entries")
          .select("occurred_on, amount_cents")
          .eq("user_id", userId)
          .eq("scope", "business")
          .eq("jobcenter_relevant", true)
          .gte("occurred_on", from)
          .lte("occurred_on", to),
        supabase
          .from("expense_entries")
          .select(
            "occurred_on, amount_cents, is_deductible, category:categories(is_jobcenter_relevant)"
          )
          .eq("user_id", userId)
          .eq("scope", "business")
          .gte("occurred_on", from)
          .lte("occurred_on", to),
      ])

      type ExpRow = {
        occurred_on: string
        amount_cents: number
        is_deductible: boolean
        category: { is_jobcenter_relevant: boolean } | null
      }

      let einnahmenSum = 0
      let ausgabenSum = 0
      for (const inv of invRes.data ?? []) {
        einnahmenSum += (inv.total_cents as number) ?? 0
      }
      for (const e of incomeRes.data ?? []) {
        einnahmenSum += (e.amount_cents as number) ?? 0
      }
      for (const e of (expenseRes.data ?? []) as unknown as ExpRow[]) {
        if (!e.is_deductible) continue
        if (e.category && e.category.is_jobcenter_relevant === false) continue
        ausgabenSum += e.amount_cents
      }
      const divisor = 6
      const avgEinnahmen = Math.round(einnahmenSum / divisor)
      const avgAusgaben = Math.round(ausgabenSum / divisor)
      return { avgEinnahmen, avgAusgaben }
    },
    onSuccess: ({ avgEinnahmen, avgAusgaben }) => {
      setMonthData(() => {
        const next: typeof monthData = {}
        for (const m of months) {
          next[m] = {
            einnahmenCents: avgEinnahmen,
            ausgabenCents: avgAusgaben,
          }
        }
        return next
      })
      toast.success(
        t("vorlaeufigAutoApplied", {
          einnahmen: formatMoney(avgEinnahmen),
          ausgaben: formatMoney(avgAusgaben),
        })
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ─── Smart Fill: when redirected from the document-upload dialog with
  // ?from_doc=1, auto-trigger the banking-based prefill exactly once.
  const fromDocRanRef = React.useRef(false)
  React.useEffect(() => {
    if (!fromDoc) return
    if (fromDocRanRef.current) return
    if (months.length === 0) return
    fromDocRanRef.current = true
    autoFromBanking.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDoc, months.length])

  // ─── Persistence ─────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!bwzStart || !bwzEnd) throw new Error("BWZ not set")
      const rows: EksPrognoseMonth[] = months.map((m) => ({
        month: m,
        einnahmenCents: monthData[m]?.einnahmenCents ?? 0,
        ausgabenCents: monthData[m]?.ausgabenCents ?? 0,
      }))
      const totalEinnahmen = rows.reduce((s, r) => s + r.einnahmenCents, 0)
      const totalAusgaben = rows.reduce((s, r) => s + r.ausgabenCents, 0)
      const totalSaldo = Math.max(0, totalEinnahmen - totalAusgaben)
      const payload: EksPrognosePayload = { months: rows }

      // Upsert: try update existing first, then insert.
      const existing = await supabase
        .from("jobcenter_reports")
        .select("id")
        .eq("user_id", userId)
        .eq("kind", "vorlaeufig")
        .eq("period_start", bwzStart)
        .eq("period_end", bwzEnd)
        .maybeSingle()

      if (existing.data?.id) {
        const { error } = await supabase
          .from("jobcenter_reports")
          .update({
            income_cents: totalEinnahmen,
            expenses_cents: totalAusgaben,
            net_cents: totalSaldo,
            prognose_payload: payload,
            payload: {} as Record<string, unknown>,
            status: "draft",
          })
          .eq("id", existing.data.id)
        if (error) throw error
        return existing.data.id as string
      }

      const { data, error } = await supabase
        .from("jobcenter_reports")
        .insert({
          user_id: userId,
          period_start: bwzStart,
          period_end: bwzEnd,
          kind: "vorlaeufig",
          income_cents: totalEinnahmen,
          expenses_cents: totalAusgaben,
          net_cents: totalSaldo,
          prognose_payload: payload,
          payload: {} as Record<string, unknown>,
          status: "draft",
        })
        .select("id")
        .single()
      if (error) throw error
      return data!.id as string
    },
    onSuccess: () => {
      toast.success(t("vorlaeufigSaved"))
      queryClient.invalidateQueries({
        queryKey: ["jobcenter-vorlaeufig", userId, bwzStart, bwzEnd],
      })
      queryClient.invalidateQueries({ queryKey: ["jobcenter-comparison"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ─── Totals + warning ────────────────────────────────────────────────
  const totals = React.useMemo(() => {
    let einnahmen = 0
    let ausgaben = 0
    for (const m of months) {
      einnahmen += monthData[m]?.einnahmenCents ?? 0
      ausgaben += monthData[m]?.ausgabenCents ?? 0
    }
    const saldo = Math.max(0, einnahmen - ausgaben)
    return {
      einnahmen,
      ausgaben,
      saldo,
      avg: months.length > 0 ? Math.round(saldo / months.length) : 0,
    }
  }, [months, monthData])

  const ANRECHNUNG_THRESHOLD_PER_MONTH = 100_000 // 1.000 € / month after which anrechnung kicks in beyond Grundfreibetrag
  const hitAnrechnung = totals.avg > ANRECHNUNG_THRESHOLD_PER_MONTH

  const pdfUrl = `/api/reports/eks-vorlaeufig?from=${bwzStart}&to=${bwzEnd}`

  return (
    <div className="grid gap-4">
      {/* ─── Header info ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="size-4" />
            {t("vorlaeufigTitle")}
          </CardTitle>
          <CardDescription>{t("vorlaeufigHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* ─── BWZ pickers + actions ────────────────────────────── */}
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("bwzStart")}
              </label>
              <Input
                type="date"
                value={bwzStart}
                onChange={(e) => setBwzStart(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("bwzEnd")}
              </label>
              <Input
                type="date"
                value={bwzEnd}
                onChange={(e) => setBwzEnd(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => autoFromBanking.mutate()}
                disabled={autoFromBanking.isPending || months.length === 0}
              >
                {autoFromBanking.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                {t("autoFromBanking")}
              </Button>
            </div>
          </div>

          {/* ─── Average prefill ──────────────────────────────────── */}
          <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("averagePerMonth")}
              </label>
              <div className="relative">
                <Input
                  value={avgInput}
                  onChange={(e) => setAvgInput(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="font-mono pr-7 text-right"
                />
                <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                  €
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={applyAverage}
              disabled={!avgInput || months.length === 0}
            >
              <RefreshCw />
              {t("vorlaeufigApplyAvg")}
            </Button>
          </div>

          {/* ─── Per-month rows ───────────────────────────────────── */}
          {months.length === 0 ? (
            <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{t("vorlaeufigNoMonths")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("colMonth")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("monthEstimateIncome")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("monthEstimateExpense")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("monthSaldo")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {months.map((m) => {
                    const row = monthData[m]
                    const einnahmen = row?.einnahmenCents ?? 0
                    const ausgaben = row?.ausgabenCents ?? 0
                    const saldo = Math.max(0, einnahmen - ausgaben)
                    return (
                      <tr key={m} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">
                          {m.slice(0, 7)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            value={formatEditable(einnahmen)}
                            onChange={(e) =>
                              setRowValue(
                                m,
                                "einnahmenCents",
                                parseCents(e.target.value)
                              )
                            }
                            placeholder="0,00"
                            className="h-8 w-28 ml-auto font-mono text-right text-xs"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            value={formatEditable(ausgaben)}
                            onChange={(e) =>
                              setRowValue(
                                m,
                                "ausgabenCents",
                                parseCents(e.target.value)
                              )
                            }
                            placeholder="0,00"
                            className="h-8 w-28 ml-auto font-mono text-right text-xs"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          {formatMoney(saldo)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 border-t-2 font-semibold">
                    <td className="px-3 py-2 flex items-center gap-1.5">
                      <Sigma className="size-3.5" />
                      {t("colTotal")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatMoney(totals.einnahmen)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatMoney(totals.ausgaben)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatMoney(totals.saldo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ─── Summary card ─────────────────────────────────────── */}
          {months.length > 0 ? (
            <div className="grid gap-2 rounded-xl border bg-blue-500/5 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t("vorlaeufigTotalYear")}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {formatMoney(totals.saldo)}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t("vorlaeufigAvgMonth")}
                </span>
                <span className="font-mono tabular-nums">
                  {formatMoney(totals.avg)}
                </span>
              </div>
              {hitAnrechnung ? (
                <p className="text-amber-700 dark:text-amber-400 text-xs">
                  {t("vorlaeufigThresholdWarn")}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ─── Actions ──────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || months.length === 0}
            >
              {saveMut.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save />
              )}
              {t("saveVorlaeufig")}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <FileDown />
                {t("vorlaeufigPdfDownload")}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
