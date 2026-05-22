import { getTranslations, setRequestLocale } from "next-intl/server"
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  subMonths,
} from "date-fns"
import { de, enUS, ru, uk } from "date-fns/locale"
import { Info } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import type {
  ExpenseEntry,
  IncomeEntry,
  Invoice,
  Settings,
} from "@/types/database.types"
import { JobcenterRechner } from "@/components/dashboards/jobcenter-rechner"
import { EksRangeReport } from "@/components/dashboards/eks-range-report"
import { EksVorlaeufigForm } from "@/components/jobcenter/eks-vorlaeufig-form"
import { EksComparison } from "@/components/jobcenter/eks-comparison"
import { JobcenterDocumentUploadDialog } from "@/components/jobcenter/document-upload-dialog"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const DATEFNS_LOCALES: Record<string, typeof de> = {
  de,
  en: enUS,
  ru,
  uk,
}

function isValidISO(s: string | undefined | null): s is string {
  if (!s) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/**
 * Compute the default reporting window:
 *   1. If BWZ is set in settings, use that.
 *   2. Otherwise, last 7 months ending at the previous month-end
 *      (matches the typical Anlage-EKS Bewilligungszeitraum).
 */
function defaultRange(
  bwzStart: string | null | undefined,
  bwzEnd: string | null | undefined
): { from: string; to: string } {
  if (isValidISO(bwzStart) && isValidISO(bwzEnd)) {
    return { from: bwzStart!, to: bwzEnd! }
  }
  const now = new Date()
  const end = endOfMonth(now)
  const start = startOfMonth(subMonths(now, 6))
  return {
    from: format(start, "yyyy-MM-dd"),
    to: format(end, "yyyy-MM-dd"),
  }
}

function bwzMonths(startISO: string, endISO: string): string[] {
  const out: string[] = []
  const s = parseISO(startISO)
  const e = parseISO(endISO)
  const cursor = startOfMonth(s)
  while (cursor <= e) {
    out.push(format(cursor, "yyyy-MM-dd"))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out
}

export default async function JobcenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{
    month?: string
    from?: string
    to?: string
    tab?: string
    from_doc?: string
  }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Jobcenter" })

  const sp = (await searchParams) ?? {}

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ─── Settings (für BWZ + Bedarf) ─────────────────────────────────────────
  const settingsRes = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .single()
  const settings = settingsRes.data as Settings | null

  // Period resolution: ?from/?to wins, then ?month (single), then BWZ, then default 7mo.
  let periodStart: string
  let periodEnd: string
  if (isValidISO(sp.from) && isValidISO(sp.to)) {
    periodStart = sp.from!
    periodEnd = sp.to!
  } else if (sp.month) {
    const base = parseISO(`${sp.month}-01`)
    periodStart = format(startOfMonth(base), "yyyy-MM-dd")
    periodEnd = format(endOfMonth(base), "yyyy-MM-dd")
  } else {
    const r = defaultRange(
      settings?.bewilligungszeitraum_start,
      settings?.bewilligungszeitraum_end
    )
    periodStart = r.from
    periodEnd = r.to
  }

  // ─── BWZ-Ist (für Rechner) — bleibt wie gehabt, falls BWZ gepflegt ──────
  let bwzIst: { month: string; einkommenCents: number }[] = []
  if (settings?.bewilligungszeitraum_start && settings?.bewilligungszeitraum_end) {
    const bwzStart = settings.bewilligungszeitraum_start
    const bwzEnd = settings.bewilligungszeitraum_end
    const [bwzInv, bwzExtra, bwzExp] = await Promise.all([
      supabase
        .from("invoices")
        .select("issue_date, total_cents, status")
        .eq("user_id", user!.id)
        .gte("issue_date", bwzStart)
        .lte("issue_date", bwzEnd)
        .not("status", "in", '("draft","cancelled")'),
      supabase
        .from("income_entries")
        .select("occurred_on, amount_cents, jobcenter_relevant")
        .eq("user_id", user!.id)
        .eq("scope", "business")
        .eq("jobcenter_relevant", true)
        .gte("occurred_on", bwzStart)
        .lte("occurred_on", bwzEnd),
      supabase
        .from("expense_entries")
        .select(
          "occurred_on, amount_cents, is_deductible, category:categories(is_jobcenter_relevant)"
        )
        .eq("user_id", user!.id)
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
    const map = new Map<string, number>()
    for (const i of bwzInv.data ?? []) {
      const k = monthKey(i.issue_date as string)
      map.set(k, (map.get(k) ?? 0) + (i.total_cents as number))
    }
    for (const e of bwzExtra.data ?? []) {
      const k = monthKey(e.occurred_on as string)
      map.set(k, (map.get(k) ?? 0) + (e.amount_cents as number))
    }
    for (const e of (bwzExp.data ?? []) as unknown as ExpRow[]) {
      if (!e.is_deductible) continue
      if (e.category && e.category.is_jobcenter_relevant === false) continue
      const k = monthKey(e.occurred_on)
      map.set(k, (map.get(k) ?? 0) - e.amount_cents)
    }
    bwzIst = [...map.entries()]
      .map(([month, einkommenCents]) => ({
        month,
        einkommenCents: Math.max(0, einkommenCents),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  // ─── Daten für Zeitraum-Report ───────────────────────────────────────────
  const [invRes, incomeRes, expensesRes, bankBuergergeldRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, number, issue_date, total_cents, status, locked_at, is_kleinunternehmer_at_issue"
      )
      .eq("user_id", user!.id)
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd)
      .not("status", "in", '("draft","cancelled")'),
    supabase
      .from("income_entries")
      .select(
        "id, occurred_on, amount_cents, description, source, jobcenter_relevant, scope, category_id"
      )
      .eq("user_id", user!.id)
      .gte("occurred_on", periodStart)
      .lte("occurred_on", periodEnd),
    supabase
      .from("expense_entries")
      .select(
        "id, occurred_on, amount_cents, vendor, description, is_deductible, scope, category_id, category:categories(name, is_jobcenter_relevant, skr_code)"
      )
      .eq("user_id", user!.id)
      .gte("occurred_on", periodStart)
      .lte("occurred_on", periodEnd),
    supabase
      .from("bank_transactions")
      .select("booking_date, amount_cents, counterparty_name, is_buergergeld")
      .eq("user_id", user!.id)
      .eq("is_buergergeld", true)
      .eq("is_transfer", false)
      .gte("booking_date", periodStart)
      .lte("booking_date", periodEnd),
  ])

  const invoices = (invRes.data ?? []) as Invoice[]
  const allIncome = (incomeRes.data ?? []) as IncomeEntry[]
  const allExpenses = (expensesRes.data ?? []) as unknown as (ExpenseEntry & {
    category?: {
      name: string
      is_jobcenter_relevant: boolean
      skr_code: string | null
    } | null
  })[]
  type BTBG = {
    booking_date: string
    amount_cents: number
    counterparty_name: string | null
    is_buergergeld: boolean
  }
  const bankBuergergeld = (bankBuergergeldRes.data ?? []) as BTBG[]

  const months = bwzMonths(periodStart, periodEnd)

  const dfLocale = DATEFNS_LOCALES[locale] ?? de
  const rangeLabel = `${format(parseISO(periodStart), "MMM yyyy", { locale: dfLocale })} – ${format(parseISO(periodEnd), "MMM yyyy", { locale: dfLocale })}`

  // Detect any data outside the typical Aug 2025–Feb 2026 EKS window? The
  // user-facing "did we capture everything?" hint relies on having any
  // banking row imported.
  const hasAnyData = invoices.length + allIncome.length + allExpenses.length > 0

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("subtitleRange", { range: rangeLabel })}
          </p>
        </div>
      </header>

      <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-start gap-3 rounded-xl border border-blue-500/20 p-3 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">{t("infoTitle")}</p>
          <p>{t("infoBody")}</p>
        </div>
      </div>

      {/* ─── AI Jobcenter Document Parser ──────────────────────────────── */}
      <section className="bg-card grid gap-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold">{t("documentsTitle")}</h2>
            <p className="text-muted-foreground max-w-2xl text-xs">
              {t("documentsHint")}
            </p>
          </div>
          <JobcenterDocumentUploadDialog
            currentBwzStart={settings?.bewilligungszeitraum_start ?? null}
            currentBwzEnd={settings?.bewilligungszeitraum_end ?? null}
          />
        </div>
      </section>

      <Tabs
        defaultValue={
          sp.tab === "vorlaeufig" || sp.tab === "vergleich"
            ? sp.tab
            : "endgueltig"
        }
        className="gap-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="vorlaeufig">{t("tabVorlaeufig")}</TabsTrigger>
          <TabsTrigger value="endgueltig">{t("tabEndgueltig")}</TabsTrigger>
          <TabsTrigger value="vergleich">{t("tabVergleich")}</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Vorläufige Anlage EKS (start of BWZ) ──────────────── */}
        <TabsContent value="vorlaeufig" className="grid gap-4">
          <EksVorlaeufigForm settings={settings} userId={user!.id} />
        </TabsContent>

        {/* ─── Tab 2: Endgültige Anlage EKS (existing range report) ─────── */}
        <TabsContent value="endgueltig" className="grid gap-4">
          <EksRangeReport
            periodStart={periodStart}
            periodEnd={periodEnd}
            months={months}
            invoices={invoices}
            income={allIncome}
            expenses={allExpenses}
            bankBuergergeld={bankBuergergeld}
            bwzStart={settings?.bewilligungszeitraum_start ?? null}
            bwzEnd={settings?.bewilligungszeitraum_end ?? null}
            hasMinorChildren={settings?.has_minor_children ?? false}
            bedarfMonatlichCents={
              settings?.buergergeld_bedarf_monatlich_cents ?? null
            }
            locale={locale}
          />

          {settings ? (
            <JobcenterRechner settings={settings} istEinkommen={bwzIst} />
          ) : null}

          {!hasAnyData ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">
                {t("noIncomeInRange")}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* ─── Tab 3: Vergleich Prognose ↔ Ist ──────────────────────────── */}
        <TabsContent value="vergleich" className="grid gap-4">
          <EksComparison settings={settings} userId={user!.id} />
        </TabsContent>
      </Tabs>

      <p className="text-muted-foreground text-xs">{t("footerNote")}</p>
    </div>
  )
}
