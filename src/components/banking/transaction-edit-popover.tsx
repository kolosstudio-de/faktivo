"use client"

/**
 * Inline editor for a *matched* bank_transaction.
 *
 * Opens via a small "edit" trigger on each matched row. Lets the user
 * change the linked income/expense entry's `scope` and `category_id`
 * without re-creating the entry. The amount stays untouched, so all
 * derived numbers (Cash Flow / EÜR / EKS) remain consistent.
 *
 * The component figures out by itself whether the linked entry is an
 * `income_entries` row or `expense_entries` row by inspecting which
 * `*_entry_id` is set on the transaction.
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSupabase } from "@/lib/hooks/use-supabase"
import { translateCategoryName } from "@/lib/banking/category-translations"
import type { BankTransaction, Category } from "@/types/database.types"

type Scope = "business" | "personal"
type Kind = "income" | "expense"

interface Props {
  tx: BankTransaction
  trigger: React.ReactNode
  onSaved?: () => void
}

export function TransactionEditPopover({ tx, trigger, onSaved }: Props) {
  const t = useTranslations("Banking")
  const tCommon = useTranslations("Common")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const kind: Kind | null = tx.income_entry_id
    ? "income"
    : tx.expense_entry_id
      ? "expense"
      : null

  const [open, setOpen] = React.useState(false)
  const [scope, setScope] = React.useState<Scope>(
    (tx.is_business ? "business" : "personal") as Scope
  )
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [hydrated, setHydrated] = React.useState(false)

  // Categories filtered by scope+kind once popover opens.
  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories-for-edit", kind],
    enabled: open && !!kind,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, scope, kind, name, color, is_jobcenter_relevant")
        .eq("kind", kind!)
        .order("sort_order", { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<
        Pick<
          Category,
          "id" | "scope" | "kind" | "name" | "color" | "is_jobcenter_relevant"
        >
      >
    },
  })

  // On open, hydrate scope+category from the linked entry.
  React.useEffect(() => {
    if (!open || hydrated || !kind) return
    void (async () => {
      const linkedId =
        kind === "income" ? tx.income_entry_id : tx.expense_entry_id
      if (!linkedId) {
        setHydrated(true)
        return
      }
      const table = kind === "income" ? "income_entries" : "expense_entries"
      const { data } = await supabase
        .from(table)
        .select("scope, category_id")
        .eq("id", linkedId)
        .maybeSingle()
      if (data) {
        const row = data as { scope: Scope; category_id: string | null }
        setScope(row.scope)
        setCategoryId(row.category_id)
      }
      setHydrated(true)
    })()
  }, [open, hydrated, kind, supabase, tx.expense_entry_id, tx.income_entry_id])

  const filteredCategories = React.useMemo(
    () => allCategories.filter((c) => c.scope === scope),
    [allCategories, scope]
  )

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!kind) throw new Error("Transaction has no linked entry")
      if (!categoryId) throw new Error("category required")
      const linkedId =
        kind === "income" ? tx.income_entry_id : tx.expense_entry_id
      if (!linkedId) throw new Error("missing entry id")

      const cat = allCategories.find((c) => c.id === categoryId)
      const isJobcenterRelevant = cat?.is_jobcenter_relevant ?? false

      if (kind === "income") {
        const isBuergergeld = tx.is_buergergeld === true
        const { error } = await supabase
          .from("income_entries")
          .update({
            scope,
            category_id: categoryId,
            jobcenter_relevant:
              !isBuergergeld && scope === "business" && isJobcenterRelevant,
          })
          .eq("id", linkedId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("expense_entries")
          .update({
            scope,
            category_id: categoryId,
            is_deductible: scope === "business",
          })
          .eq("id", linkedId)
        if (error) throw error
      }

      // Keep is_business mirror on bank_transactions in sync so future
      // filter-by-business UI stays correct.
      await supabase
        .from("bank_transactions")
        .update({ is_business: scope === "business" })
        .eq("id", tx.id)

      return cat
    },
    onSuccess: (cat) => {
      const label = cat
        ? translateCategoryName(cat.name, t as unknown as Parameters<typeof translateCategoryName>[1])
        : ""
      toast.success(t("movedToCategory", { category: label }))
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
      queryClient.invalidateQueries({ queryKey: ["income_entries"] })
      queryClient.invalidateQueries({ queryKey: ["expense_entries"] })
      setOpen(false)
      onSaved?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!kind) return null

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setHydrated(false)
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 grid gap-3 p-3" align="end">
        <PopoverTitle className="text-sm font-medium">
          {t("editCategoryTitle")}
        </PopoverTitle>

        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">
            {t("chooseScope")}
          </span>
          <div className="bg-muted inline-flex rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setScope("business")}
              className={`flex-1 rounded-sm px-2.5 py-1 text-xs transition ${
                scope === "business"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t("scopeBusiness")}
            </button>
            <button
              type="button"
              onClick={() => setScope("personal")}
              className={`flex-1 rounded-sm px-2.5 py-1 text-xs transition ${
                scope === "personal"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {t("scopePersonal")}
            </button>
          </div>
        </div>

        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">
            {t("chooseCategory")}
          </span>
          <Select
            value={categoryId ?? undefined}
            onValueChange={(v) => setCategoryId(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {categoryId
                  ? translateCategoryName(
                      filteredCategories.find((c) => c.id === categoryId)
                        ?.name ?? "",
                      t as unknown as Parameters<
                        typeof translateCategoryName
                      >[1]
                    ) || t("noCategory")
                  : t("noCategory")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    {c.color ? (
                      <span
                        className="size-2 rounded-full"
                        style={{ background: c.color }}
                      />
                    ) : null}
                    {translateCategoryName(
                      c.name,
                      t as unknown as Parameters<
                        typeof translateCategoryName
                      >[1]
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={saveMut.isPending}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !categoryId}
          >
            {saveMut.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            {tCommon("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
