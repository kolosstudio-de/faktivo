"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

/**
 * Renders a toast when the user lands on `/billing?limit=reached` after
 * being kicked out of `/invoices/new` due to a Free-plan invoice cap.
 *
 * The toast itself is silent — the only effect is `toast.error(...)` call.
 * Placement on the page is irrelevant; this can live next to PricingCards.
 */
export function LimitReachedToast() {
  const t = useTranslations("Billing")
  const searchParams = useSearchParams()
  const limitParam = searchParams.get("limit")
  const firedRef = React.useRef(false)

  React.useEffect(() => {
    if (limitParam !== "reached" || firedRef.current) return
    firedRef.current = true
    toast.error(t("limitReachedTitle"), {
      description: t("limitReachedDescription"),
      duration: 8000,
    })
  }, [limitParam, t])

  return null
}
