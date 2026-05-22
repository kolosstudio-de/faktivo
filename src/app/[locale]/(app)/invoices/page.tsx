import { getTranslations, setRequestLocale } from "next-intl/server"
import { Banknote, Bitcoin, Landmark, Plus, Receipt } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import { clientDisplayName } from "@/lib/utils/client-display"
import type { Client, Invoice, InvoiceStatus } from "@/types/database.types"
import { Button } from "@/components/ui/button"
import { InvoiceStatusBadge } from "@/components/ui/status-badge"
import { Badge } from "@/components/ui/badge"
import { ImportButton } from "@/components/forms/import-button"
import { cn } from "@/lib/utils"

type InvoiceWithClient = Invoice & {
  client: Pick<Client, "type" | "company_name" | "first_name" | "last_name">
}

type PaymentFilter = "all" | "bank_transfer" | "cash" | "crypto" | "unpaid"

const METHOD_META: Record<string, { icon: typeof Banknote; color: string; key: "methodBankTransfer" | "methodCash" | "methodCrypto" }> = {
  bank_transfer: { icon: Landmark, color: "text-sky-600 dark:text-sky-400", key: "methodBankTransfer" },
  cash: { icon: Banknote, color: "text-emerald-600 dark:text-emerald-400", key: "methodCash" },
  crypto: { icon: Bitcoin, color: "text-amber-600 dark:text-amber-400", key: "methodCrypto" },
}

export default async function InvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ payment?: string }>
}) {
  const { locale } = await params
  const sp = (await searchParams) ?? {}
  const filter = (sp.payment as PaymentFilter | undefined) ?? "all"
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Invoices" })

  const supabase = await createClient()
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, number, issue_date, due_date, status, total_cents, paid_cents, currency, locked_at, is_kleinunternehmer_at_issue, payment_method, client:clients(type, company_name, first_name, last_name)"
    )
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })

  const rows = (data ?? []) as unknown as InvoiceWithClient[]
  const filtered = rows.filter((inv) => {
    if (filter === "all") return true
    if (filter === "unpaid") return inv.status !== "paid" && inv.status !== "cancelled"
    return inv.payment_method === filter
  })

  const counts = rows.reduce(
    (acc, inv) => {
      acc.all += 1
      if (inv.status !== "paid" && inv.status !== "cancelled") acc.unpaid += 1
      if (inv.payment_method) {
        acc[inv.payment_method] = (acc[inv.payment_method] ?? 0) + 1
      }
      return acc
    },
    { all: 0, bank_transfer: 0, cash: 0, crypto: 0, unpaid: 0 } as Record<string, number>
  )

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton kind="invoice" />
          <Button asChild>
            <Link href="/invoices/new">
              <Plus />
              {t("new")}
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label={t("filterAll")} href="?payment=all" active={filter === "all"} count={counts.all} />
        <FilterChip
          label={t("filterBankTransfer")}
          href="?payment=bank_transfer"
          active={filter === "bank_transfer"}
          count={counts.bank_transfer}
          colorClass="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30"
        />
        <FilterChip
          label={t("filterCash")}
          href="?payment=cash"
          active={filter === "cash"}
          count={counts.cash}
          colorClass="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
        />
        <FilterChip
          label={t("filterCrypto")}
          href="?payment=crypto"
          active={filter === "crypto"}
          count={counts.crypto}
          colorClass="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
        />
        <div className="mx-2 h-6 w-px bg-border" />
        <FilterChip
          label={t("filterUnpaid")}
          href="?payment=unpaid"
          active={filter === "unpaid"}
          count={counts.unpaid}
          colorClass="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          hint={t("emptyHint")}
          newLabel={t("new")}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("number")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("issueDate")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("client")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("headerMethod")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("total")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("outstanding")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const outstanding = inv.total_cents - inv.paid_cents
                const method = inv.payment_method ? METHOD_META[inv.payment_method] : null
                return (
                  <tr key={inv.id} className="hover:bg-muted/40 border-t">
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {inv.number ?? (
                          <span className="italic opacity-60">{t("draftFallback")}</span>
                        )}
                      </Link>
                      {inv.is_kleinunternehmer_at_issue ? (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          §19
                        </Badge>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {inv.issue_date}
                    </td>
                    <td className="px-4 py-3">{clientDisplayName(inv.client)}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {method ? (
                        <span className={cn("inline-flex items-center gap-1 text-xs", method.color)}>
                          <method.icon className="size-3.5" />
                          {t(method.key)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatMoney(inv.total_cents)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono tabular-nums",
                        outstanding > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {formatMoney(outstanding)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FilterChip({
  label,
  href,
  active,
  count,
  colorClass,
}: {
  label: string
  href: string
  active: boolean
  count: number
  colorClass?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? colorClass ?? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0 text-[10px] tabular-nums",
          active ? "bg-black/10" : "bg-muted text-foreground"
        )}
      >
        {count}
      </span>
    </Link>
  )
}

function EmptyState({
  title,
  hint,
  newLabel,
}: {
  title: string
  hint: string
  newLabel: string
}) {
  return (
    <div className="border-border/50 bg-card grid place-items-center rounded-2xl border border-dashed py-20 text-center">
      <Receipt className="text-muted-foreground mb-3 size-10" />
      <p className="mb-1 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mb-4 text-xs">{hint}</p>
      <Button asChild>
        <Link href="/invoices/new">
          <Plus /> {newLabel}
        </Link>
      </Button>
    </div>
  )
}
