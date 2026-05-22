import { setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { ArrowRight, Users } from "lucide-react"
import { format } from "date-fns"
import { de } from "date-fns/locale"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "@/i18n/navigation"

const ADMIN_EMAILS = ["kolosvasiliysergeevich@gmail.com"]

interface Notification {
  id: string
  kind: string
  user_id: string | null
  user_email: string | null
  payload: Record<string, unknown>
  seen_at: string | null
  created_at: string
}

export default async function AdminSignupsPage({
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

  if (!ADMIN_EMAILS.includes(user!.email ?? "")) {
    notFound()
  }

  const { data } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  const rows = (data ?? []) as Notification[]
  const unseen = rows.filter((r) => !r.seen_at).length

  return (
    <div className="bg-muted/20 min-h-dvh p-6 md:p-10">
      <div className="mx-auto grid max-w-4xl gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Neue Anmeldungen</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Admin-Ansicht · nur für {ADMIN_EMAILS.join(", ")}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1">
              <Users className="mr-1 inline size-3" />
              {rows.length} gesamt
            </span>
            {unseen > 0 ? (
              <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full px-2.5 py-1">
                {unseen} ungelesen
              </span>
            ) : null}
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="bg-card rounded-2xl border p-10 text-center">
            <p className="text-muted-foreground text-sm">
              Noch keine Anmeldungen. Sie erscheinen hier automatisch sobald
              neue Nutzer sich registrieren.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Typ</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Zeit</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40 border-t">
                    <td className="px-4 py-3">
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {row.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.user_email ?? "—"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs">
                      {format(new Date(row.created_at), "dd.MM.yyyy HH:mm", {
                        locale: de,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {row.seen_at ? (
                        <span className="text-muted-foreground text-xs">
                          gelesen
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                          ● neu
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-muted-foreground text-center text-xs">
          <ArrowRight className="inline size-3" /> Produktion: Email-Alerts via
          Resend + Telegram-Bot. Lokal: DB-basiert.
        </p>
      </div>
    </div>
  )
}
