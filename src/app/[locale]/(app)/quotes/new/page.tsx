import { getTranslations, setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { DocumentForm } from "@/components/forms/document-form"

export default async function NewQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ client?: string }>
}) {
  const { locale } = await params
  const sp = (await searchParams) ?? {}
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Quotes" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .single()

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {t("newQuotePageTitle")}
      </h1>
      <DocumentForm
        kind="quote"
        settings={settings!}
        defaultClientId={sp.client}
      />
    </div>
  )
}
