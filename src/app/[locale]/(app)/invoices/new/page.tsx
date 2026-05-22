import { getTranslations, setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { DocumentForm } from "@/components/forms/document-form"
import { PlanLimitReached } from "@/components/billing/plan-limit-reached"
import { PLANS } from "@/lib/billing/plans"
import { formatMoney } from "@/lib/money"
import { berlinMonthStart, berlinMonthEnd } from "@/lib/utils/berlin-time"

export default async function NewInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ client?: string }>
}) {
  const { locale } = await params
  const sp = (await searchParams) ?? {}
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Invoices" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .single()

  // ─── Plan-Limit Check (Free = 3 Rechnungen / Monat) ──────────────────
  // We check the current calendar month against the user's plan's
  // `rechnungen_per_month` limit. Drafts count too — we don't want a free
  // user to bypass the limit by leaving drafts pending.
  //
  // Quotes are not invoices and not gated. Stornorechnungen also not
  // counted (they're corrections of existing invoices).
  const planId = (settings as { plan?: "free" | "pro" | "business" } | null)
    ?.plan ?? "free"
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0]
  const limit = plan.limits.rechnungen_per_month

  if (limit !== "unlimited") {
    // Kalendermonat in Europe/Berlin
    const monthStart = berlinMonthStart()
    const monthEnd = berlinMonthEnd()

    const [{ count }, draftRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("cancels_invoice_id", null)
        .gte("issue_date", monthStart)
        .lt("issue_date", monthEnd),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("status", "draft"),
    ])

    if ((count ?? 0) >= limit) {
      const proPlan = PLANS.find((p) => p.id === "pro")
      return (
        <PlanLimitReached
          limit={limit}
          used={count ?? 0}
          draftCount={draftRes.count ?? 0}
          proPriceFormatted={formatMoney(proPlan?.price_monthly_cents ?? 990)}
        />
      )
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {t("newInvoicePageTitle")}
      </h1>
      <DocumentForm
        kind="invoice"
        settings={settings!}
        defaultClientId={sp.client}
      />
    </div>
  )
}
