"use client"

/**
 * Vergleich Vorläufig ↔ Ist — die juristische Sicht auf den Bewilligungs-
 * zeitraum nach §41a SGB II.
 *
 * Lädt:
 *   - Den jüngsten `kind='vorlaeufig'`-Report aus jobcenter_reports
 *     (oder fällt zurück auf settings.vorlaeufige_prognose_jsonb).
 *   - Die tatsächlichen Einkünfte aus invoices + income_entries
 *     − jobcenter-relevante Ausgaben.
 *
 * Berechnet die Differenz via `calcRueckforderung()` und zeigt pro Monat:
 *   Prognose | Ist | Differenz | Zahlung vorläufig | Zahlung endgültig | Diff Zahlung
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { AlertTriangle, BarChart3, HeartHandshake, Info, Loader2, Scale } from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { formatMoney } from "@/lib/money"
import { calcRueckforderung, type MonthlyEinkommen } from "@/lib/jobcenter"
import type {
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

export function EksComparison({ settings, userId }: Props) {
  const t = useTranslations("Jobcenter")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  // ─── Bürgergeld nudge ───────────────────────────────────────────────
  // If the user has bank_transactions flagged as Bürgergeld but no
  // corresponding income_entries, the EKS Vergleich silently shows 0 €
  // received from the Jobcenter. Surface a one-click backfill instead.
  const buergergeldNudgeQuery = useQuery({
    queryKey: ["buergergeld-nudge", userId],
    queryFn: async () => {
      const flagsRes = await supabase
        .from("bank_transactions")
        .select("id, amount_cents, income_entry_id, expense_entry_id, payment_id")
        .eq("user_id", userId)
        .eq("is_buergergeld", true)
        .eq("is_transfer", false)
      const flagged = (flagsRes.data ?? []) as Array<{
        id: string
        amount_cents: number
        income_entry_id: string | null
        expense_entry_id: string | null
        payment_id: string | null
      }>
      const unMaterialized = flagged.filter(
        (t) =>
          t.amount_cents > 0 &&
          !t.income_entry_id &&
          !t.expense_entry_id &&
          !t.payment_id,
      )
      return {
        flaggedCount: flagged.length,
        unMaterializedCount: unMaterialized.length,
        unMaterializedSumCents: unMaterialized.reduce(
          (s, t) => s + Math.abs(t.amount_cents),
          0,
        ),
      }
    },
  })

  const detectBuergergeldMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/banking/detect-buergergeld", {
        method: "POST",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "detect failed")
      }
      return (await r.json()) as { flagged: number; materialized: number }
    },
    onSuccess: (res) => {
      toast.success(
        t("buergergeldBackfillToast", {
          flagged: res.flagged,
          materialized: res.materialized,
        }),
      )
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
      queryClient.invalidateQueries({ queryKey: ["buergergeld-nudge"] })
      queryClient.invalidateQueries({ queryKey: ["jobcenter-comparison"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bwzStart = settings?.bewilligungszeitraum_start ?? ""
  const bwzEnd = settings?.bewilligungszeitraum_end ?? ""
  const months = React.useMemo(
    () => bwzMonths(bwzStart, bwzEnd),
    [bwzStart, bwzEnd]
  )

  // Manual bedarf override — defaults to settings, re-init on settings change.
  // Documented React pattern for syncing local state with prop changes:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const settingsBedarf = settings?.buergergeld_bedarf_monatlich_cents ?? 0
  const [bedarfOverride, setBedarfOverride] = React.useState<number>(
    settingsBedarf
  )
  const [lastSettingsBedarf, setLastSettingsBedarf] =
    React.useState<number>(settingsBedarf)
  if (lastSettingsBedarf !== settingsBedarf) {
    setLastSettingsBedarf(settingsBedarf)
    setBedarfOverride(settingsBedarf)
  }

  const hasMinorChildren = settings?.has_minor_children ?? false

  // ─── Load latest vorläufig report for this BWZ ───────────────────────
  const vorlaeufigQuery = useQuery({
    queryKey: ["jobcenter-comparison", "vorlaeufig", userId, bwzStart, bwzEnd],
    enabled: !!bwzStart && !!bwzEnd,
    queryFn: async () => {
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

  // ─── Load actual data (invoices + income − jobcenter-relevant expenses) ─
  const istQuery = useQuery({
    queryKey: ["jobcenter-comparison", "ist", userId, bwzStart, bwzEnd],
    enabled: !!bwzStart && !!bwzEnd,
    queryFn: async () => {
      const [invRes, incomeRes, expenseRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("issue_date, total_cents, status")
          .eq("user_id", userId)
          .gte("issue_date", bwzStart)
          .lte("issue_date", bwzEnd)
          .not("status", "in", '("draft","cancelled")'),
        supabase
          .from("income_entries")
          .select("occurred_on, amount_cents")
          .eq("user_id", userId)
          .eq("scope", "business")
          .eq("jobcenter_relevant", true)
          .gte("occurred_on", bwzStart)
          .lte("occurred_on", bwzEnd),
        supabase
          .from("expense_entries")
          .select(
            "occurred_on, amount_cents, is_deductible, category:categories(is_jobcenter_relevant)"
          )
          .eq("user_id", userId)
          .eq("scope", "business")
          .gte("occurred_on", bwzStart)
          .lte("occurred_on", bwzEnd),
      ])

      type ExpRow = {
        occurred_on: string
        amount_cents: number
        is_deductible: boolean
        category: { is_jobcenter_relevant: boolean } | null
      }
      const monthKey = (d: string) => d.slice(0, 7) + "-01"
      const map = new Map<string, number>(months.map((m) => [m, 0]))
      for (const i of invRes.data ?? []) {
        const k = monthKey(i.issue_date as string)
        if (map.has(k)) {
          map.set(k, (map.get(k) ?? 0) + (i.total_cents as number))
        }
      }
      for (const e of incomeRes.data ?? []) {
        const k = monthKey(e.occurred_on as string)
        if (map.has(k)) {
          map.set(k, (map.get(k) ?? 0) + (e.amount_cents as number))
        }
      }
      for (const e of (expenseRes.data ?? []) as unknown as ExpRow[]) {
        if (!e.is_deductible) continue
        if (e.category && e.category.is_jobcenter_relevant === false) continue
        const k = monthKey(e.occurred_on)
        if (map.has(k)) {
          map.set(k, (map.get(k) ?? 0) - e.amount_cents)
        }
      }
      return months.map((m) => ({
        month: m,
        einkommenCents: Math.max(0, map.get(m) ?? 0),
      }))
    },
  })

  // ─── Combine into RueckforderungResult ───────────────────────────────
  const result = React.useMemo(() => {
    if (!bedarfOverride || months.length === 0) return null
    const ist: MonthlyEinkommen[] =
      istQuery.data ??
      months.map((m) => ({ month: m, einkommenCents: 0 }))

    // Prognose: from saved report > settings.vorlaeufige_prognose_jsonb > 0
    const reportPayload = vorlaeufigQuery.data?.prognose_payload as
      | EksPrognosePayload
      | null
    let prognose: MonthlyEinkommen[]
    if (reportPayload?.months?.length) {
      const map = new Map<string, number>()
      for (const m of reportPayload.months) {
        map.set(
          m.month,
          Math.max(0, m.einnahmenCents - m.ausgabenCents)
        )
      }
      prognose = months.map((m) => ({
        month: m,
        einkommenCents: map.get(m) ?? 0,
      }))
    } else {
      const legacy = (settings?.vorlaeufige_prognose_jsonb ?? {}) as Record<
        string,
        number
      >
      prognose = months.map((m) => ({
        month: m,
        einkommenCents: legacy[m] ?? 0,
      }))
    }

    return calcRueckforderung({
      bedarfMonatlichCents: bedarfOverride,
      prognose,
      ist,
      hasMinorChildren,
    })
  }, [
    bedarfOverride,
    months,
    istQuery.data,
    vorlaeufigQuery.data,
    settings?.vorlaeufige_prognose_jsonb,
    hasMinorChildren,
  ])

  // ─── Render guards ───────────────────────────────────────────────────
  if (!bwzStart || !bwzEnd) {
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{t("comparisonNoBwz")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const saldo = result?.saldoCents ?? 0
  const isRueckforderung = saldo > 0
  const isNachzahlung = saldo < 0

  const showBuergergeldNudge =
    buergergeldNudgeQuery.data &&
    buergergeldNudgeQuery.data.unMaterializedCount > 0

  return (
    <div className="grid gap-4">
      {/* ─── Bürgergeld nudge ─────────────────────────────────────────── */}
      {showBuergergeldNudge ? (
        <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <HeartHandshake className="mt-0.5 size-5 text-blue-600 dark:text-blue-400" />
              <div className="grid gap-0.5">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {t("buergergeldNudgeTitle", {
                    count:
                      buergergeldNudgeQuery.data.unMaterializedCount,
                  })}
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                  {t("buergergeldNudgeHint", {
                    amount: formatMoney(
                      buergergeldNudgeQuery.data.unMaterializedSumCents,
                    ),
                  })}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => detectBuergergeldMut.mutate()}
              disabled={detectBuergergeldMut.isPending}
            >
              {detectBuergergeldMut.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <HeartHandshake />
              )}
              {t("buergergeldNudgeButton")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* ─── Summary card ─────────────────────────────────────────────── */}
      {result ? (
        <Card
          className={
            isRueckforderung
              ? "border-rose-500/40 bg-rose-500/5"
              : isNachzahlung
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-muted bg-muted/30"
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="size-4" />
              {isRueckforderung
                ? t("rueckforderung")
                : isNachzahlung
                  ? t("nachzahlung")
                  : t("comparisonBalanced")}
            </CardTitle>
            <CardDescription>{t("comparisonHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`font-mono text-3xl font-semibold tabular-nums ${
                isRueckforderung
                  ? "text-rose-600 dark:text-rose-400"
                  : isNachzahlung
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
              }`}
            >
              {formatMoney(Math.abs(saldo))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {isRueckforderung
                ? t("rueckforderungExplain", {
                    amount: formatMoney(Math.abs(saldo)),
                  })
                : isNachzahlung
                  ? t("nachzahlungExplain", {
                      amount: formatMoney(Math.abs(saldo)),
                    })
                  : t("comparisonBalancedExplain")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Bedarf input ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" />
            {t("comparisonTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("monthlyBedarf")}
              </label>
              <div className="relative">
                <Input
                  value={formatEditable(bedarfOverride)}
                  onChange={(e) =>
                    setBedarfOverride(parseCents(e.target.value))
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  className="font-mono pr-7 text-right"
                />
                <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                  €
                </span>
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("hasMinorChildren")}
              </label>
              <p className="text-muted-foreground text-xs">
                {hasMinorChildren
                  ? t("comparisonMinorChildrenYes")
                  : t("comparisonMinorChildrenNo")}
              </p>
            </div>
          </div>

          {bedarfOverride === 0 ? (
            <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{t("comparisonNoBedarf")}</p>
            </div>
          ) : null}

          {/* ─── Per-month table ─────────────────────────────────── */}
          {result ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("colMonth")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("colPrognose")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("colIst")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("colDifferenz")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("colZahlungVorlaeufig")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("colZahlungEndgueltig")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("colDiffZahlung")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.rows.map((r) => {
                    const diffEinkommen =
                      r.istEinkommenCents - r.prognoseEinkommenCents
                    return (
                      <tr key={r.month} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">
                          {r.month.slice(0, 7)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(r.prognoseEinkommenCents)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(r.istEinkommenCents)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums ${
                            diffEinkommen > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : diffEinkommen < 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {diffEinkommen > 0 ? "+" : ""}
                          {formatMoney(diffEinkommen)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-muted-foreground">
                          {formatMoney(r.zahlungVorlaeufigCents)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(r.zahlungEndgueltigCents)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums font-semibold ${
                            r.diffCents > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : r.diffCents < 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {r.diffCents > 0 ? "+" : ""}
                          {formatMoney(r.diffCents)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 border-t-2 font-semibold">
                    <td className="px-3 py-2">{t("colTotal")}</td>
                    <td
                      className="px-3 py-2 text-right font-mono tabular-nums"
                      colSpan={3}
                    >
                      —
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatMoney(result.totalVorlaeufigCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatMoney(result.totalEndgueltigCents)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        result.saldoCents > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : result.saldoCents < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : ""
                      }`}
                    >
                      {result.saldoCents > 0 ? "+" : ""}
                      {formatMoney(result.saldoCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : null}

          {/* ─── Methodology footer ──────────────────────────────── */}
          <div className="bg-amber-500/5 text-muted-foreground flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs leading-relaxed">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              {t("comparisonMethodology")}{" "}
              <a
                href="https://www.gesetze-im-internet.de/sgb_2/__41a.html"
                target="_blank"
                rel="noreferrer"
                className="underline hover:no-underline"
              >
                §41a SGB II
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
