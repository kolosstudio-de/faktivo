"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react"
import { toast } from "sonner"

import { formatMoney } from "@/lib/money"
import type {
  RecurringExpense,
  RecurringFrequency,
  RecurringKind,
} from "@/types/database.types"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RecurringForm } from "./recurring-form"

const KIND_EMOJI: Record<RecurringKind, string> = {
  subscription: "🎵",
  rent: "🏠",
  utility: "⚡",
  loan: "💳",
  insurance: "🛡️",
  membership: "🤝",
  leasing: "🚗",
  other: "📋",
}

const KIND_COLOR: Record<RecurringKind, string> = {
  subscription: "text-blue-600 dark:text-blue-400",
  rent: "text-emerald-600 dark:text-emerald-400",
  utility: "text-amber-600 dark:text-amber-400",
  loan: "text-rose-600 dark:text-rose-400",
  insurance: "text-cyan-600 dark:text-cyan-400",
  membership: "text-purple-600 dark:text-purple-400",
  leasing: "text-orange-600 dark:text-orange-400",
  other: "text-muted-foreground",
}

const KIND_LABEL_KEY: Record<RecurringKind, string> = {
  subscription: "kindSubscription",
  rent: "kindRent",
  utility: "kindUtility",
  loan: "kindLoan",
  insurance: "kindInsurance",
  membership: "kindMembership",
  leasing: "kindLeasing",
  other: "kindOther",
}

const FREQ_KEY: Record<RecurringFrequency, string> = {
  monthly: "freqMonthly",
  quarterly: "freqQuarterly",
  yearly: "freqYearly",
}

interface DetectedCandidate {
  vendor: string
  amountCents: number
  frequency: RecurringFrequency
  occurrences: number
  firstSeen: string
  lastSeen: string
  confidence: number
  scope: "business" | "personal"
  kind: RecurringKind
  matchedTxIds: string[]
}

interface Props {
  initialRecurrings: RecurringExpense[]
}

