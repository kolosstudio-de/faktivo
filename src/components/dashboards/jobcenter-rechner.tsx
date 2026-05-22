"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileDown,
  Loader2,
  PiggyBank,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { Link } from "@/i18n/navigation"
import { formatMoney } from "@/lib/money"
import {
  calcAnrechenbarEinkommen,
  calcFreibetrag,
  calcRueckforderung,
} from "@/lib/jobcenter"
import {
  REGELBEDARF_2026,
  REGELBEDARF_LABELS,
  type Regelbedarfsstufe,
} from "@/lib/jobcenter/regelbedarf"
import type { Settings } from "@/types/database.types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface MonthlyIst {
  /** ISO month start, e.g. "2026-04-01" */
  month: string
  einkommenCents: number
}

interface Props {
  settings: Settings
  istEinkommen: MonthlyIst[]
}

function bwzMonths(startISO: string | null, endISO: string | null): string[] {
  if (!startISO || !endISO) return []
  const start = new Date(startISO + "T00:00:00Z")
  const end = new Date(endISO + "T00:00:00Z")
  const out: string[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
  while (cursor <= end) {
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
  return Math.round(n * 100)
}

function formatEditable(cents: number): string {
  if (!cents) return ""
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(
    cents / 100
  )
}

export function JobcenterRechner({ settings, istEinkommen }: Props) {
  const t = useTranslations("Jobcenter")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const months = React.useMemo(
    () =>
      bwzMonths(
        settings.bewilligungszeitraum_start,
        settings.bewilligungszeitraum_end
      ),
    [settings.bewilligungszeitraum_start, settings.bewilligungszeitraum_end]
  )

  const [bedarf, setBedarf] = React.useState<number>(
    settings.buergergeld_bedarf_monatlich_cents ?? 0
  )
  const [hasChild, setHasChild] = React.useState<boolean>(
    settings.has_minor_children ?? false
  )
  const [stufe, setStufe] = React.useState<Regelbedarfsstufe | null>(
    (settings.regelbedarf_stufe ?? null) as Regelbedarfsstufe | null
  )
  const [prognose, setPrognose] = React.useState<Record<string, number>>(
    () => ({ ...(settings.vorlaeufige_prognose_jsonb ?? {}) })
  )

  const istMap = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const e of istEinkommen) m[e.month] = e.einkommenCents
    return m
  }, [istEinkommen])

  const saveMut = useMutation({
    mutationFn: async () => {
      const patch: Partial<Settings> = {
        buergergeld_bedarf_monatlich_cents: bedarf || null,
        has_minor_children: hasChild,
        regelbedarf_stufe: stufe,
        vorlaeufige_prognose_jsonb: prognose,
      }
      const { error } = await supabase
        .from("settings")
        .update(patch)
        .eq("user_id", settings.user_id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t("saved"))
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const result = React.useMemo(() => {
    if (!bedarf || months.length === 0) return null
    const prognoseList = months.map((m) => ({
      month: m,
      einkommenCents: prognose[m] ?? 0,
    }))
    const istList = months.map((m) => ({
      month: m,
      einkommenCents: istMap[m] ?? 0,
    }))
    return calcRueckforderung({
      bedarfMonatlichCents: bedarf,
      prognose: prognoseList,
      ist: istList,
      hasMinorChildren: hasChild,
    })
  }, [bedarf, months, prognose, istMap, hasChild])

  const aktuellMonth = months.find(
    (m) => m === currentMonthISO()
  )

  const aktuellEinkommen = aktuellMonth ? istMap[aktuellMonth] ?? 0 : 0
  const aktuellFB = calcFreibetrag({
    einkommenCents: aktuellEinkommen,
    hasMinorChildren: hasChild,
  })
  const aktuellAnrech = calcAnrechenbarEinkommen({
    einkommenCents: aktuellEinkommen,
    hasMinorChildren: hasChild,
  })
  const aktuellAuszahlung = Math.max(0, bedarf - aktuellAnrech)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4" />
          {t("rechnerTitle")}
        </CardTitle>
        <CardDescription>
          {t("rechnerSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {/* Setup */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("rechnerStufe")}
            </label>
            <Select
              value={stufe ? String(stufe) : ""}
              onValueChange={(v) => {
                if (!v) {
                  setStufe(null)
                  return
                }
                const n = Number(v) as Regelbedarfsstufe
                setStufe(n)
                if (!bedarf) setBedarf(REGELBEDARF_2026[n])
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("rechnerStufePlaceholder")}>
                  {stufe ? t("rechnerStufeOption", { n: stufe }) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {([1, 2, 3, 4, 5, 6] as Regelbedarfsstufe[]).map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {t("rechnerStufeOption", { n: s })} — {REGELBEDARF_LABELS[s]} (
                    {formatMoney(REGELBEDARF_2026[s])})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("rechnerBedarf")}
            </label>
            <div className="relative">
              <Input
                value={formatEditable(bedarf)}
                onChange={(e) => setBedarf(parseCents(e.target.value))}
                placeholder={t("rechnerBedarfPlaceholder")}
                className="font-mono text-right pr-7"
                inputMode="decimal"
              />
              <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                €
              </span>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="grid flex-1 gap-0.5">
              <label className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {t("rechnerKids")}
              </label>
              <p className="text-muted-foreground text-[10px]">
                {t("rechnerKidsHint")}
              </p>
            </div>
            <Switch checked={hasChild} onCheckedChange={setHasChild} />
          </div>
        </div>

        {/* Aktuelle Vorschau */}
        {aktuellMonth ? (
          <div className="bg-muted/40 grid gap-2 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("currentMonth", { label: aktuellMonth.slice(0, 7) })}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Cell label={t("cellEinkommen")} value={formatMoney(aktuellEinkommen)} />
              <Cell label={t("cellFreibetrag")} value={formatMoney(aktuellFB.totalCents)} />
              <Cell label={t("cellAnrech")} value={formatMoney(aktuellAnrech)} />
              <Cell
                label={t("cellAuszahlung")}
                value={formatMoney(aktuellAuszahlung)}
                highlight
              />
            </div>
            <div className="text-muted-foreground text-[10px] leading-relaxed">
              GF {formatMoney(aktuellFB.grundfreibetragCents)} +{" "}
              Tier 1 {formatMoney(aktuellFB.tier1Cents)} +{" "}
              Tier 2 {formatMoney(aktuellFB.tier2Cents)} ={" "}
              <strong>{formatMoney(aktuellFB.totalCents)}</strong>
            </div>
          </div>
        ) : null}

        {/* BWZ Tabelle */}
        {months.length === 0 ? (
          <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-3 rounded-xl border border-amber-500/20 p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {t.rich("noBwz", {
                link: (chunks) => (
                  <Link href="/settings" className="underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        ) : (
          <>
            <Separator />
            <div className="grid gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <PiggyBank className="size-4" />
                {t("bwzTitle", {
                  from: months[0].slice(0, 7),
                  to: months[months.length - 1].slice(0, 7),
                  count: months.length,
                })}
              </h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("colMonth")}</th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("colPrognose")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">{t("colIst")}</th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("colAuszahlungVorl")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("colAuszahlungEndg")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">{t("colDiff")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const row = result?.rows.find((r) => r.month === m)
                      const diff = row?.diffCents ?? 0
                      return (
                        <tr key={m} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">
                            {m.slice(0, 7)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              value={formatEditable(prognose[m] ?? 0)}
                              onChange={(e) => {
                                setPrognose((cur) => ({
                                  ...cur,
                                  [m]: parseCents(e.target.value),
                                }))
                              }}
                              placeholder="0,00"
                              className="h-8 w-28 font-mono text-right text-xs"
                              inputMode="decimal"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                            {formatMoney(istMap[m] ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                            {row ? formatMoney(row.zahlungVorlaeufigCents) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                            {row ? formatMoney(row.zahlungEndgueltigCents) : "—"}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                              diff > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : diff < 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : ""
                            }`}
                          >
                            {row ? formatMoney(diff) : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Saldo */}
            {result ? (
              <div
                className={`grid gap-2 rounded-xl border p-4 ${
                  result.saldoCents > 0
                    ? "bg-rose-500/10 border-rose-500/30"
                    : result.saldoCents < 0
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.saldoCents > 0 ? (
                    <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                  ) : result.saldoCents < 0 ? (
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                  )}
                  <h4 className="font-semibold">
                    {result.saldoCents > 0
                      ? t("saldoRueck")
                      : result.saldoCents < 0
                        ? t("saldoNach")
                        : t("saldoBalanced")}
                  </h4>
                </div>
                <div className="font-mono text-3xl font-semibold tabular-nums">
                  {formatMoney(Math.abs(result.saldoCents))}
                </div>
                <div className="text-muted-foreground grid gap-0.5 text-xs">
                  <span>
                    {t("vorlaeufigErhalten")}{" "}
                    <strong>
                      {formatMoney(result.totalVorlaeufigCents)}
                    </strong>
                  </span>
                  <span>
                    {t("endgueltigerAnspruch")}{" "}
                    <strong>{formatMoney(result.totalEndgueltigCents)}</strong>
                  </span>
                  <span className="mt-1 text-[11px] italic">
                    {result.saldoCents > 0
                      ? t("saldoExplainRueck")
                      : result.saldoCents < 0
                        ? t("saldoExplainNach")
                        : t("saldoExplainBalanced")}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {months.length > 0 && bedarf > 0 ? (
            <Button type="button" variant="outline" asChild>
              <a
                href="/api/reports/eks-endgueltig"
                target="_blank"
                rel="noreferrer"
              >
                <FileDown />
                {t("endgEksPdf")}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            {t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Cell({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      <span
        className={`font-mono text-base font-semibold tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function currentMonthISO(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}
