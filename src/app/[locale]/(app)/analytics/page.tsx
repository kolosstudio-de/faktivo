import { getTranslations, setRequestLocale } from "next-intl/server"
import { LineChart } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client"
import type {
  Category,
  Client,
  ExpenseEntry,
  IncomeEntry,
  Invoice,
} from "@/types/database.types"

interface ClientWithStats extends Client {
  invoiceCount: number
  totalRevenue: number
  paidRevenue: number
  outstandingRevenue: number
  lastInvoiceDate: string | null
  avgInvoice: number
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Analytics" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch 24 months back to allow YoY comparison + this year up to today
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 24)
  const cutoffISO = cutoff.toISOString().slice(0, 10)

  const [invRes, expensesRes, incomeRes, clientsRes, categoriesRes] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, number, client_id, issue_date, total_cents, paid_cents, status, locked_at, currency"
        )
        .eq("user_id", user!.id)
        .gte("issue_date", cutoffISO)
        .not("status", "in", '("draft","cancelled")'),
      supabase
        .from("expense_entries")
        .select(
          "id, scope, occurred_on, amount_cents, vendor, category_id, payment_method, vat_rate, is_deductible, is_kfz_pauschale, recurring_source_id, description"
        )
        .eq("user_id", user!.id)
        .gte("occurred_on", cutoffISO),
      supabase
        .from("income_entries")
        .select("id, scope, occurred_on, amount_cents, source, category_id")
        .eq("user_id", user!.id)
        .gte("occurred_on", cutoffISO),
      supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id)
        .is("archived_at", null),
      supabase
        .from("categories")
        .select("*")
        .eq("user_id", user!.id),
    ])

  const invoices = (invRes.data ?? []) as Pick<
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
  >[]
  const expenses = (expensesRes.data ?? []) as ExpenseEntry[]
  const income = (incomeRes.data ?? []) as IncomeEntry[]
  const clientsRaw = (clientsRes.data ?? []) as Client[]
  const categories = (categoriesRes.data ?? []) as Category[]

  // ─── Per-client stats (from invoices) ─────────────────────────────────
  const clientStatsMap = new Map<
    string,
    {
      invoiceCount: number
      totalRevenue: number
      paidRevenue: number
      outstandingRevenue: number
      lastInvoiceDate: string | null
    }
  >()
  for (const inv of invoices) {
    const cur = clientStatsMap.get(inv.client_id) ?? {
      invoiceCount: 0,
      totalRevenue: 0,
      paidRevenue: 0,
      outstandingRevenue: 0,
      lastInvoiceDate: null,
    }
    cur.invoiceCount++
    cur.totalRevenue += inv.total_cents
    cur.paidRevenue += inv.paid_cents
    cur.outstandingRevenue += Math.max(0, inv.total_cents - inv.paid_cents)
    if (
      !cur.lastInvoiceDate ||
      inv.issue_date > cur.lastInvoiceDate
    ) {
      cur.lastInvoiceDate = inv.issue_date
    }
    clientStatsMap.set(inv.client_id, cur)
  }
  const clients: ClientWithStats[] = clientsRaw.map((c) => {
    const s = clientStatsMap.get(c.id) ?? {
      invoiceCount: 0,
      totalRevenue: 0,
      paidRevenue: 0,
      outstandingRevenue: 0,
      lastInvoiceDate: null,
    }
    return {
      ...c,
      ...s,
      avgInvoice:
        s.invoiceCount > 0 ? Math.round(s.totalRevenue / s.invoiceCount) : 0,
    }
  })

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <LineChart className="size-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </header>

      <AnalyticsPageClient
        invoices={invoices}
        expenses={expenses}
        income={income}
        categories={categories}
        clients={clients}
      />
    </div>
  )
}
