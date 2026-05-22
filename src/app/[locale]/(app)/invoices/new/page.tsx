import { getTranslations, setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { DocumentForm } from "@/components/forms/document-form"
import { PLANS } from "@/lib/billing/plans"

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
    const now = new Date()
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    )
      .toISOString()
      .slice(0, 10)
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    )
      .toISOString()
      .slice(0, 10)

    // Count regular invoices for the calendar month.
    // Stornorechnungen (cancels_invoice_id IS NOT NULL) don't count
    // toward the limit — they are corrections of existing invoices.
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .is("cancels_invoice_id", null)
      .gte("issue_date", monthStart)
      .lt("issue_date", monthEnd)

    if ((count ?? 0) >= limit) {
      redirect({ href: "/billing?limit=reached", locale })
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
