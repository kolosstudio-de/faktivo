import { getTranslations, setRequestLocale } from "next-intl/server"
import { PieChart } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { CategoriesBreakdownClient } from "@/components/categories/categories-breakdown-client"
import { NewCategoryDialog } from "@/components/categories/new-category-dialog"
import type {
  Category,
  ExpenseEntry,
  IncomeEntry,
} from "@/types/database.types"

export default async function CategoriesBreakdownPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Categories" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch ~36 months of data so previous-period comparisons (last_year,
  // last_12_months, last_7_months etc.) all have data on both sides.
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 36)
  const cutoffISO = cutoff.toISOString().slice(0, 10)

  const [catsRes, expensesRes, incomeRes] = await Promise.all([
    supabase.from("categories").select("*").eq("user_id", user!.id),
    supabase
      .from("expense_entries")
      .select("id, scope, occurred_on, amount_cents, category_id, vendor, description")
      .eq("user_id", user!.id)
      .gte("occurred_on", cutoffISO),
    supabase
      .from("income_entries")
      .select("id, scope, occurred_on, amount_cents, category_id, source, description")
      .eq("user_id", user!.id)
      .gte("occurred_on", cutoffISO),
  ])

  const categories = (catsRes.data ?? []) as Category[]
  const expenses = (expensesRes.data ?? []) as ExpenseEntry[]
  const income = (incomeRes.data ?? []) as IncomeEntry[]

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <PieChart className="size-6 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <NewCategoryDialog
          existingCategories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            scope: c.scope,
            kind: c.kind,
          }))}
        />
      </header>

      <CategoriesBreakdownClient
        categories={categories}
        expenses={expenses}
        income={income}
      />
    </div>
  )
}
