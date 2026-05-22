import { getTranslations, setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { SettingsForm } from "@/components/forms/settings-form"
import { SettingsSections } from "@/components/forms/settings-sections"
import { BrandingForm } from "@/components/forms/branding-form"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: "Settings" })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .single()

  const { data: sequences } = await supabase
    .from("number_sequences")
    .select("*")
    .eq("user_id", user!.id)
    .order("year", { ascending: false })
    .order("kind", { ascending: true })

  if (!settings) {
    return (
      <div className="p-6 text-muted-foreground">
        {t("initializing")}
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("subtitle")}
        </p>
      </header>
      <SettingsForm initial={settings} sequences={sequences ?? []} />
      <BrandingForm initial={settings} />
      <SettingsSections initial={settings} />
    </div>
  )
}
