import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { LoginForm } from "@/components/auth/login-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Auth" })
  return { title: t("title") }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const tApp = await getTranslations({ locale, namespace: "App" })
  const tAuth = await getTranslations({ locale, namespace: "Auth" })

  return (
    <div className="bg-muted/20 relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-primary/10 absolute -top-40 -right-20 size-[32rem] rounded-full blur-3xl" />
        <div className="bg-chart-2/10 absolute top-1/3 -left-40 size-[32rem] rounded-full blur-3xl" />
        <div className="bg-chart-4/10 absolute -bottom-40 right-1/3 size-[32rem] rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-md place-items-center px-6 py-10">
        <div className="bg-card/80 w-full rounded-3xl border p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-8 grid gap-1.5 text-center">
            <div className="text-primary bg-primary/10 mx-auto mb-2 grid size-10 place-items-center rounded-xl font-bold">
              F
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {tAuth("title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tAuth("subtitle")}
            </p>
          </div>

          <LoginForm />

          <div className="text-muted-foreground mt-6 text-center text-xs">
            🔒 {tAuth("trustBadge")}
          </div>

          <p className="text-muted-foreground mt-4 text-center text-xs">
            {tApp("name")} — {tApp("tagline")}
          </p>
        </div>
      </div>
    </div>
  )
}
