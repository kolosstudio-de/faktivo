import { getTranslations, setRequestLocale } from "next-intl/server"
import { Repeat } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import type { RecurringExpense } from "@/types/database.types"
import { RecurringPageClient } from "@/components/recurring/recurring-page-client"

export default async function AbosPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Abos" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", user!.id)
    .order("active", { ascending: false })
    .order("next_due_date", { ascending: true })

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Repeat className="size-6 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </header>

      <RecurringPageClient
        initialRecurrings={(data ?? []) as RecurringExpense[]}
      />
    </div>
  )
}