export function RecurringPageClient({ initialRecurrings }: Props) {
  const t = useTranslations("Abos")
  const queryClient = useQueryClient()

  const { data: recurrings = initialRecurrings } = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => {
      const r = await fetch("/api/recurring")
      if (!r.ok) throw new Error("load failed")
      const json = await r.json()
      return json.recurrings as RecurringExpense[]
    },
    initialData: initialRecurrings,
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<RecurringExpense | null>(null)
  const [prefillFromDetection, setPrefillFromDetection] = React.useState<
    DetectedCandidate | null
  >(null)

  const [showCandidates, setShowCandidates] = React.useState(false)

  const [defaultNextDue] = React.useState(() =>
    new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
  )
  const detectQuery = useQuery({
    queryKey: ["recurring-candidates"],
    queryFn: async () => {
      const r = await fetch("/api/recurring/detect")
      if (!r.ok) throw new Error("detect failed")
      const json = await r.json()
      return (json.candidates ?? []) as DetectedCandidate[]
    },
    enabled: showCandidates,
  })

  const postDueMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/recurring/post-due", { method: "POST" })
      if (!r.ok) throw new Error("post-due failed")
      return r.json()
    },
    onSuccess: (s) => {
      toast.success(
        t("postDueToast", {
          created: s.expense_entries_created,
          processed: s.recurrings_processed,
        })
      )
      queryClient.invalidateQueries({ queryKey: ["recurring"] })
      queryClient.invalidateQueries({ queryKey: ["expense_entries"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ─── Stats ─────────────────────────────────────────────────────────────
  const active = recurrings.filter((r) => r.active)
  const monthlyTotal = active.reduce((s, r) => {
    const monthly =
      r.frequency === "monthly"
        ? r.amount_cents
        : r.frequency === "yearly"
          ? Math.round(r.amount_cents / 12)
          : Math.round(r.amount_cents / 3)
    return s + monthly
  }, 0)
  const businessMonthly = active
    .filter((r) => r.scope === "business")
    .reduce((s, r) => {
      const m =
        r.frequency === "monthly"
          ? r.amount_cents
          : r.frequency === "yearly"
            ? Math.round(r.amount_cents / 12)
            : Math.round(r.amount_cents / 3)
      return s + m
    }, 0)
  const privateMonthly = monthlyTotal - businessMonthly

  // Group by kind
  const byKind: Record<string, RecurringExpense[]> = {}
  for (const r of recurrings) {
    if (!byKind[r.kind]) byKind[r.kind] = []
    byKind[r.kind].push(r)
  }
  const kindOrder: RecurringKind[] = [
    "rent",
    "utility",
    "loan",
    "leasing",
    "insurance",
    "subscription",
    "membership",
    "other",
  ]

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("monthlyTotal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {formatMoney(monthlyTotal)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("activeContracts", { count: active.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("ofWhichBusiness")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
              {formatMoney(businessMonthly)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("eurRelevant")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {t("ofWhichPersonal")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {formatMoney(privateMonthly)}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {t("livingExpenses")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            setEditing(null)
            setPrefillFromDetection(null)
            setFormOpen(true)
          }}
        >
          <Plus />
          {t("addContract")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCandidates(!showCandidates)}
        >
          <Sparkles />
          {t("autoDetect")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => postDueMut.mutate()}
          disabled={postDueMut.isPending}
        >
          {postDueMut.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          {t("postDue")}
        </Button>
      </div>

      {showCandidates ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <Sparkles className="text-primary mr-2 inline size-4" />
              {t("detectedTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {detectQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">{t("scanning")}</p>
            ) : (detectQuery.data?.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noPatterns")}</p>
            ) : (
              <div className="grid gap-2">
                {detectQuery.data!.map((c, idx) => (
                  <div
                    key={`${c.vendor}-${c.amountCents}-${idx}`}
                    className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <div className="grid gap-0.5">
                      <span className="text-sm font-medium">
                        {KIND_EMOJI[c.kind]} {c.vendor}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t("occurrencesPattern", {
                          count: c.occurrences,
                          freq: c.frequency,
                          pct: Math.round(c.confidence * 100),
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm tabular-nums">
                        {formatMoney(c.amountCents)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setEditing(null)
                          setPrefillFromDetection(c)
                          setFormOpen(true)
                        }}
                      >
                        {t("adopt")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {recurrings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="grid gap-2 py-12 text-center">
            <AlertCircle className="text-muted-foreground mx-auto size-8" />
            <p className="font-medium">{t("noContractsYet")}</p>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              {t("noContractsHint")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {kindOrder
            .filter((k) => byKind[k]?.length)
            .map((k) => (
              <div key={k} className="grid gap-2">
                <h3
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${KIND_COLOR[k]}`}
                >
                  <span className="text-base">{KIND_EMOJI[k]}</span>
                  {t(KIND_LABEL_KEY[k])}
                </h3>
                <div className="overflow-hidden rounded-2xl border">
                  {byKind[k].map((r, i) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setEditing(r)
                        setPrefillFromDetection(null)
                        setFormOpen(true)
                      }}
                      className={`hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        i > 0 ? "border-t" : ""
                      } ${!r.active ? "opacity-50" : ""}`}
                    >
                      <div className="grid flex-1 gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.name}</span>
                          {r.scope === "business" ? (
                            <span className="text-blue-600 bg-blue-500/10 dark:text-blue-400 rounded-full px-1.5 py-0.5 text-[9px] font-medium">
                              {t("labelBusiness")}
                            </span>
                          ) : null}
                          {!r.active ? (
                            <span className="bg-muted rounded-full px-1.5 py-0.5 text-[9px] font-medium">
                              {t("labelPaused")}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                          {r.vendor ? <span>{r.vendor}</span> : null}
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {t("nextDue", { date: r.next_due_date })}
                          </span>
                          {r.remaining_payments != null ? (
                            <span>
                              {t("remainingPayments", {
                                count: r.remaining_payments,
                              })}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold tabular-nums">
                          {formatMoney(r.amount_cents)}
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {t(FREQ_KEY[r.frequency])}
                        </div>
                      </div>
                      <Pencil className="text-muted-foreground size-4" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {monthlyTotal > 0 ? (
        <div className="bg-amber-500/10 border-amber-500/20 grid gap-1 rounded-xl border p-4 text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-medium">
            <TrendingDown className="size-4" />
            {t("cashflowHintTitle")}
          </div>
          <p
            className="text-xs"
            dangerouslySetInnerHTML={{
              __html: t("cashflowHintText", {
                total: formatMoney(monthlyTotal),
                business: formatMoney(businessMonthly),
                personal: formatMoney(privateMonthly),
              }),
            }}
          />
        </div>
      ) : null}

      <RecurringForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) {
            setEditing(null)
            setPrefillFromDetection(null)
          }
        }}
        initial={editing}
        prefilledFromDetection={
          prefillFromDetection
            ? {
                name: prefillFromDetection.vendor,
                vendor: prefillFromDetection.vendor,
                amountCents: prefillFromDetection.amountCents,
                frequency: prefillFromDetection.frequency,
                scope: prefillFromDetection.scope,
                kind: prefillFromDetection.kind,
                nextDue: defaultNextDue,
              }
            : null
        }
      />

      <span className="hidden">
        <ChevronRight />
      </span>
    </>
  )
}
