"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/money"
import { createClient } from "@/lib/supabase/client"
import { translateCategoryName } from "@/lib/banking/category-translations"
import { concurrentMap } from "@/lib/utils/concurrency"

// ─── Types (mirror server contracts) ──────────────────────────────────

interface ParsedTransaction {
  occurred_on: string
  amount_cents: number
  currency: string
  description: string
  counterparty?: string
  reference?: string
  iban?: string
  type: "credit" | "debit"
  // ─── Suggestion fields (set by server)
  suggested_category_id?: string | null
  suggested_category_name?: string
  suggested_scope?: "business" | "personal"
  suggestion_source?: "rule" | "ai" | "none"
  suggestion_confidence?: number
  suggestion_reason?: string
  // ─── Local state (chosen by user in preview)
  chosen_category_id?: string | null
  chosen_scope?: "business" | "personal"
  user_changed?: boolean
  // ─── Bulk-mode tagging
  source_file?: string
}

interface ParsedStatement {
  bank_name?: string
  account_iban?: string
  period_start?: string
  period_end?: string
  opening_balance_cents?: number
  closing_balance_cents?: number
  transactions: ParsedTransaction[]
  warnings: string[]
}

interface PreviewResponse {
  ok: true
  pages: number
  statement: ParsedStatement
}

interface ErrorResponse {
  ok: false
  error: string
  message?: string
}

interface CommitResponse {
  ok: true
  inserted: number
  duplicates: number
  rules_upserted?: number
}

interface CategoryRow {
  id: string
  name: string
  scope: "business" | "personal"
  kind: "income" | "expense"
  color: string | null
}

type FileStatus = "pending" | "processing" | "done" | "failed"

interface FileEntry {
  file: File
  status: FileStatus
  error?: string
  statement?: ParsedStatement
}

const MAX_FILES = 50
const MAX_BYTES = 5 * 1024 * 1024
const CONCURRENT_LIMIT = 3

// ─── Component ────────────────────────────────────────────────────────

