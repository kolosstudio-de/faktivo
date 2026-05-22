import { setRequestLocale } from "next-intl/server"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata = { title: "Neues Passwort setzen" }

export default async function ResetPasswordPage({
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
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-md place-items-center px-6 py-10">
        <div className="bg-card/80 w-full rounded-3xl border p-8 shadow-xl backdrop-blur-sm">
          <h1 className="text-xl font-semibold tracking-tight">
            Neues Passwort setzen
          </h1>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">
            Wähle ein neues Passwort. Mindestens 6 Zeichen.
          </p>
          <ResetPasswordForm locale={locale} />
        </div>
      </div>
    </div>
  )
}
