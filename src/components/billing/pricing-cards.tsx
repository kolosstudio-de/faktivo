"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import { PLANS } from "@/lib/billing/plans"
import type { PlanTier } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  currentPlan: PlanTier
  hasStripeSubscription: boolean
}

export function PricingCards({ currentPlan, hasStripeSubscription }: Props) {
  const t = useTranslations("Billing")
  const tp = useTranslations("BillingPlans")
  const [billing, setBilling] = React.useState<"monthly" | "yearly">("yearly")

  const checkoutMut = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? t("errorCheckoutFailed"))
      return data as { url: string }
    },
    onSuccess: (data) => {
      window.location.href = data.url
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const portalMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? t("errorPortalFailed"))
      return data as { url: string }
    },
    onSuccess: (data) => {
      window.location.href = data.url
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm transition",
            billing === "monthly"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {t("monthly")}
        </button>
        <button
          type="button"
          onClick={() => setBilling("yearly")}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm transition",
            billing === "yearly"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {t("yearlyWithDiscount")}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const priceCents =
            billing === "yearly"
              ? plan.price_yearly_total_cents
              : plan.price_monthly_cents
          const monthlyEquivalent =
            billing === "yearly"
              ? plan.price_yearly_per_month_cents
              : plan.price_monthly_cents
          const priceId =
            billing === "yearly"
              ? plan.stripe_price_id_yearly
              : plan.stripe_price_id_monthly
          const isCurrent = currentPlan === plan.id
          const isFree = plan.id === "free"

          return (
            <div
              key={plan.id}
              className={cn(
                "bg-card relative grid gap-4 rounded-2xl border p-6",
                plan.popular
                  ? "border-primary/40 shadow-lg ring-4 ring-primary/10"
                  : "border-border"
              )}
            >
              {plan.popular ? (
                <div className="bg-primary text-primary-foreground absolute -top-3 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  <Sparkles className="mr-1 inline size-3" />
                  {tp("popular")}
                </div>
              ) : null}

              <div className="grid gap-1">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-muted-foreground text-xs">
                  {tp(`${plan.id}.tagline`)}
                </p>
              </div>

              <div className="grid gap-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tabular-nums">
                    {priceCents === 0
                      ? "€0"
                      : `€${(monthlyEquivalent / 100).toFixed(2)}`}
                  </span>
                  <span className="text-muted-foreground text-sm">{t("perMonth")}</span>
                </div>
                {billing === "yearly" && priceCents > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    {t("yearlyPrice", { price: (priceCents / 100).toFixed(2) })}
                  </p>
                ) : null}
              </div>

              <ul className="grid gap-2 text-sm">
                {(tp.raw(`${plan.id}.highlights`) as string[]).map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="text-primary mt-0.5 size-4 shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                hasStripeSubscription ? (
                  <Button
                    variant="outline"
                    onClick={() => portalMut.mutate()}
                    disabled={portalMut.isPending}
                  >
                    {portalMut.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <CreditCard />
                    )}
                    {t("manageSubscription")}
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    {t("currentPlan")}
                  </Button>
                )
              ) : isFree ? (
                <Button variant="outline" disabled>
                  {t("free")}
                </Button>
              ) : (
                <Button
                  disabled={!priceId || checkoutMut.isPending}
                  onClick={() => priceId && checkoutMut.mutate(priceId)}
                >
                  {checkoutMut.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CreditCard />
                  )}
                  {priceId ? t("subscribeNow") : t("priceNotConfigured")}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-muted-foreground text-center text-xs">
        {t("footerNote")}
      </p>
    </div>
  )
}