export function PdfImportDialog() {
  const t = useTranslations("Banking")
  const queryClient = useQueryClient()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  // Bulk file tracking
  const [files, setFiles] = React.useState<FileEntry[]>([])
  const [processingActive, setProcessingActive] = React.useState(false)
  const [transactions, setTransactions] = React.useState<ParsedTransaction[]>(
    []
  )
  const [errorState, setErrorState] = React.useState<{
    code: string
    message: string
  } | null>(null)
  const [commitProgress, setCommitProgress] = React.useState<{
    current: number
    total: number
  } | null>(null)

  // Categories — fetched once when dialog opens
  const supabase = React.useMemo(() => createClient(), [])
  const categoriesQuery = useQuery({
    queryKey: ["pdf-import-categories"],
    enabled: open,
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, scope, kind, color")
        .order("sort_order", { ascending: true })
      if (error) throw error
      return (data ?? []) as CategoryRow[]
    },
    staleTime: 60_000,
  })

  const categories = categoriesQuery.data ?? []

  const reset = React.useCallback(() => {
    setFiles([])
    setProcessingActive(false)
    setTransactions([])
    setErrorState(null)
    setCommitProgress(null)
  }, [])

  // Successful statements (memoised for downstream UI / commits).
  const successfulFiles = React.useMemo(
    () => files.filter((f) => f.status === "done" && f.statement),
    [files]
  )
  const allDone = React.useMemo(
    () =>
      files.length > 0 &&
      files.every((f) => f.status === "done" || f.status === "failed"),
    [files]
  )

  // Combined statement metadata (period range + source list).
  const combinedMeta = React.useMemo(() => {
    if (successfulFiles.length === 0) return null
    let periodStart: string | undefined
    let periodEnd: string | undefined
    const sources: string[] = []
    for (const fe of successfulFiles) {
      const s = fe.statement!
      sources.push(fe.file.name)
      if (s.period_start) {
        if (!periodStart || s.period_start < periodStart)
          periodStart = s.period_start
      }
      if (s.period_end) {
        if (!periodEnd || s.period_end > periodEnd) periodEnd = s.period_end
      }
    }
    return { periodStart, periodEnd, sources }
  }, [successfulFiles])

  // ─── Preview a single file (used by bulk pipeline) ──────────────────
  const previewSingle = React.useCallback(
    async (file: File): Promise<ParsedStatement> => {
      const fd = new FormData()
      fd.append("pdf", file)
      const r = await fetch("/api/banking/import-pdf", {
        method: "POST",
        body: fd,
      })
      const data = (await r.json()) as PreviewResponse | ErrorResponse
      if (!r.ok || !("ok" in data) || !data.ok) {
        const err = data as ErrorResponse
        const msg = mapErrorToMessage(err.error, t)
        throw new Error(msg)
      }
      return data.statement
    },
    [t]
  )

  // Run the bulk pipeline. Updates files state as items complete.
  const startBulkProcessing = React.useCallback(
    async (entries: FileEntry[]) => {
      setProcessingActive(true)
      setErrorState(null)

      await concurrentMap(entries, CONCURRENT_LIMIT, async (entry) => {
        // Mark as processing
        setFiles((prev) =>
          prev.map((f) =>
            f.file === entry.file ? { ...f, status: "processing" } : f
          )
        )
        try {
          const statement = await previewSingle(entry.file)
          setFiles((prev) =>
            prev.map((f) =>
              f.file === entry.file
                ? { ...f, status: "done", statement }
                : f
            )
          )
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          setFiles((prev) =>
            prev.map((f) =>
              f.file === entry.file
                ? { ...f, status: "failed", error: msg }
                : f
            )
          )
        }
      })

      setProcessingActive(false)
    },
    [previewSingle]
  )

  // When all files have completed, build the combined transactions list.
  React.useEffect(() => {
    if (!allDone || processingActive) return
    if (transactions.length > 0) return // already seeded
    if (successfulFiles.length === 0) return

    const seeded: ParsedTransaction[] = []
    for (const fe of successfulFiles) {
      const s = fe.statement!
      for (const tx of s.transactions) {
        seeded.push({
          ...tx,
          source_file: fe.file.name,
          chosen_category_id: tx.suggested_category_id ?? null,
          chosen_scope:
            tx.suggested_scope ??
            (tx.amount_cents >= 0 ? "business" : "personal"),
          user_changed: false,
        })
      }
    }
    setTransactions(seeded)
  }, [allDone, processingActive, successfulFiles, transactions.length])

  // ─── Validate + add files to the queue ─────────────────────────────
  const acceptFiles = React.useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return
      // Cap at MAX_FILES total (existing + incoming).
      if (incoming.length > MAX_FILES) {
        toast.error(t("bulkPdfTooMany"))
        incoming = incoming.slice(0, MAX_FILES)
      }

      const accepted: FileEntry[] = []
      for (const file of incoming) {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
        if (!isPdf) {
          toast.error(t("bulkPdfNotPdf", { name: file.name }))
          continue
        }
        if (file.size > MAX_BYTES) {
          toast.error(t("bulkPdfFileTooLarge", { name: file.name }))
          continue
        }
        accepted.push({ file, status: "pending" })
      }

      if (accepted.length === 0) return

      setFiles(accepted)
      setTransactions([])
      setErrorState(null)
      void startBulkProcessing(accepted)
    },
    [startBulkProcessing, t]
  )

  // ─── Sequential per-statement commit ────────────────────────────────
  const commitMut = useMutation({
    mutationFn: async (): Promise<{
      totalInserted: number
      filesProcessed: number
    }> => {
      let totalInserted = 0
      const groups = successfulFiles
      setCommitProgress({ current: 0, total: groups.length })
      for (let i = 0; i < groups.length; i++) {
        const fe = groups[i]
        setCommitProgress({ current: i + 1, total: groups.length })
        const stmt = fe.statement!
        const groupTx = transactions.filter(
          (tx) => tx.source_file === fe.file.name
        )
        if (groupTx.length === 0) continue
        const r = await fetch("/api/banking/import-pdf/commit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            bank_name: stmt.bank_name,
            account_iban: stmt.account_iban,
            transactions: groupTx.map((tx) => ({
              occurred_on: tx.occurred_on,
              amount_cents: tx.amount_cents,
              currency: tx.currency,
              description: tx.description,
              counterparty: tx.counterparty,
              reference: tx.reference,
              iban: tx.iban,
              type: tx.type,
              category_id: tx.chosen_category_id ?? null,
              scope: tx.chosen_scope ?? "business",
              accepted_suggestion: !tx.user_changed,
              suggestion_source: tx.suggestion_source ?? "none",
              suggested_category_id: tx.suggested_category_id ?? null,
              source_file: tx.source_file,
            })),
          }),
        })
        const data = (await r.json()) as
          | CommitResponse
          | { error: string }
        if (!r.ok || !("ok" in data)) {
          const err = data as { error: string }
          throw new Error(err.error ?? t("importFailed"))
        }
        totalInserted += data.inserted
      }
      return { totalInserted, filesProcessed: groups.length }
    },
    onSuccess: (s) => {
      toast.success(
        t("bulkPdfDoneToast", { files: s.filesProcessed, tx: s.totalInserted })
      )
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      setOpen(false)
      reset()
      router.refresh()
    },
    onError: (e: Error) => {
      setCommitProgress(null)
      toast.error(e.message)
    },
  })

  const total = React.useMemo(
    () => transactions.reduce((acc, tx) => acc + tx.amount_cents, 0),
    [transactions]
  )

  const updateTx = (idx: number, patch: Partial<ParsedTransaction>) => {
    setTransactions((prev) =>
      prev.map((tx, i) => (i === idx ? { ...tx, ...patch } : tx))
    )
  }

  const setChosenCategory = (idx: number, categoryId: string | null) => {
    setTransactions((prev) =>
      prev.map((tx, i) => {
        if (i !== idx) return tx
        const cat = categoryId
          ? categories.find((c) => c.id === categoryId)
          : null
        return {
          ...tx,
          chosen_category_id: categoryId,
          chosen_scope: cat?.scope ?? tx.chosen_scope,
          user_changed:
            (tx.suggested_category_id ?? null) !== (categoryId ?? null),
        }
      })
    )
  }

  const setChosenScope = (idx: number, scope: "business" | "personal") => {
    setTransactions((prev) =>
      prev.map((tx, i) => {
        if (i !== idx) return tx
        const cat = tx.chosen_category_id
          ? categories.find((c) => c.id === tx.chosen_category_id)
          : null
        const keep = cat && cat.scope === scope
        return {
          ...tx,
          chosen_scope: scope,
          chosen_category_id: keep ? tx.chosen_category_id : null,
          user_changed:
            tx.suggested_scope !== scope ||
            (tx.suggested_category_id ?? null) !==
              (keep ? tx.chosen_category_id ?? null : null),
        }
      })
    )
  }

  // Drag-drop wiring.
  const [dragOver, setDragOver] = React.useState(false)

  const showDropZone =
    files.length === 0 && !processingActive && transactions.length === 0
  const showFileList = files.length > 0 && transactions.length === 0
  const showPreview =
    transactions.length > 0 && allDone && !processingActive

  const aggregatedWarnings = React.useMemo(() => {
    const out: { source: string; warning: string }[] = []
    for (const fe of successfulFiles) {
      for (const w of fe.statement!.warnings) {
        out.push({ source: fe.file.name, warning: w })
      }
    }
    return out
  }, [successfulFiles])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText />
          {t("importPdf")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] !w-[98vw] !max-w-[1400px] overflow-y-auto sm:!max-w-[1400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            {t("bulkPdfTitle")}
          </DialogTitle>
          <DialogDescription>{t("bulkPdfHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {/* ─── Step 1: file picker / drag-drop ─── */}
          {showDropZone ? (
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const list = Array.from(e.dataTransfer.files ?? [])
                acceptFiles(list)
              }}
              className={`grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed p-12 text-center transition ${
                dragOver
                  ? "bg-primary/10 border-primary"
                  : "border-primary/30 hover:bg-muted/40"
              }`}
            >
              <div className="bg-primary/10 text-primary grid size-14 place-items-center rounded-2xl">
                <Upload className="size-6" />
              </div>
              <p className="font-medium">{t("pdfDropZone")}</p>
              <p className="text-muted-foreground text-xs">
                {t("bulkPdfMaxFiles")}
              </p>
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? [])
                  acceptFiles(list)
                }}
              />
            </label>
          ) : null}

          {/* ─── Step 2: per-file processing list ─── */}
          {showFileList ? (
            <div className="grid gap-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {processingActive ? (
                  <Loader2 className="text-primary size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                )}
                {processingActive
                  ? t("pdfExtracting")
                  : t("bulkPdfStatusDone")}
              </div>
              <div className="grid gap-1.5">
                {files.map((fe, i) => (
                  <FileRow key={i} entry={fe} t={t} />
                ))}
              </div>
            </div>
          ) : null}

          {/* ─── Error state (validation/global) ─── */}
          {errorState ? (
            <div className="bg-destructive/10 border-destructive/30 grid gap-2 rounded-xl border p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                {errorState.message}
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                {t("cancel")}
              </Button>
            </div>
          ) : null}

          {/* ─── Step 3: combined preview ─── */}
          {showPreview && combinedMeta ? (
            <div className="grid gap-3">
              <div className="bg-muted/40 grid gap-1 rounded-xl border p-3 text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="text-primary size-3.5" />
                  {t("pdfPreviewTitle", { count: transactions.length })}
                </div>
                <p className="text-muted-foreground">{t("pdfPreviewHint")}</p>
                <dl className="mt-1 grid grid-cols-[120px_1fr] gap-x-3 gap-y-0.5">
                  {combinedMeta.periodStart || combinedMeta.periodEnd ? (
                    <>
                      <dt className="text-muted-foreground">{t("pdfPeriod")}</dt>
                      <dd>
                        {combinedMeta.periodStart ?? "?"} —{" "}
                        {combinedMeta.periodEnd ?? "?"}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">
                    {t("bulkPdfSourceLabel")}
                  </dt>
                  <dd className="flex flex-wrap gap-1">
                    {combinedMeta.sources.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-md bg-card border px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        <FileText className="size-3" />
                        {s}
                      </span>
                    ))}
                  </dd>
                </dl>
              </div>

              {aggregatedWarnings.length > 0 ? (
                <div className="bg-amber-500/10 border-amber-500/30 grid gap-1 rounded-xl border p-3 text-[11px]">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    {t("pdfWarnings")}
                  </p>
                  {aggregatedWarnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-amber-700 dark:text-amber-400"
                    >
                      · <span className="font-mono">{w.source}</span> ·{" "}
                      {w.warning}
                    </p>
                  ))}
                </div>
              ) : null}

              <ScrollArea className="h-[480px] rounded-xl border bg-muted/20">
                <div className="grid gap-2 p-2">
                  {transactions.length === 0 ? (
                    <p className="text-muted-foreground p-6 text-center text-xs">
                      —
                    </p>
                  ) : (
                    transactions.map((tx, idx) => {
                      const scope = tx.chosen_scope ?? "business"
                      const filteredCats = categories.filter(
                        (c) => c.scope === scope
                      )
                      const chosenCat = tx.chosen_category_id
                        ? categories.find(
                            (c) => c.id === tx.chosen_category_id
                          )
                        : null
                      return (
                        <div
                          key={idx}
                          className="bg-card grid gap-2 rounded-xl border p-3 transition hover:shadow-sm"
                        >
                          {/* Row 0: source-file badge (only show in bulk mode) */}
                          {tx.source_file && successfulFiles.length > 1 ? (
                            <div className="flex items-center">
                              <span
                                className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                                title={tx.source_file}
                              >
                                <FileText className="size-3 shrink-0" />
                                <span className="truncate">
                                  {tx.source_file}
                                </span>
                              </span>
                            </div>
                          ) : null}

                          {/* Row 1: date + counterparty + amount */}
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground w-[88px] shrink-0 font-mono text-[11px] tabular-nums">
                              {tx.occurred_on}
                            </span>
                            <Input
                              value={tx.counterparty ?? tx.description}
                              onChange={(e) =>
                                updateTx(idx, {
                                  counterparty: e.target.value,
                                  description:
                                    e.target.value.slice(0, 80) ||
                                    tx.description,
                                })
                              }
                              className="h-8 flex-1 text-sm"
                              placeholder={t("colCounterparty")}
                            />
                            <div className="relative w-[120px] shrink-0">
                              <Input
                                type="number"
                                step="0.01"
                                value={(tx.amount_cents / 100).toFixed(2)}
                                onChange={(e) => {
                                  const n = Number(e.target.value)
                                  if (!Number.isFinite(n)) return
                                  const cents = Math.round(n * 100)
                                  updateTx(idx, {
                                    amount_cents: cents,
                                    type: cents >= 0 ? "credit" : "debit",
                                  })
                                }}
                                className={`h-8 pr-7 text-right font-mono text-sm font-semibold tabular-nums ${
                                  tx.amount_cents < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              />
                              <span
                                className={`pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-semibold ${
                                  tx.amount_cents < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                €
                              </span>
                            </div>
                          </div>
                          {/* Row 2: reference (only if present) */}
                          {tx.reference ? (
                            <p
                              className="text-muted-foreground line-clamp-2 pl-[100px] text-[11px] leading-snug"
                              title={tx.reference}
                            >
                              {tx.reference}
                            </p>
                          ) : null}

                          {/* Row 3: category dropdown + scope toggle */}
                          <div className="flex flex-wrap items-center gap-2 pl-[100px]">
                            {/* Scope segmented */}
                            <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setChosenScope(idx, "business")}
                                className={`rounded px-2 py-0.5 transition ${
                                  scope === "business"
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                aria-pressed={scope === "business"}
                              >
                                {t("scopeBusiness")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setChosenScope(idx, "personal")}
                                className={`rounded px-2 py-0.5 transition ${
                                  scope === "personal"
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                                aria-pressed={scope === "personal"}
                              >
                                {t("scopePersonal")}
                              </button>
                            </div>

                            {/* Category select */}
                            <div className="flex min-w-[200px] flex-1 items-center gap-1">
                              <Select
                                value={tx.chosen_category_id ?? ""}
                                onValueChange={(v) =>
                                  setChosenCategory(idx, v || null)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <span className="flex items-center gap-1.5 truncate">
                                    {chosenCat?.color ? (
                                      <span
                                        className="inline-block size-2 shrink-0 rounded-full"
                                        style={{
                                          backgroundColor: chosenCat.color,
                                        }}
                                        aria-hidden
                                      />
                                    ) : null}
                                    <span className="truncate">
                                      {chosenCat
                                        ? translateCategoryName(
                                            chosenCat.name,
                                            t
                                          )
                                        : t("noCategory")}
                                    </span>
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel className="text-[10px] uppercase tracking-wide">
                                      {t("category")}
                                    </SelectLabel>
                                    {filteredCats.length === 0 ? (
                                      <div className="text-muted-foreground p-2 text-[11px]">
                                        —
                                      </div>
                                    ) : (
                                      filteredCats.map((c) => (
                                        <SelectItem
                                          key={c.id}
                                          value={c.id}
                                          className="text-xs"
                                        >
                                          <span className="flex items-center gap-1.5">
                                            {c.color ? (
                                              <span
                                                className="inline-block size-2 shrink-0 rounded-full"
                                                style={{
                                                  backgroundColor: c.color,
                                                }}
                                                aria-hidden
                                              />
                                            ) : null}
                                            {translateCategoryName(c.name, t)}
                                          </span>
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>

                              {/* Source icon */}
                              {tx.suggestion_source === "ai" ? (
                                <span
                                  className="text-primary inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10"
                                  title={
                                    tx.suggestion_reason
                                      ? `${t("aiSuggestion")} · ${tx.suggestion_reason}`
                                      : t("aiSuggestion")
                                  }
                                  aria-label={t("aiSuggestion")}
                                >
                                  <Sparkles className="size-3.5" />
                                </span>
                              ) : null}
                              {tx.suggestion_source === "rule" ? (
                                <span
                                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  title={
                                    tx.suggestion_reason
                                      ? `${t("ruleApplied")} · ${tx.suggestion_reason}`
                                      : t("ruleApplied")
                                  }
                                  aria-label={t("ruleApplied")}
                                >
                                  <Zap className="size-3.5" />
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Learn hint when changed */}
                          {tx.user_changed ? (
                            <p className="text-muted-foreground pl-[100px] text-[10.5px] italic">
                              {t("learnHint")}
                            </p>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>

              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Σ</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    total < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatMoney(total)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false)
            }}
            disabled={commitMut.isPending}
          >
            {t("cancel")}
          </Button>
          {showPreview && transactions.length > 0 ? (
            <Button
              onClick={() => commitMut.mutate()}
              disabled={commitMut.isPending}
            >
              {commitMut.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {commitProgress
                    ? t("bulkPdfCommitProgress", {
                        current: commitProgress.current,
                        total: commitProgress.total,
                      })
                    : t("pdfImporting")}
                </>
              ) : (
                <>
                  <Upload />
                  {t("pdfImportButton", { count: transactions.length })}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Per-file row ────────────────────────────────────────────────────

function FileRow({
  entry,
  t,
}: {
  entry: FileEntry
  t: ReturnType<typeof useTranslations<"Banking">>
}) {
  const txCount = entry.statement?.transactions.length ?? 0
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs">
      <StatusIcon status={entry.status} />
      <span className="flex-1 truncate font-mono text-[11px]" title={entry.file.name}>
        {entry.file.name}
      </span>
      <span className="text-muted-foreground shrink-0 text-[11px]">
        {entry.status === "pending"
          ? t("bulkPdfStatusPending")
          : entry.status === "processing"
            ? t("bulkPdfStatusProcessing")
            : entry.status === "done"
              ? t("pdfPreviewTitle", { count: txCount })
              : entry.error ?? t("bulkPdfStatusFailed")}
      </span>
    </div>
  )
}

function StatusIcon({ status }: { status: FileStatus }) {
  if (status === "done")
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
  if (status === "failed")
    return <XCircle className="size-4 shrink-0 text-destructive" />
  if (status === "processing")
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
  return <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
}

// ─── Error mapping ────────────────────────────────────────────────────

function mapErrorToMessage(
  code: string,
  t: ReturnType<typeof useTranslations<"Banking">>
): string {
  switch (code) {
    case "ANTHROPIC_API_KEY_MISSING":
      return t("pdfErrorMissingKey")
    case "PDF_TEXT_TOO_SHORT":
      return t("pdfErrorTooShort")
    case "AI_PARSE_FAILED":
    case "AI_RATE_LIMIT":
      return t("pdfErrorParseFailed")
    case "PDF_TOO_LARGE":
      return t("pdfErrorTooLarge")
    default:
      return t("pdfErrorParseFailed")
  }
}
