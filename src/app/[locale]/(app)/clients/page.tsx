import { getTranslations, setRequestLocale } from "next-intl/server"
import { Users } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ClientsTable } from "@/components/tables/clients-table"
import { EmptyState } from "@/components/ui/empty-state"
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

  const rows = (data ?? []) as Client[]

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Stammdaten deiner Kunden — Unternehmen und Privatpersonen.
        </p>
      </header>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Noch keine Kunden"
          description="Lege deinen ersten Kunden an — danach kannst du Angebote und Rechnungen direkt für ihn erstellen, ohne die Adresse erneut einzutippen."
        />
      ) : (
        <ClientsTable initial={rows} />
      )}
    </div>
  )
}
