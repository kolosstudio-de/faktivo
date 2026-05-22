"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import type { InvoiceStatus, QuoteStatus } from "@/types/database.types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const INVOICE_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  sent: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  partially_paid:
    "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  cancelled: "bg-muted text-muted-foreground border-transparent line-through",
}

const QUOTE_STYLES: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  accepted:
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  expired: "bg-muted text-muted-foreground border-transparent",
  converted: "bg-primary/15 text-primary border-primary/30",
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useTranslations("Invoices")
  const labelMap: Record<InvoiceStatus, string> = {
    draft: t("statusDraft"),
    sent: t("statusSent"),
    paid: t("statusPaid"),
    partially_paid: t("statusPartiallyPaid"),
    overdue: t("statusOverdue"),
    cancelled: t("statusCancelled"),
  }
  return (
    <Badge variant="outline" className={cn("capitalize", INVOICE_STYLES[status])}>
      {labelMap[status]}
    </Badge>
  )
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const t = useTranslations("Quotes")
  const labelMap: Record<QuoteStatus, string> = {
    draft: t("statusDraft"),
    sent: t("statusSent"),
    accepted: t("statusAccepted"),
    rejected: t("statusRejected"),
    expired: t("statusExpired"),
    converted: t("statusConverted"),
  }
  return (
    <Badge variant="outline" className={cn(QUOTE_STYLES[status])}>
      {labelMap[status]}
    </Badge>
  )
}
