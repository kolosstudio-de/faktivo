import { setRequestLocale } from "next-intl/server"

import { EntriesTable } from "@/components/tables/entries-table"

export default async function PersonalExpensesPage({
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
          Private Ausgaben
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Miete, Lebensmittel, Versicherungen, Freizeit — dein Haushaltsbudget.
        </p>
      </header>
      <EntriesTable kind="expense" scope="personal" />
    </div>
  )
}
