import { getTranslations, setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import type { Settings } from "@/types/database.types"
import { PricingCards } from "@/components/billing/pricing-cards"
import { LimitReachedToast } from "@/components/billing/limit-reached-toast"

export default async function BillingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Billing" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .single()

  const s = settings as Settings | null
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY)
  const currentPlan = s?.plan ?? "free"

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <LimitReachedToast />
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("choosePlanTitle")}
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
          {t.rich("choosePlanSubtitle", {
            plan: currentPlan,
            b: (chunks) => <b>{chunks}</b>,
          })}
        </p>
      </header>

      {!stripeConfigured ? (
        <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-500/20 p-4 text-sm">
          <p className="font-medium">{t("notActivatedTitle")}</p>
          <p className="mt-1 text-xs">
            {t.rich("notActivatedHint", {
              code: (chunks) => (
                <code className="font-mono">{chunks}</code>
              ),
            })}
          </p>
        </div>
      ) : null}

      <PricingCards
        currentPlan={currentPlan}
        hasStripeSubscription={Boolean(s?.stripe_subscription_id)}
      />
    </div>
  )
}
