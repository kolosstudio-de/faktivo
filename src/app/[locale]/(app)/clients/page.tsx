import { getTranslations, setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { ClientsTable } from "@/components/tables/clients-table"
import type { Client } from "@/types/database.types"

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Clients" })

  const supabase = await createClient()
  const { data } = await supabase
    .from("clients")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Stammdaten deiner Kunden — Unternehmen und Privatpersonen.
        </p>
      </header>
      <ClientsTable initial={(data ?? []) as Client[]} />
    </div>
  )
}
