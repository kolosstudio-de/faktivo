import { getTranslations, setRequestLocale } from "next-intl/server"
import { FileText, Sparkles, Upload } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import type { BankAccount } from "@/types/database.types"
import { CsvImportDialog } from "@/components/banking/csv-import-dialog"
import { PdfImportDialog } from "@/components/banking/pdf-import-dialog"
import { TransactionsFeed } from "@/components/banking/transactions-feed"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function BankingPage({
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

  const { data: accountsData } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("user_id", user!.id)
  const accounts = (accountsData ?? []) as BankAccount[]

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="size-6 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvImportDialog />
          <PdfImportDialog />
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-start gap-3 rounded-xl border border-emerald-500/20 p-3 text-xs">
          <Upload className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{t("csvAllBanksTitle")}</p>
            <p>{t("csvAllBanksHint")}</p>
          </div>
        </div>

        <div className="bg-violet-500/10 text-violet-700 dark:text-violet-400 grid gap-1.5 rounded-xl border border-violet-500/20 p-3 text-xs">
          <p className="font-medium">
            <Sparkles className="mr-1 inline size-3.5" />
            {t("afterImportTitle")}
          </p>
          <ul className="grid gap-0.5 leading-relaxed">
            <li
              dangerouslySetInnerHTML={{ __html: "· " + t.raw("afterImport1") }}
            />
            <li
              dangerouslySetInnerHTML={{ __html: "· " + t.raw("afterImport2") }}
            />
            <li
              dangerouslySetInnerHTML={{ __html: "· " + t.raw("afterImport3") }}
            />
            <li
              dangerouslySetInnerHTML={{ __html: "· " + t.raw("afterImport4") }}
            />
          </ul>
        </div>
      </div>

      {accounts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map((acct) => (
            <Card key={acct.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {acct.display_name ?? t("accountFallback")}
                </CardTitle>
                <CardDescription>
                  {acct.iban
                    ? acct.iban.replace(/(.{4})/g, "$1 ").trim()
                    : t("manualCsvImport")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {acct.balance_cents != null
                    ? formatMoney(acct.balance_cents)
                    : "—"}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("lastImport")}{" "}
                  {acct.last_synced_at
                    ? new Date(acct.last_synced_at).toLocaleString(locale)
                    : t("notYet")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t("noStatementYet")}</CardTitle>
            <CardDescription>
              <span dangerouslySetInnerHTML={{ __html: t.raw("noStatementHint") }} />
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {accounts.length > 0 ? <TransactionsFeed /> : null}
    </div>
  )
}
