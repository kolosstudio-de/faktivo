import Link from "next/link"
import { ArrowRight, Crown, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import type { Settings } from "@/types/database.types"
import { PLANS } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

/**
 * Usage-aware banner shown on the dashboard. Tells Free users their
 * current usage and pushes toward upgrade; for Pro/Business shows plan status.
 */
export async function PlanBanner({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "Billing" })
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: settings } = await supabase
    .from("settings")
    .select("plan, trial_ends_at")
    .eq("user_id", user.id)
    .single()
  const s = settings as Pick<Settings, "plan" | "trial_ends_at"> | null
  const plan = s?.plan ?? "free"
  const config = PLANS.find((p) => p.id === plan) ?? PLANS[0]

  // Count invoices this month
  const start = new Date()
  start.setDate(1)
  const { count: invoicesThisMonth } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("issue_date", start.toISOString().slice(0, 10))

  const { count: totalClients } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("archived_at", null)

  const isFree = plan === "free"
  const invoicesLimit =
    config.limits.rechnungen_per_month === "unlimited"
      ? Infinity
      : config.limits.rechnungen_per_month
  const clientsLimit =
    config.limits.clients === "unlimited" ? Infinity : config.limits.clients

  const invPct =
    invoicesLimit === Infinity
      ? 0
      : Math.min(100, ((invoicesThisMonth ?? 0) / invoicesLimit) * 100)
  const cliPct =
    clientsLimit === Infinity
      ? 0
      : Math.min(100, ((totalClients ?? 0) / clientsLimit) * 100)

  const reachingLimit = isFree && (invPct > 70 || cliPct > 70)

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        reachingLimit
          ? "border-amber-500/40 bg-amber-500/5"
          : isFree
            ? "border-primary/20 bg-primary/5"
            : "border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            {isFree ? (
              <Sparkles className="text-primary size-4" />
            ) : (
              <Crown className="size-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="text-sm font-semibold capitalize">
              {config.name}
              {t("planSuffix")}
            </span>
          </div>

          {isFree ? (
            <p className="text-muted-foreground text-xs">
              {reachingLimit
                ? t("limitWarning")
                : t("freeForeverHint")}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              {t("paidThanks")}
            </p>
          )}

          {isFree ? (
            <div className="mt-2 grid gap-2 text-xs">
              <UsageBar
                label={t("usageInvoicesThisMonth")}
                current={invoicesThisMonth ?? 0}
                limit={
                  invoicesLimit === Infinity ? undefined : invoicesLimit
                }
              />
              <UsageBar
                label={t("usageClients")}
                current={totalClients ?? 0}
                limit={clientsLimit === Infinity ? undefined : clientsLimit}
              />
            </div>
          ) : null}
        </div>

        {isFree ? (
          <Link
            href={`/${locale}/billing`}
            className="bg-primary text-primary-foreground inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium shadow-sm transition hover:opacity-90"
          >
            {t("upgrade")}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <Link
            href={`/${locale}/billing`}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {t("manageSubscription")} →
          </Link>
        )}
      </div>
    </div>
  )
}

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string
  current: number
  limit?: number
}) {
  const pct = limit ? Math.min(100, (current / limit) * 100) : 0
  return (
    <div className="grid gap-1">
      <div className="text-muted-foreground flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {current}
          {limit ? ` / ${limit}` : " / ∞"}
        </span>
      </div>
      {limit ? (
        <div className="bg-muted/70 h-1 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct > 90
                ? "bg-rose-500"
                : pct > 70
                  ? "bg-amber-500"
                  : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
