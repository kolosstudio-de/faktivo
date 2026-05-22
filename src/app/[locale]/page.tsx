import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"
import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: "Faktivo — Buchhaltung für Selbstständige · Deutsch · English · Русский · Українською",
  description:
    "Rechnungen, Angebote, Bürgergeld-EKS, Banking & Belege — DSGVO- & GoBD-konform aus Deutschland. Speziell für Kleinunternehmer (§19 UStG), Freelancer und Bürgergeld-Empfänger.",
  robots: { index: true, follow: true },
}

export default async function LocaleHome({
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

  // Authenticated → go to dashboard (onboarding guard runs inside (app) layout)
  if (user) {
    redirect({ href: "/dashboard", locale: locale as "de" | "en" | "ru" })
  }

  return <LandingPage locale={locale} />
}
