"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useShowGermanCategoryLabels } from "@/lib/hooks/use-display-prefs"
import { formatMoney } from "@/lib/money"
import { translateCategoryName } from "@/lib/banking/category-translations"
import type { BankTransaction, Category } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import { TransactionEditPopover } from "@/components/banking/transaction-edit-popover"

interface Props {
  initialAccountId?: string
}

export function TransactionsFeed({ initialAccountId }: Props) {
  const t = useTranslations("Banking")
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  // URL filter takes precedence over the prop (used when linking from
  // /banking/accounts → /banking?account_id=...)
  const searchParams = useSearchParams()
  const accountIdFilter = searchParams.get("account_id") ?? initialAccountId

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["bank_transactions", accountIdFilter],
    queryFn: async () => {
      let q = supabase
        .from("bank_transactions")
        .select("*")
        .order("booking_date", { ascending: false })
        .limit(100)
      if (accountIdFilter) q = q.eq("account_id", accountIdFilter)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as BankTransaction[]
    },
  })

  // Categories — used for label/color rendering on matched rows + AI preview.
  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, scope, kind, name, color, is_jobcenter_relevant")
      if (error) throw error
      return (data ?? []) as Array<
        Pick<
          Category,
          "id" | "scope" | "kind" | "name" | "color" | "is_jobcenter_relevant"
        >
      >
    },
  })
  const categoriesById = React.useMemo(() => {
    const m = new Map<string, (typeof categories)[number]>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  // For matched rows: load the linked entries' category_id so we can show
  // the badge with name+color. We collect distinct linked-entry IDs.
  const expenseEntryIds = React.useMemo(
    () => Array.from(new Set(txs.map((x) => x.expense_entry_id).filter(Boolean) as string[])),
    [txs]
  )
  const incomeEntryIds = React.useMemo(
    () => Array.from(new Set(txs.map((x) => x.income_entry_id).filter(Boolean) as string[])),
    [txs]
  )

  const { data: expenseEntries = [] } = useQuery({
    queryKey: ["expense-entries-for-feed", expenseEntryIds.join(",")],
    enabled: expenseEntryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_entries")
        .select("id, category_id, scope")
        .in("id", expenseEntryIds)
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        category_id: string | null
        scope: "business" | "personal"
      }>
    },
  })
  const { data: incomeEntries = [] } = useQuery({
    queryKey: ["income-entries-for-feed", incomeEntryIds.join(",")],
    enabled: incomeEntryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("income_entries")
        .select("id, category_id, scope")
        .in("id", incomeEntryIds)
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        category_id: string | null
        scope: "business" | "personal"
      }>
    },
  })

  function entryFor(tx: BankTransaction):
    | { category_id: string | null; scope: "business" | "personal" }
    | null {
    if (tx.expense_entry_id) {
      return (
        expenseEntries.find((e) => e.id === tx.expense_entry_id) ?? null
      )
    }
    if (tx.income_entry_id) {
      return incomeEntries.find((e) => e.id === tx.income_entry_id) ?? null
    }
    return null
  }

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/banking/sync", { method: "POST" })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? t("syncFailed"))
      }
      return r.json()
    },
    onSuccess: (s) => {
      toast.success(
        t("syncToast", {
          accounts: s.accounts_synced,
          tx: s.transactions_inserted,
          matched: s.payments_matched,
        })
      )
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  React.useEffect(() => {
    fetch("/api/banking/sync", { method: "POST" })
      .then(async (r) => {
        if (!r.ok) return
        const s = (await r.json()) as { transactions_inserted: number }
        if (s.transactions_inserted > 0) {
          toast.success(
            t("autoLoadedToast", { count: s.transactions_inserted })
          )
          queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
          queryClient.invalidateQueries({ queryKey: ["invoices"] })
        }
      })
      .catch(() => {
        /* silent */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismissMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_transactions")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
    },
  })

  const restoreMut = useMutation({
    mutationFn: async (id: string) => {
      // 1. Un-dismiss the row.
      const { error: undismissErr } = await supabase
        .from("bank_transactions")
        .update({ dismissed_at: null })
        .eq("id", id)
      if (undismissErr) throw undismissErr

      // 2. Re-read the row to inspect Bürgergeld / linkage state.
      const { data: tx, error: txErr } = await supabase
        .from("bank_transactions")
        .select(
          "id, amount_cents, booking_date, counterparty_name, remittance_info, is_buergergeld, expense_entry_id, income_entry_id, payment_id, currency"
        )
        .eq("id", id)
        .single()
      if (txErr || !tx) return

      // 3. If this is a Bürgergeld credit that was never materialized,
      //    auto-create an income_entry now so EKS verification has data.
      if (
        tx.is_buergergeld === true &&
        tx.amount_cents > 0 &&
        !tx.income_entry_id &&
        !tx.expense_entry_id &&
        !tx.payment_id
      ) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Find the personal/income "Bürgergeld" category.
        const { data: cats } = await supabase
          .from("categories")
          .select("id, name")
          .eq("user_id", user.id)
          .eq("scope", "personal")
          .eq("kind", "income")
        const buergergeldCat =
          (cats ?? []).find((c) =>
            /b[üu]rgergeld/i.test(c.name as string),
          ) ?? null
        if (!buergergeldCat) return

        const { data: incomeRow } = await supabase
          .from("income_entries")
          .insert({
            user_id: user.id,
            scope: "personal",
            occurred_on: tx.booking_date,
            amount_cents: Math.abs(tx.amount_cents),
            currency: tx.currency || "EUR",
            category_id: buergergeldCat.id,
            source: tx.counterparty_name ?? "Jobcenter",
            description: (tx.remittance_info ?? "").slice(0, 500),
            jobcenter_relevant: false,
          })
          .select("id")
          .single()
        if (incomeRow) {
          await supabase
            .from("bank_transactions")
            .update({ income_entry_id: incomeRow.id })
            .eq("id", id)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
    },
  })

  // Single-tx materialization (Zuordnen click on a raw row) — uses the
  // suggested values when present, otherwise treats it as "scope=is_business
  // ? business : personal" and lets the inline editor fill the category.
  const assignMut = useMutation({
    mutationFn: async (tx: BankTransaction) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("not authenticated")

      const isCredit = tx.amount_cents > 0
      const scope: "business" | "personal" =
        tx.suggested_scope ?? (tx.is_business ? "business" : "personal")

      // Pick category — prefer suggestion, otherwise pick a "Sonstiges"
      // fallback to keep the entry valid.
      let categoryId = tx.suggested_category_id ?? null
      if (!categoryId) {
        const kind = isCredit ? "income" : "expense"
        const fallbackNames =
          kind === "expense"
            ? ["Sonstige Betriebsausgaben", "Sonstiges"]
            : ["Sonstige betriebliche Erträge", "Geschenke / Sonstiges", "Sonstiges"]
        for (const name of fallbackNames) {
          const c = categories.find(
            (c) => c.scope === scope && c.kind === kind && c.name === name
          )
          if (c) {
            categoryId = c.id
            break
          }
        }
        if (!categoryId) {
          const any = categories.find(
            (c) => c.scope === scope && c.kind === kind
          )
          if (any) categoryId = any.id
        }
      }

      const description = (tx.remittance_info ?? "").slice(0, 500)

      if (isCredit) {
        const { data: row, error } = await supabase
          .from("income_entries")
          .insert({
            user_id: user.id,
            scope,
            occurred_on: tx.booking_date,
            amount_cents: Math.abs(tx.amount_cents),
            currency: tx.currency || "EUR",
            category_id: categoryId,
            source: tx.counterparty_name ?? "Bank-Eingang",
            description,
            jobcenter_relevant: false,
          })
          .select()
          .single()
        if (error) throw error
        await supabase
          .from("bank_transactions")
          .update({ income_entry_id: row.id })
          .eq("id", tx.id)
      } else {
        const { data: row, error } = await supabase
          .from("expense_entries")
          .insert({
            user_id: user.id,
            scope,
            occurred_on: tx.booking_date,
            amount_cents: Math.abs(tx.amount_cents),
            currency: tx.currency || "EUR",
            category_id: categoryId,
            vendor: tx.counterparty_name,
            description,
            vat_rate: 19,
            is_deductible: scope === "business",
          })
          .select()
          .single()
        if (error) throw error
        await supabase
          .from("bank_transactions")
          .update({ expense_entry_id: row.id })
          .eq("id", tx.id)
      }
    },
    onSuccess: () => {
      toast.success(t("expenseAdded"))
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const materializeAllMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/banking/materialize-all", {
        method: "POST",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "materialize failed")
      }
      return (await r.json()) as { materialized: number; skipped: number }
    },
    onSuccess: (res) => {
      toast.success(t("materializedToast", { count: res.materialized }))
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const detectTransfersMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/banking/detect-transfers", {
        method: "POST",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? t("detectTransfersError"))
      }
      return (await r.json()) as { pairs: number; legs: number }
    },
    onSuccess: (res) => {
      toast.success(t("detectTransfersToast", { pairs: res.pairs, legs: res.legs }))
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const visibleTxs = txs.filter((x) => !x.dismissed_at)
  const dismissedTxs = txs.filter((x) => x.dismissed_at)
  // Unmatched = not yet materialized AND not a self-transfer.
  // Self-transfers are intentionally excluded from auto-materialize because
  // they aren't real income or expense — they're just money moving between
  // the user's own accounts. Showing them in "X нерозподілено" would be
  // misleading (the Auto-button can't do anything with them).
  const unmatchedCount = visibleTxs.filter(
    (x) =>
      !x.payment_id &&
      !x.expense_entry_id &&
      !x.income_entry_id &&
      !x.is_transfer
  ).length

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-muted-foreground text-xs">
            {t("txCount", { count: visibleTxs.length })}{" "}
            <strong className="text-foreground">{unmatchedCount}</strong>{" "}
            {t("unmatchedSuffix")}
          </div>
          <div className="flex items-center gap-2">
            {unmatchedCount > 0 ? (
              <div className="grid gap-0.5">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => materializeAllMut.mutate()}
                  disabled={materializeAllMut.isPending}
                >
                  {materializeAllMut.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  {materializeAllMut.isPending
                    ? t("materializingNow")
                    : t("materializeAll", { count: unmatchedCount })}
                </Button>
                <span className="text-muted-foreground text-[10px] text-right">
                  {t("materializeAllHint")}
                </span>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => detectTransfersMut.mutate()}
              disabled={detectTransfersMut.isPending}
              title={t("detectTransfersHint")}
            >
              {detectTransfersMut.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowLeftRight />
              )}
              {t("detectTransfers")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
            >
              {syncMut.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              {t("sync")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">{t("loadingTx")}</p>
        ) : visibleTxs.length === 0 && dismissedTxs.length === 0 ? (
          <div className="border-border/50 bg-card grid place-items-center rounded-2xl border border-dashed py-16 text-center">
            <p className="text-muted-foreground text-sm">{t("noTxYet")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[28%]" />
                <col className="w-[28%]" />
                <col className="w-[110px]" />
                <col />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("colDate")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("colCounterparty")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("colReference")}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("colAmount")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("colStatus")}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleTxs.map((tx) => {
                  const isIncoming = tx.amount_cents > 0
                  const matched = Boolean(
                    tx.payment_id || tx.expense_entry_id || tx.income_entry_id
                  )
                  const linkedEntry = matched ? entryFor(tx) : null
                  const linkedCategory = linkedEntry?.category_id
                    ? categoriesById.get(linkedEntry.category_id) ?? null
                    : null
                  const suggestedCategory = !matched && tx.suggested_category_id
                    ? categoriesById.get(tx.suggested_category_id) ?? null
                    : null
                  const suggestedScope =
                    tx.suggested_scope ??
                    (tx.is_business ? "business" : "personal")

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-muted/20 align-middle ${
                        tx.is_transfer ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs font-mono">
                        {tx.booking_date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {isIncoming ? (
                            <ArrowDownLeft className="size-4 shrink-0 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="size-4 shrink-0 text-rose-500" />
                          )}
                          <span
                            className="truncate"
                            title={tx.counterparty_name ?? ""}
                          >
                            {tx.counterparty_name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        <span
                          className="block truncate"
                          title={tx.remittance_info ?? ""}
                        >
                          {tx.remittance_info ?? "—"}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${
                          isIncoming
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatMoney(tx.amount_cents)}
                      </td>
                      <td className="px-4 py-3">
                        {tx.is_transfer ? (
                          <span
                            className="bg-slate-500/10 text-slate-700 dark:text-slate-300 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            title={
                              tx.transfer_pair_id
                                ? `${t("statusTransfer")} · ${tx.transfer_pair_id.slice(0, 8)}…`
                                : t("statusTransfer")
                            }
                          >
                            <ArrowLeftRight className="size-3" />
                            {t("statusTransfer")}
                          </span>
                        ) : matched ? (
                          <MatchedBadge
                            tx={tx}
                            linkedCategory={linkedCategory}
                            scope={linkedEntry?.scope ?? null}
                          />
                        ) : (
                          <RawSuggestion
                            tx={tx}
                            suggestedCategory={suggestedCategory}
                            suggestedScope={suggestedScope}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {tx.is_transfer ? (
                            // Self-transfers — no action needed; muted dash
                            <span className="text-muted-foreground/40 text-xs">
                              —
                            </span>
                          ) : !matched ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => assignMut.mutate(tx)}
                                disabled={assignMut.isPending}
                                className="h-7"
                              >
                                {suggestedCategory ? (
                                  <span className="truncate max-w-[180px]">
                                    {t("assignAsCategory", {
                                      category: translateCategoryName(
                                        suggestedCategory.name,
                                        t
                                      ),
                                      scope:
                                        suggestedScope === "business"
                                          ? t("scopeBusiness")
                                          : t("scopePersonal"),
                                    })}
                                  </span>
                                ) : (
                                  t("assign")
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => dismissMut.mutate(tx.id)}
                                className="size-7 text-muted-foreground"
                                aria-label={t("dismiss")}
                                title={t("dismiss")}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          ) : (
                            <TransactionEditPopover
                              tx={tx}
                              trigger={
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground"
                                  aria-label={t("editCategory")}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {dismissedTxs.map((tx) => {
                  const isIncoming = tx.amount_cents > 0
                  return (
                    <tr
                      key={tx.id}
                      className="opacity-50 hover:bg-muted/20 align-middle"
                    >
                      <td className="px-4 py-3 text-xs font-mono">
                        {tx.booking_date}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {isIncoming ? (
                            <ArrowDownLeft className="size-4 shrink-0 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="size-4 shrink-0 text-rose-500" />
                          )}
                          <span className="truncate">
                            {tx.counterparty_name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        <span className="block truncate">
                          {tx.remittance_info ?? "—"}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${
                          isIncoming
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {formatMoney(tx.amount_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-muted text-muted-foreground inline-block rounded-full px-2 py-0.5 text-[10px] font-medium">
                          {t("dismissed")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => restoreMut.mutate(tx.id)}
                            className="size-7 text-muted-foreground"
                            aria-label={t("restore")}
                            title={t("restore")}
                          >
                            <RotateCcw className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── MatchedBadge ────────────────────────────────────────────────────────

function MatchedBadge({
  tx,
  linkedCategory,
  scope,
}: {
  tx: BankTransaction
  linkedCategory:
    | Pick<Category, "id" | "name" | "color" | "is_jobcenter_relevant">
    | null
  scope: "business" | "personal" | null
}) {
  const t = useTranslations("Banking")
  const label = tx.payment_id
    ? t("statusPayment")
    : tx.expense_entry_id
      ? t("statusExpense")
      : t("statusIncome")

  return (
    <div className="grid gap-0.5">
      <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
        <CheckCircle2 className="size-3" />
        {label}
        {tx.ai_auto_imported_at ? " · AI" : ""}
      </span>
      {linkedCategory ? (
        <CategoryLabel
          name={linkedCategory.name}
          color={linkedCategory.color}
          scope={scope}
        />
      ) : null}
    </div>
  )
}

// ─── CategoryLabel: translated name + German subtitle when different ────
// Shows the user's locale label as primary, with the German source name
// in a smaller muted line beneath it (industry standard for DE finance
// tools — lets the user cross-reference DATEV/SKR03/Steuerberater talk).

function CategoryLabel({
  name,
  color,
  scope,
}: {
  name: string  // German source name
  color: string | null
  scope: "business" | "personal" | null
}) {
  const t = useTranslations("Banking")
  const [showGermanLabels] = useShowGermanCategoryLabels()
  const translated = translateCategoryName(name, t)
  const showGermanSubtitle = showGermanLabels && translated !== name
  return (
    <span className="grid gap-0.5 leading-tight">
      <span className="inline-flex items-center gap-1.5 text-[11px]">
        <span
          className="size-2 rounded-full shrink-0"
          style={{ background: color ?? "#94a3b8" }}
        />
        <span className="truncate">{translated}</span>
        {scope ? (
          <span className="text-muted-foreground text-[10px]">
            · {scope === "business" ? t("scopeBusiness") : t("scopePersonal")}
          </span>
        ) : null}
      </span>
      {showGermanSubtitle ? (
        <span className="text-muted-foreground/70 pl-3.5 text-[9px] italic">
          {name}
        </span>
      ) : null}
    </span>
  )
}

// ─── RawSuggestion (AI / rule preview chip on raw rows) ─────────────────

function RawSuggestion({
  tx,
  suggestedCategory,
  suggestedScope,
}: {
  tx: BankTransaction
  suggestedCategory:
    | Pick<Category, "id" | "name" | "color" | "is_jobcenter_relevant">
    | null
  suggestedScope: "business" | "personal"
}) {
  const t = useTranslations("Banking")

  if (suggestedCategory) {
    const isAi = tx.suggestion_source === "ai"
    return (
      <div className="grid gap-0.5">
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isAi
              ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
              : "bg-sky-500/10 text-sky-700 dark:text-sky-400"
          }`}
        >
          <Sparkles className="size-3" />
          {isAi ? t("aiSuggestion") : t("ruleApplied")}
        </span>
        <CategoryLabel
          name={suggestedCategory.name}
          color={suggestedCategory.color}
          scope={suggestedScope}
        />
      </div>
    )
  }

  if (tx.ai_classified_at) {
    return (
      <div className="grid gap-0.5">
        <span
          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            (tx.ai_confidence ?? 0) >= 0.8
              ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
              : (tx.ai_confidence ?? 0) >= 0.5
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
          }`}
          title={tx.ai_reasoning ?? ""}
        >
          <Sparkles className="size-3" />
          {tx.ai_scope === "private" ? t("statusPrivate") : t("statusBusiness")}{" "}
          · {tx.ai_category ?? "—"}
          {typeof tx.ai_confidence === "number"
            ? ` · ${Math.round(tx.ai_confidence * 100)}%`
            : ""}
        </span>
      </div>
    )
  }

  return (
    <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium">
      {t("statusOpen")}
      {tx.category_hint ? ` · ${tx.category_hint}` : ""}
    </span>
  )
}
