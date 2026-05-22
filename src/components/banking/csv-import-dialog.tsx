"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
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

interface ImportSummary {
  format: string
  total_in_csv: number
  inserted: number
  duplicates: number
  payments_matched: number
  warnings: string[]
}

export function CsvImportDialog() {
  const t = useTranslations("Banking")
  const [open, setOpen] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<ImportSummary | null>(null)
  const queryClient = useQueryClient()

  const reset = () => {
    setFileName(null)
    setSummary(null)
  }

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      setFileName(file.name)
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/banking/import-csv", {
        method: "POST",
        body: fd,
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? t("importFailed"))
      }
      return (await r.json()) as ImportSummary
    },
    onSuccess: (s) => {
      setSummary(s)
      toast.success(
        t("newTxToast", { inserted: s.inserted, matched: s.payments_matched })
      )
      queryClient.invalidateQueries({ queryKey: ["bank_transactions"] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

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
          <FileSpreadsheet />
          {t("csvImport")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            {t("dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {!summary && !importMut.isPending ? (
            <label className="border-primary/30 hover:bg-muted/40 grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed p-12 text-center transition">
              <div className="bg-primary/10 text-primary grid size-14 place-items-center rounded-2xl">
                <Upload className="size-6" />
              </div>
              <p className="font-medium">{t("chooseCsv")}</p>
              <p className="text-muted-foreground text-xs">
                {fileName ?? t("maxSize")}
              </p>
              <input
                type="file"
                accept=".csv,text/csv,application/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importMut.mutate(f)
                }}
              />
            </label>
          ) : null}

          {importMut.isPending ? (
            <div className="bg-muted/40 flex items-center gap-2 rounded-xl border p-4 text-sm">
              <Loader2 className="size-4 animate-spin" />
              {t("processing", { file: fileName ?? "" })}
            </div>
          ) : null}

          {summary ? (
            <div className="bg-muted/40 grid gap-2 rounded-xl border p-4 text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="font-semibold">
                  {t("importSuccess", { format: summary.format })}
                </span>
              </div>
              <dl className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">{t("csvRows")}</dt>
                <dd className="font-mono">{summary.total_in_csv}</dd>
                <dt className="text-muted-foreground">{t("newImported")}</dt>
                <dd className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {summary.inserted}
                </dd>
                <dt className="text-muted-foreground">{t("duplicatesSkipped")}</dt>
                <dd className="font-mono text-muted-foreground">
                  {summary.duplicates}
                </dd>
                <dt className="text-muted-foreground">{t("autoMatchPayments")}</dt>
                <dd className="font-mono font-semibold text-violet-600 dark:text-violet-400">
                  {summary.payments_matched}
                </dd>
              </dl>
              {summary.warnings.length > 0 ? (
                <div className="bg-amber-500/10 mt-2 rounded-lg border border-amber-500/20 p-2 text-[11px]">
                  {summary.warnings.map((w, i) => (
                    <p key={i} className="text-amber-700 dark:text-amber-400">
                      ⚠️ {w}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="bg-blue-500/5 border-blue-500/20 rounded-lg border p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="text-foreground font-medium mb-1">
              {t("supportedFormatsTitle")}
            </p>
            <p>{t("supportedFormatsList")}</p>
            <p className="mt-2 text-foreground font-medium">
              {t("whereCsvExportTitle")}
            </p>
            <ul className="grid gap-0.5">
              <li>· {t("whereCsvN26")}</li>
              <li>· {t("whereCsvSparkasse")}</li>
              <li>· {t("whereCsvDkb")}</li>
              <li>· {t("whereCsvIng")}</li>
              <li>· {t("whereCsvCommerz")}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false)
            }}
          >
            {summary ? t("close") : t("cancel")}
          </Button>
          {summary ? (
            <Button onClick={reset}>
              <Upload />
              {t("importMore")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

void CheckCircle2
