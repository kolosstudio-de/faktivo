import Link from "next/link"
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { createClient } from "@/lib/supabase/server"
import type { Settings } from "@/types/database.types"

interface ProfileCheck {
  key: string
  label: string
  href: string
  passed: boolean
}

export async function ProfileHealth({ locale }: { locale: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .single()
  const s = settings as Settings | null
  if (!s) return null

  const t = await getTranslations({ locale, namespace: "Onboarding" })

  const checks: ProfileCheck[] = [
    {
      key: "company_name",
      label: t("profileCheckCompanyName"),
      href: `/${locale}/settings`,
      passed: Boolean(s.company_name?.trim() || (s.first_name && s.last_name)),
    },
    {
      key: "address",
      label: t("profileCheckAddress"),
      href: `/${locale}/settings`,
      passed: Boolean(s.address?.street && s.address?.zip && s.address?.city),
    },
    {
      key: "tax",
      label: t("profileCheckTax"),
      href: `/${locale}/settings`,
      passed: Boolean(s.tax_id?.trim() || s.ust_id?.trim()),
    },
    {
      key: "iban",
      label: t("profileCheckIban"),
      href: `/${locale}/settings`,
      passed: Boolean(s.iban?.trim()),
    },
    {
      key: "legal_form",
      label: t("profileCheckLegalForm"),
      href: `/${locale}/settings`,
      passed: Boolean(s.legal_form && s.branche_wz_code),
    },
  ]

  const failed = checks.filter((c) => !c.passed)
  if (failed.length === 0) return null

  const pct = Math.round(((checks.length - failed.length) / checks.length) * 100)

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <CircleAlert className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {t("profileTitle", { pct })}
            </span>
          </div>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
            {t("profileHint")}
          </p>
          <ul className="mt-2 grid gap-1 text-xs">
            {checks.map((c) => (
              <li
                key={c.key}
                className="flex items-center gap-2 text-amber-800 dark:text-amber-200"
              >
                {c.passed ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <span className={c.passed ? "opacity-60" : ""}>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <Link
          href={`/${locale}/settings`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-amber-700"
        >
          {t("completeAction")}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
