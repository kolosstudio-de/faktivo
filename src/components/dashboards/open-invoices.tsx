import Link from "next/link"
import { AlertTriangle, Clock, Mail, Wallet } from "lucide-react"
import { differenceInDays, format } from "date-fns"
import { de } from "date-fns/locale"

import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import { clientDisplayName } from "@/lib/utils/client-display"
import type { Client, Invoice } from "@/types/database.types"
import { cn } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Row = Pick<
  Invoice,
  "id" | "number" | "issue_date" | "due_date" | "status" | "total_cents" | "paid_cents"
> & { client: Pick<Client, "type" | "company_name" | "first_name" | "last_name"> }

export async function OpenInvoices({ locale }: { locale: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("invoices")
    .select(
      "id, number, issue_date, due_date, status, total_cents, paid_cents, client:clients(type, company_name, first_name, last_name)"
    )
    .eq("user_id", user.id)
    .not("locked_at", "is", null)
    .not("status", "in", '("paid","cancelled")')
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(6)

  const rows = (data ?? []) as unknown as Row[]
  if (rows.length === 0) return null

  const today = new Date()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          Offene Posten
        </CardTitle>
        <CardDescription>
          Rechnungen, die auf Zahlung warten. Klick für Details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid divide-y">
          {rows.map((inv) => {
            const outstanding = inv.total_cents - inv.paid_cents
            const daysOverdue = inv.due_date
              ? differenceInDays(today, new Date(inv.due_date))
              : null
            const isOverdue = daysOverdue !== null && daysOverdue > 0
            const isUrgent = isOverdue && (daysOverdue ?? 0) > 14

            return (
              <Link
                key={inv.id}
                href={`/${locale}/invoices/${inv.id}`}
                className="hover:bg-muted/40 flex items-center justify-between gap-3 px-1 py-3 text-sm"
              >
                <div className="grid min-w-0 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {inv.number ?? "Entwurf"}
                    </span>
                    {isUrgent ? (
                      <span className="bg-rose-500/15 text-rose-700 dark:text-rose-400 rounded-full px-1.5 py-0 text-[10px] font-medium">
                        Dringend
                      </span>
                    ) : isOverdue ? (
                      <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full px-1.5 py-0 text-[10px] font-medium">
                        Überfällig
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground truncate text-xs">
                    {clientDisplayName(inv.client)}
                  </span>
                  {inv.due_date ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px]",
                        isOverdue
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}
                    >
                      <Clock className="size-3" />
                      {isOverdue
                        ? `${daysOverdue} Tage überfällig`
                        : `fällig am ${format(new Date(inv.due_date), "dd.MM.", { locale: de })}`}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-sm">
                    {formatMoney(outstanding)}
                  </span>
                  <div className="text-muted-foreground flex gap-0.5 text-xs">
                    {isOverdue ? (
                      <Mail className="size-3.5" aria-label="Mahnung möglich" />
                    ) : null}
                    <Wallet className="size-3.5" aria-label="Zahlung erfassen" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
