import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"

import { PricingPage } from "@/components/landing/pricing-page"

export const metadata: Metadata = {
  title: "Preise · Faktivo",
  description:
    "Faktivo Pakete: Free dauerhaft kostenlos, Pro 7,90 € / Monat im Jahresabo, Business 15,90 € / Monat. Endpreis ohne USt. (§ 19 Kleinunternehmer). Jederzeit kündbar.",
  robots: { index: true, follow: true },
}

export default async function PricingRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PricingPage locale={locale} />
}
