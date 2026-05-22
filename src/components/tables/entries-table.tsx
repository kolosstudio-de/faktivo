"use client"

/**
 * Income/expense entries table with rich filtering.
 *
 * Supported filters (synchronised with URL ?from=&to=&category_id=&q=&range=):
 *   - Date range presets: this_month / last_month / ytd / all / custom
 *   - Custom date range via two <input type="date">
 *   - Category multi-select (URL: comma-separated category_id)
 *   - Search box (vendor + description, case-insensitive)
 *
 * Sorting: by occurred_on desc by default; clicking the amount header
 * toggles between high→low / low→high.
 *
 * The component is used from /finances/(business|personal)/(expenses|income)
 * pages, with the `kind` and `scope` props determining which table it reads
 * and which categories to show in the dropdowns.
 */

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  ArrowUpDown,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanLine,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { formatMoney } from "@/lib/money"
import type {
  Category,
  DocScope,
  EntryKind,
  ExpenseEntry,
  IncomeEntry,
} from "@/types/database.types"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { EntryDialog } from "@/components/forms/entry-dialog"
import { BelegScanDialog } from "@/components/forms/beleg-scan-dialog"

type Entry = IncomeEntry | ExpenseEntry

interface Props {
  kind: EntryKind
  scope: DocScope
}

type RangeKey = "thisMonth" | "lastMonth" | "ytd" | "all" | "custom"
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc"

const RANGE_LABEL_KEYS: Record<RangeKey, string> = {
  thisMonth: "rangeThisMonth",
  lastMonth: "rangeLastMonth",
  ytd: "rangeYtd",
  all: "rangeAll",
  custom: "rangeCustom",
}

function computeRange(key: RangeKey): { from?: string; to?: string } {
  const now = new Date()
  if (key === "thisMonth")
    return {
      from: format(startOfMonth(now), "yyyy-MM-dd"),
      to: format(endOfMonth(now), "yyyy-MM-dd"),
    }
  if (key === "lastMonth") {
    const last = subMonths(now, 1)
    return {
      from: format(startOfMonth(last), "yyyy-MM-dd"),
      to: format(endOfMonth(last), "yyyy-MM-dd"),
    }
  }
  if (key === "ytd") {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: format(now, "yyyy-MM-dd"),
    }
  }
  return {}
}

const ymd = /^\d{4}-\d{2}-\d{2}$/

