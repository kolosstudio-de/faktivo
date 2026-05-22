import Link from "next/link"
import { ArrowRight, Check, Circle, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

interface Step {
  key: string
  label: string
  description: string
  href: string
  done: boolean
}

/**
 * Getting-started checklist for brand-new users. Only shows when the user
 * has fewer than 3 done steps, so it stays useful through the first days
 * and then disappears.
 */
export async function GettingStarted({ locale }: { locale: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const t = await getTranslations({ locale, namespace: "Onboarding" })

  const [clientCount, invoiceCount, finalizedCount, paymentCount] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("locked_at", "is", null),
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ])

  const steps: Step[] = [
    {
      key: "client",
      label: t("stepClientLabel"),
      description: t("stepClientDescription"),
      href: `/${locale}/clients`,
      done: (clientCount.count ?? 0) > 0,
    },
    {
      key: "invoice",
      label: t("stepInvoiceLabel"),
      description: t("stepInvoiceDescription"),
      href: `/${locale}/invoices/new`,
      done: (invoiceCount.count ?? 0) > 0,
    },
    {
      key: "finalize",
      label: t("stepFinalizeLabel"),
      description: t("stepFinalizeDescription"),
      href: `/${locale}/invoices`,
      done: (finalizedCount.count ?? 0) > 0,
    },
    {
      key: "payment",
      label: t("stepPaymentLabel"),
      description: t("stepPaymentDescription"),
      href: `/${locale}/invoices`,
      done: (paymentCount.count ?? 0) > 0,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length

  // Hide entirely when all done — user is up and running
  if (doneCount === steps.length) return null

  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-chart-2/5 to-chart-4/5 p-6">
      <div className="absolute -top-10 -right-10 size-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 text-primary grid size-9 place-items-center rounded-xl">
              <Sparkles className="size-4" />
            </div>
            <div className="grid leading-tight">
              <span className="text-sm font-semibold">{t("title")}</span>
              <span className="text-muted-foreground text-xs">
                {t("progress", { done: doneCount, total: steps.length, pct })}
              </span>
            </div>
          </div>
          <div className="bg-muted h-1.5 w-40 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid gap-2">
          {steps.map((step) => (
            <Link
              key={step.key}
              href={step.done ? step.href : step.href}
              className={cn(
                "bg-card/70 hover:bg-card flex items-start gap-3 rounded-xl border p-3.5 transition",
                step.done && "opacity-60"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                  step.done
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {step.done ? (
                  <Check className="size-3" />
                ) : (
                  <Circle className="size-4" />
                )}
              </div>
              <div className="grid flex-1 gap-0.5">
                <div className={cn("text-sm font-medium", step.done && "line-through")}>
                  {step.label}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {step.description}
                </p>
              </div>
              {!step.done ? (
                <ArrowRight className="text-muted-foreground mt-1 size-4 shrink-0" />
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
