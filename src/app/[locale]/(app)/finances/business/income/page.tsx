import { setRequestLocale } from "next-intl/server"

import { EntriesTable } from "@/components/tables/entries-table"

export default async function BusinessIncomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Geschäftliche Einnahmen
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Zusätzlich zu Rechnungen kannst du hier weitere betriebliche Einnahmen erfassen.
        </p>
      </header>
      <EntriesTable kind="income" scope="business" />
    </div>
  )
}
