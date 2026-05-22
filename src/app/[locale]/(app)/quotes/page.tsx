import { getTranslations, setRequestLocale } from "next-intl/server"
import { FileText, Plus } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import { clientDisplayName } from "@/lib/utils/client-display"
import type { Client, Quote, QuoteStatus } from "@/types/database.types"
import { Button } from "@/components/ui/button"
import { QuoteStatusBadge } from "@/components/ui/status-badge"
import { ImportButton } from "@/components/forms/import-button"

type QuoteWithClient = Quote & { client: Pick<Client, "type" | "company_name" | "first_name" | "last_name"> }

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Quotes" })

  const supabase = await createClient()
  const { data } = await supabase
    .from("quotes")
    .select(
      "id, number, issue_date, valid_until, status, total_cents, currency, client:clients(type, company_name, first_name, last_name)"
    )
    .order("issue_date", { ascending: false })

  const rows = (data ?? []) as unknown as QuoteWithClient[]

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
          <ImportButton kind="quote" />
          <Button asChild>
            <Link href="/quotes/new">
              <Plus />
              {t("new")}
            </Link>
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
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
                <th className="px-4 py-3 text-right font-medium">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-muted/40 cursor-pointer border-t"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/quotes/${q.id}`} className="hover:underline">
                      {q.number ?? <span className="italic opacity-60">{t("draftFallback")}</span>}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-xs">
                    {q.issue_date}
                  </td>
                  <td className="px-4 py-3">{clientDisplayName(q.client)}</td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={q.status as QuoteStatus} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatMoney(q.total_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
      <FileText className="text-muted-foreground mb-3 size-10" />
      <p className="mb-1 text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mb-4 text-xs">{hint}</p>
      <Button asChild>
        <Link href="/quotes/new">
          <Plus /> {newLabel}
        </Link>
      </Button>
    </div>
  )
}