export function EntriesTable({ kind, scope }: Props) {
  const t = useTranslations("Finances")
  const tCommon = useTranslations("Common")
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ─── Initialize from URL ────────────────────────────────────────────────
  const urlFrom = searchParams.get("from") ?? ""
  const urlTo = searchParams.get("to") ?? ""
  const urlRange = (searchParams.get("range") ?? "") as RangeKey | ""
  const urlCats = (searchParams.get("category_id") ?? "")
    .split(",")
    .filter(Boolean)
  const urlSearch = searchParams.get("q") ?? ""

  // Determine initial range:
  //   - explicit ?range=X wins
  //   - explicit ?from/?to → "custom"
  //   - otherwise default ytd
  const initialRange: RangeKey = React.useMemo(() => {
    if (
      urlRange === "thisMonth" ||
      urlRange === "lastMonth" ||
      urlRange === "ytd" ||
      urlRange === "all" ||
      urlRange === "custom"
    ) {
      return urlRange
    }
    if (ymd.test(urlFrom) || ymd.test(urlTo)) return "custom"
    return "ytd"
  }, [urlRange, urlFrom, urlTo])

  const [range, setRange] = React.useState<RangeKey>(initialRange)
  const [customFrom, setCustomFrom] = React.useState<string>(urlFrom || "")
  const [customTo, setCustomTo] = React.useState<string>(urlTo || "")
  const [categoryFilter, setCategoryFilter] =
    React.useState<string[]>(urlCats)
  const [searchText, setSearchText] = React.useState<string>(urlSearch)
  const [sort, setSort] = React.useState<SortKey>("date_desc")

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [scanOpen, setScanOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Entry | null>(null)

  const table = kind === "income" ? "income_entries" : "expense_entries"

  // ─── Resolve effective range ────────────────────────────────────────────
  const effectiveRange = React.useMemo<{ from?: string; to?: string }>(() => {
    if (range === "custom") {
      return {
        from: ymd.test(customFrom) ? customFrom : undefined,
        to: ymd.test(customTo) ? customTo : undefined,
      }
    }
    return computeRange(range)
  }, [range, customFrom, customTo])

  // Sync URL whenever filters change (debounced for search)
  React.useEffect(() => {
    const params = new URLSearchParams()
    if (range !== "ytd") params.set("range", range)
    if (range === "custom") {
      if (effectiveRange.from) params.set("from", effectiveRange.from)
      if (effectiveRange.to) params.set("to", effectiveRange.to)
    }
    if (categoryFilter.length > 0)
      params.set("category_id", categoryFilter.join(","))
    if (searchText.trim()) params.set("q", searchText.trim())
    const qs = params.toString()
    const next = qs ? `${pathname}?${qs}` : pathname
    // Avoid pushing identical states (silences a known Next dev warning).
    const cur = window.location.search.replace(/^\?/, "")
    if (cur !== qs) router.replace(next, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customFrom, customTo, categoryFilter, searchText])

  // ─── Fetch ──────────────────────────────────────────────────────────────
  const { data = [] } = useQuery({
    queryKey: [
      table,
      {
        scope,
        from: effectiveRange.from,
        to: effectiveRange.to,
        categoryFilter,
        sort,
      },
    ],
    queryFn: async () => {
      let q = supabase
        .from(table)
        .select("*")
        .eq("scope", scope)
      if (sort === "date_desc")
        q = q.order("occurred_on", { ascending: false })
      else if (sort === "date_asc")
        q = q.order("occurred_on", { ascending: true })
      else if (sort === "amount_desc")
        q = q.order("amount_cents", { ascending: false })
      else q = q.order("amount_cents", { ascending: true })

      if (effectiveRange.from) q = q.gte("occurred_on", effectiveRange.from)
      if (effectiveRange.to) q = q.lte("occurred_on", effectiveRange.to)
      if (categoryFilter.length > 0) q = q.in("category_id", categoryFilter)
      const { data, error } = await q
      if (error) throw error
      return data as Entry[]
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", { scope, kind }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("scope", scope)
        .eq("kind", kind)
        .order("sort_order")
      if (error) throw error
      return data as Category[]
    },
  })

  const catById = React.useMemo(() => {
    const m = new Map<string, Category>()
    for (const c of categories) m.set(c.id, c)
    return m
  }, [categories])

  // ─── Client-side search ────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return data
    return data.filter((e) => {
      const vendor =
        kind === "income"
          ? (e as IncomeEntry).source ?? ""
          : (e as ExpenseEntry).vendor ?? ""
      const desc = e.description ?? ""
      return (
        vendor.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
      )
    })
  }, [data, searchText, kind])

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(tCommon("delete"))
      queryClient.invalidateQueries({ queryKey: [table] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const total = filtered.reduce((sum, e) => sum + e.amount_cents, 0)

  const Icon = kind === "income" ? TrendingUp : TrendingDown
  const iconColor = kind === "income" ? "text-emerald-500" : "text-rose-500"

  const hasAnyFilter =
    categoryFilter.length > 0 ||
    searchText.trim().length > 0 ||
    range !== "ytd" ||
    Boolean(customFrom) ||
    Boolean(customTo)

  function clearFilters() {
    setRange("ytd")
    setCategoryFilter([])
    setSearchText("")
    setCustomFrom("")
    setCustomTo("")
  }

  function toggleCategory(id: string) {
    setCategoryFilter((cur) =>
      cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]
    )
  }

  function nextSort() {
    setSort((cur) =>
      cur === "date_desc"
        ? "date_asc"
        : cur === "date_asc"
          ? "amount_desc"
          : cur === "amount_desc"
            ? "amount_asc"
            : "date_desc"
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <SelectTrigger className="w-44">
            <SelectValue>{t(RANGE_LABEL_KEYS[range])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABEL_KEYS) as RangeKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {t(RANGE_LABEL_KEYS[k])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {range === "custom" ? (
          <>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-36"
              aria-label={t("rangeFrom") || "From"}
            />
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-36"
              aria-label={t("rangeTo") || "To"}
            />
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-48 justify-between">
              <span className="truncate">
                {t("filterCategoryCount", { count: categoryFilter.length })}
              </span>
              <Check
                className={cn(
                  "size-3.5 opacity-0",
                  categoryFilter.length > 0 && "opacity-100"
                )}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-auto">
            <DropdownMenuLabel>{t("category")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCategoryFilter([])}>
              <span>{t("filterAllCategories")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={categoryFilter.includes(c.id)}
                onSelect={(e) => {
                  // keep menu open while toggling
                  e.preventDefault()
                  toggleCategory(c.id)
                }}
              >
                <span className="flex items-center gap-2">
                  {c.color ? (
                    <span
                      className="size-2 rounded-full"
                      style={{ background: c.color }}
                    />
                  ) : null}
                  {c.name}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative min-w-56 flex-1 max-w-md">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8 pr-7"
          />
          {searchText ? (
            <button
              type="button"
              onClick={() => setSearchText("")}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
              aria-label="clear"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {hasAnyFilter ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t("clearFilters")}
          </Button>
        ) : null}

        <div className="flex-1" />

        {kind === "expense" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setScanOpen(true)}
          >
            <ScanLine />
            Quittung scannen
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus />
          {kind === "income" ? t("addIncome") : t("addExpense")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
            <Icon className={cn("size-4", iconColor)} />
            {kind === "income" ? t("totalIncome") : t("totalExpenses")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {formatMoney(total)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("entryCount", { count: filtered.length })}
            {effectiveRange.from || effectiveRange.to ? (
              <>
                {" "}
                ·{" "}
                <span className="font-mono">
                  {effectiveRange.from ?? "…"} → {effectiveRange.to ?? "…"}
                </span>
              </>
            ) : null}
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="border-border/50 bg-card grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th
                  className="px-4 py-3 text-left font-medium cursor-pointer select-none"
                  onClick={() =>
                    setSort((cur) =>
                      cur === "date_desc" ? "date_asc" : "date_desc"
                    )
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {t("occurredOn")}
                    <ArrowUpDown className="size-3" />
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("category")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {kind === "income" ? "Quelle" : t("vendor")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("description")}
                </th>
                <th
                  className="px-4 py-3 text-right font-medium cursor-pointer select-none"
                  onClick={nextSort}
                >
                  <span className="inline-flex items-center gap-1">
                    {t("amount")}
                    <ArrowUpDown className="size-3" />
                  </span>
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const cat = e.category_id ? catById.get(e.category_id) : null
                const vendor =
                  kind === "income"
                    ? (e as IncomeEntry).source
                    : (e as ExpenseEntry).vendor
                return (
                  <tr key={e.id} className="hover:bg-muted/40 border-t">
                    <td className="px-4 py-3 font-mono text-xs">
                      {e.occurred_on}
                    </td>
                    <td className="px-4 py-3">
                      {cat ? (
                        <Badge
                          variant="outline"
                          style={
                            cat.color
                              ? {
                                  borderColor: cat.color + "66",
                                  color: cat.color,
                                }
                              : undefined
                          }
                        >
                          {cat.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{vendor ?? "—"}</td>
                    <td className="text-muted-foreground max-w-sm truncate px-4 py-3 text-xs">
                      {e.description ?? ""}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono tabular-nums",
                        kind === "income"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {kind === "income" ? "+" : "−"}
                      {formatMoney(e.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(e)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMut.mutate(e.id)}
                          >
                            <Trash2 /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <EntryDialog
        kind={kind}
        scope={scope}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setEditing(null)
        }}
        initial={editing}
      />

      {kind === "expense" ? (
        <BelegScanDialog
          scope={scope}
          open={scanOpen}
          onOpenChange={setScanOpen}
        />
      ) : null}
    </div>
  )
}
