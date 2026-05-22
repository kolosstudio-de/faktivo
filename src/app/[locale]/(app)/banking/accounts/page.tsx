import { getTranslations, setRequestLocale } from "next-intl/server"
import { Wallet, Sparkles } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"

import { createClient } from "@/lib/supabase/server"
import type { BankAccount, BankTransaction } from "@/types/database.types"
import {
  BankAccountCard,
  type BankAccountCardData,
  type BankAccountStats,
} from "@/components/banking/bank-account-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"

export default async function BankingAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Banking" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date()
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd")
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd")
  const yearStart = format(startOfYear(today), "yyyy-MM-dd")
  const yearEnd = format(endOfYear(today), "yyyy-MM-dd")

  const [accountsRes, txsRes] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
    // Pull all year-to-date transactions for stats. (For one-person SMB
    // we expect a few thousand rows max — well within a single query.)
    supabase
      .from("bank_transactions")
      .select(
        "id, account_id, amount_cents, booking_date, counterparty_name, dismissed_at",
      )
      .eq("user_id", user!.id)
      .gte("booking_date", yearStart)
      .lte("booking_date", yearEnd)
      .is("dismissed_at", null),
  ])

  const accounts = (accountsRes.data ?? []) as BankAccount[]
  const txs = (txsRes.data ?? []) as Array<
    Pick<
      BankTransaction,
      | "id"
      | "account_id"
      | "amount_cents"
      | "booking_date"
      | "counterparty_name"
      | "dismissed_at"
    >
  >

  // ─── Aggregate stats per account ─────────────────────────────────────
  const statsByAccount = new Map<string, BankAccountStats>()
  for (const acct of accounts) {
    statsByAccount.set(acct.id, {
      monthIncomeCents: 0,
      monthExpenseCents: 0,
      monthNetCents: 0,
      yearIncomeCents: 0,
      yearExpenseCents: 0,
      yearNetCents: 0,
      txCount: 0,
      lastTxDate: null,
      uniqueCounterparties: 0,
    })
  }
  const counterpartiesByAccount = new Map<string, Set<string>>()

  for (const tx of txs) {
    const stats = statsByAccount.get(tx.account_id)
    if (!stats) continue
    stats.txCount += 1
    if (!stats.lastTxDate || tx.booking_date > stats.lastTxDate) {
      stats.lastTxDate = tx.booking_date
    }
    if (tx.counterparty_name) {
      let s = counterpartiesByAccount.get(tx.account_id)
      if (!s) {
        s = new Set()
        counterpartiesByAccount.set(tx.account_id, s)
      }
      s.add(tx.counterparty_name.trim().toLowerCase())
    }
    const inMonth =
      tx.booking_date >= monthStart && tx.booking_date <= monthEnd
    if (tx.amount_cents > 0) {
      stats.yearIncomeCents += tx.amount_cents
      if (inMonth) stats.monthIncomeCents += tx.amount_cents
    } else {
      stats.yearExpenseCents += -tx.amount_cents
      if (inMonth) stats.monthExpenseCents += -tx.amount_cents
    }
    stats.yearNetCents += tx.amount_cents
    if (inMonth) stats.monthNetCents += tx.amount_cents
  }
  for (const [id, set] of counterpartiesByAccount.entries()) {
    const s = statsByAccount.get(id)
    if (s) s.uniqueCounterparties = set.size
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Wallet className="size-6 text-primary" />
            {t("accountsTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("accountsSubtitle")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/banking">
            <Sparkles className="size-4" />
            {t("title")}
          </Link>
        </Button>
      </header>

      {accounts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acct) => {
            const data: BankAccountCardData = {
              id: acct.id,
              iban: acct.iban,
              last_4: acct.last_4 ?? null,
              display_name: acct.display_name,
              card_color: acct.card_color ?? null,
              notes: acct.notes ?? null,
              currency: acct.currency,
              balance_cents: acct.balance_cents,
              owner_name: acct.owner_name,
            }
            const stats: BankAccountStats = statsByAccount.get(acct.id) ?? {
              monthIncomeCents: 0,
              monthExpenseCents: 0,
              monthNetCents: 0,
              yearIncomeCents: 0,
              yearExpenseCents: 0,
              yearNetCents: 0,
              txCount: 0,
              lastTxDate: null,
              uniqueCounterparties: 0,
            }
            return <BankAccountCard key={acct.id} account={data} stats={stats} />
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t("accountsEmptyTitle")}</CardTitle>
            <CardDescription>{t("accountsEmptyHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/banking">{t("title")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
