import { setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata = { title: "Passwort vergessen" }

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="bg-muted/20 relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-primary/10 absolute -top-40 -right-20 size-[32rem] rounded-full blur-3xl" />
        <div className="bg-chart-2/10 absolute top-1/3 -left-40 size-[32rem] rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-md place-items-center px-6 py-10">
        <div className="bg-card/80 w-full rounded-3xl border p-8 shadow-xl backdrop-blur-sm">
          <Link
            href={`/${locale}/login`}
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3" /> Zurück zum Login
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            Passwort zurücksetzen
          </h1>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">
            Wir senden dir einen Link zum Zurücksetzen deines Passworts.
          </p>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}
