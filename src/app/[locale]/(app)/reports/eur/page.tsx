import { getTranslations, setRequestLocale } from "next-intl/server"
import { format, startOfYear, endOfYear } from "date-fns"
import { Download, FileSpreadsheet, Info } from "lucide-react"

import { Button } from "@/components/ui/button"

import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
} from "@/types/database.types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default async function EurPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ year?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Finances" })

  const sp = (await searchParams) ?? {}
  const year = sp.year ? Number(sp.year) : new Date().getFullYear()
  const from = format(startOfYear(new Date(year, 0, 1)), "yyyy-MM-dd")
  const to = format(endOfYear(new Date(year, 0, 1)), "yyyy-MM-dd")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [invRes, incomeRes, expenseRes, catRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, total_cents, subtotal_cents, vat_cents, issue_date, status, is_kleinunternehmer_at_issue")
      .eq("user_id", user!.id)
      .gte("issue_date", from)
      .lte("issue_date", to)
      .not("status", "in", '("draft","cancelled")'),
    supabase
      .from("income_entries")
      .select("amount_cents")
      .eq("user_id", user!.id)
      .eq("scope", "business")
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("expense_entries")
      .select("id, amount_cents, category_id, is_deductible, vat_cents, private_share_pct")
      .eq("user_id", user!.id)
      .eq("scope", "business")
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase.from("categories").select("*").eq("user_id", user!.id),
  ])

  const invoices = (invRes.data ?? []) as Invoice[]
  const income = (incomeRes.data ?? []) as Pick<IncomeEntry, "amount_cents">[]
  const expenses = (expenseRes.data ?? []) as Pick<
    ExpenseEntry,
    "id" | "amount_cents" | "category_id" | "is_deductible" | "vat_cents" | "private_share_pct"
  >[]
  const categories = (catRes.data ?? []) as Category[]

  const catById = new Map(categories.map((c) => [c.id, c]))

  const invoiceRevenue = invoices.reduce((s, i) => s + i.total_cents, 0)
  const invoiceVat = invoices.reduce((s, i) => s + i.vat_cents, 0)
  const invoiceNet = invoices.reduce((s, i) => s + i.subtotal_cents, 0)
  const extraRevenue = income.reduce((s, e) => s + e.amount_cents, 0)
  const totalRevenue = invoiceRevenue + extraRevenue

  const byCategory = new Map<string, { name: string; skr: string; sum: number }>()
  let totalExpenseDeductible = 0
  for (const e of expenses) {
    if (!e.is_deductible) continue
    const c = e.category_id ? catById.get(e.category_id) : null
    const privateShare = Number(e.private_share_pct ?? 0) / 100
    const eff = Math.round(e.amount_cents * (1 - privateShare))
    totalExpenseDeductible += eff
    const key = c?.id ?? "_uncategorized"
    const row = byCategory.get(key) ?? {
      name: c?.name ?? "Unkategorisiert",
      skr: c?.skr_code ?? "",
      sum: 0,
    }
    row.sum += eff
    byCategory.set(key, row)
  }

  const profit = totalRevenue - totalExpenseDeductible

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("eurTitle", { year })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("eurSubtitle")}
          </p>
        </div>
        <Button asChild>
          <a
            href={`/api/reports/eur?year=${year}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download />
            {t("eurDownloadPdf")}
          </a>
        </Button>
      </header>

      <div className="bg-blue-500/10 text-blue-700 dark:text-blue-400 flex items-start gap-3 rounded-xl border border-blue-500/20 p-3 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          {t("eurDisclaimer")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("eurRevenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalRevenue)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("eurNetVatHint", {
                net: formatMoney(invoiceNet),
                vat: formatMoney(invoiceVat),
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("eurExpenses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {formatMoney(totalExpenseDeductible)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("eurDeductibleCount", {
                count: expenses.filter((e) => e.is_deductible).length,
              })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("eurProfit")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {formatMoney(profit)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("eurBeforeIncomeTax")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4" />
            {t("eurByCategoryTitle")}
          </CardTitle>
          <CardDescription>
            {t("eurByCategoryHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {byCategory.size === 0 ? (
            <p className="text-muted-foreground text-center text-sm">
              {t("eurNoExpensesInRange")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("eurColCategory")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("eurColSkr")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("eurColSum")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byCategory.values()]
                    .sort((a, b) => b.sum - a.sum)
                    .map((row) => (
                      <tr key={row.name} className="border-t">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                          {row.skr || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {formatMoney(row.sum)}
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      {t("eurTotal")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatMoney(totalExpenseDeductible)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-muted-foreground text-xs">
        {t("eurFootnote")}
      </p>
    </div>
  )
}
