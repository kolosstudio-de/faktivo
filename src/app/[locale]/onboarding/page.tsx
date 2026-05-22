import { setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import type { OnboardingProgress, Settings } from "@/types/database.types"
import type { OnboardingData } from "@/lib/validators/onboarding"
import { WizardShell } from "@/components/onboarding/wizard-shell"

export const metadata = {
  title: "Einrichtung — Faktivo",
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect({ href: "/login", locale: locale as "de" | "en" | "ru" })
  }

  const [settingsRes, progressRes] = await Promise.all([
    supabase.from("settings").select("*").eq("user_id", user!.id).single(),
    supabase
      .from("onboarding_progress")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ])

  const settings = settingsRes.data as Settings | null

  // Already finished? Send them to dashboard.
  if (settings?.onboarding_completed_at) {
    redirect({ href: "/dashboard", locale: locale as "de" | "en" | "ru" })
  }

  const progress = progressRes.data as OnboardingProgress | null
  const storedData = (progress?.data as OnboardingData | undefined) ?? {}

  const initialData: OnboardingData = {
    ...storedData,
    ...(settings
      ? {
          company_name: settings.company_name || storedData.company_name || "",
          first_name: settings.first_name ?? storedData.first_name ?? "",
          last_name: settings.last_name ?? storedData.last_name ?? "",
          street: settings.address?.street ?? storedData.street ?? "",
          zip: settings.address?.zip ?? storedData.zip ?? "",
          city: settings.address?.city ?? storedData.city ?? "",
          country: settings.address?.country ?? storedData.country ?? "DE",
          iban: settings.iban ?? storedData.iban ?? "",
          bic: settings.bic ?? storedData.bic ?? "",
          bank_name: settings.bank_name ?? storedData.bank_name ?? "",
          tax_id: settings.tax_id ?? storedData.tax_id ?? "",
          ust_id: settings.ust_id ?? storedData.ust_id ?? "",
        }
      : {}),
  }

  const initialStep = progress?.step ?? 0

  return (
    <WizardShell
      userId={user!.id}
      initialStep={initialStep}
      initialData={initialData}
    />
  )
}
