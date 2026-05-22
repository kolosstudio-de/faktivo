import { TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import { formatMoney } from "@/lib/money"
import { forecastCashFlow } from "@/lib/recurring"
import type { RecurringExpense } from "@/types/database.types"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Props {
  userId: string
  openBalance: number
  locale: string
}

export async function CashFlowForecast({ userId, openBalance, locale }: Props) {
  const supabase = await createClient()
  const t = await getTranslations({ locale, namespace: "CashFlow" })

  // Recurring expenses
  const { data: recurringsData } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
  const recurrings = (recurringsData ?? []) as RecurringExpense[]

  // Bank balance — sum of all bank_accounts
  const { data: accountsData } = await supabase
    .from("bank_accounts")
    .select("balance_cents")
    .eq("user_id", userId)
  const currentBalance = (accountsData ?? []).reduce(
    (s, a) => s + (a.balance_cents ?? 0),
    0
  )

  // Settings — for Bürgergeld monthly
  const { data: settings } = await supabase
    .from("settings")
    .select("buergergeld_bedarf_monatlich_cents, receives_buergergeld")
    .eq("user_id", userId)
    .single()
  const monthlyIncome = settings?.receives_buergergeld
    ? (settings.buergergeld_bedarf_monatlich_cents ?? 0)
    : 0

  // Always render — empty state encourages user to add recurrings.

  const f30 = forecastCashFlow({
    currentBalanceCents: currentBalance,
    recurrings,
    monthlyIncomeCents: monthlyIncome,
    expectedIncomeCents: openBalance,
    daysAhead: 30,
  })
  const f90 = forecastCashFlow({
    currentBalanceCents: currentBalance,
    recurrings,
    monthlyIncomeCents: monthlyIncome,
    expectedIncomeCents: openBalance,
    daysAhead: 90,
  })

  const trend30 = f30.endBalanceCents - f30.startBalanceCents
  const trendPositive = trend30 >= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          <ForecastCell
            label={t("today")}
            value={formatMoney(currentBalance)}
            hint={t("todayHint")}
          />
          <ForecastCell
            label={t("in30Days")}
            value={formatMoney(f30.endBalanceCents)}
            hint={t("trendVsToday", {
              sign: trendPositive ? "+" : "",
              amount: formatMoney(trend30),
            })}
            highlight
            trendPositive={trendPositive}
          />
          <ForecastCell
            label={t("in90Days")}
            value={formatMoney(f90.endBalanceCents)}
            hint={t("expectedIncomeHint", {
              amount: formatMoney(f90.totalExpectedIncomeCents),
            })}
          />
        </div>
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
          {recurrings.length === 0 ? (
            <p>
              {t("noContractsYet")}{" "}
              <Link
                href="/finances/abos"
                className="underline decoration-dotted underline-offset-2"
              >
                {t("setupContracts")}
              </Link>
            </p>
          ) : (
            <>
              <p>
                {t("monthlyObligations")}{" "}
                <strong className="text-foreground">
                  {formatMoney(f30.monthlyRecurringTotalCents)}
                </strong>{" "}
                {t("fromContracts", { count: recurrings.length })}
              </p>
              {Object.entries(f30.byKind).length > 0 ? (
                <p className="text-[11px]">
                  {t("next30Days")}{" "}
                  {Object.entries(f30.byKind)
                    .map(([kind, sum]) => `${kind} ${formatMoney(sum)}`)
                    .join(" · ")}
                </p>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ForecastCell({
  label,
  value,
  hint,
  highlight,
  trendPositive,
}: {
  label: string
  value: string
  hint?: string
  highlight?: boolean
  trendPositive?: boolean
}) {
  const Icon = trendPositive === false ? TrendingDown : TrendingUp
  return (
    <div
      className={`grid gap-0.5 rounded-xl border p-3 ${
        highlight ? "bg-muted/40" : ""
      }`}
    >
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
        {highlight ? (
          <Icon
            className={`size-3 ${
              trendPositive === false ? "text-rose-500" : "text-emerald-500"
            }`}
          />
        ) : null}
        {label}
      </div>
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="text-muted-foreground text-[11px]">{hint}</div>
      ) : null}
    </div>
  )
}
