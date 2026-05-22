import type { ReactNode } from "react"
import { setRequestLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Settings } from "@/types/database.types"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode
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

  // Gate on onboarding — new users go through the wizard first.
  const { data: settings } = await supabase
    .from("settings")
    .select("onboarding_completed_at")
    .eq("user_id", user!.id)
    .single()

  if (!(settings as Pick<Settings, "onboarding_completed_at"> | null)?.onboarding_completed_at) {
    redirect({ href: "/onboarding", locale: locale as "de" | "en" | "ru" })
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar user={user!} />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
