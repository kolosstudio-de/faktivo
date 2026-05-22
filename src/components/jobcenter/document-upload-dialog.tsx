"use client"

/**
 * AI Jobcenter Document Parser — Upload Dialog.
 *
 * Workflow:
 *   1. User picks a kind (Bewilligungsbescheid, WBA, EKS, …)
 *   2. Drops PDF/IMG into the dropzone
 *   3. We POST to /api/jobcenter/documents/upload (auth + AI parse, ~15-30s)
 *   4. Preview panel: PDF embed (left) + editable fields with confidence chips (right)
 *   5. "Apply to settings" → POST /api/jobcenter/documents/[id]/apply
 *   6. List of last 5 uploads at the bottom
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

// ─── Types (mirror server contracts) ──────────────────────────────────

type DocumentKind =
  | "bewilligung"
  | "wba"
  | "eks_vorlaeufig"
  | "eks_endgueltig"
  | "vermoegen"
  | "other"

interface ParsedBewilligung {
  kind: "bewilligung"
  bewilligungszeitraum_start: string | null
  bewilligungszeitraum_end: string | null
  regelbedarf_stufe: number | null
  regelbedarf_monatlich_cents: number | null
  kdu_monatlich_cents: number | null
  mehrbedarf_cents: number | null
  buergergeld_bedarf_monatlich_cents: number | null
  bg_nummer: string | null
  jobcenter_name: string | null
  has_minor_children: boolean | null
  field_confidence: Record<string, number>
  warnings: string[]
}

interface ParsedEksVorlaeufig {
  kind: "eks_vorlaeufig" | "eks_endgueltig"
  bewilligungszeitraum_start: string | null
  bewilligungszeitraum_end: string | null
  monthly_prognose: Array<{
    month: string
    einnahmen_cents: number
    ausgaben_cents: number
    saldo_cents: number
  }>
  field_confidence: Record<string, number>
  warnings: string[]
}

interface ParsedGeneric {
  kind: Exclude<DocumentKind, "bewilligung" | "eks_vorlaeufig" | "eks_endgueltig">
  raw_text: string
  warnings: string[]
  field_confidence: Record<string, number>
}

type ParsedDocument = ParsedBewilligung | ParsedEksVorlaeufig | ParsedGeneric

interface UploadResponse {
  ok: true
  document_id: string
  kind: DocumentKind
  parsed_data: ParsedDocument
  parse_confidence: number
  warnings: string[]
}

interface DocumentRow {
  id: string
  kind: DocumentKind
  filename: string
  file_size_bytes: number
  storage_path: string
  uploaded_at: string
  parsed_at: string | null
  parsed_data: ParsedDocument | null
  parse_confidence: number | null
  parse_warnings: string[] | null
  applied_at: string | null
  applied_to_report_id: string | null
  preview_url: string | null
}

interface DocumentsListResponse {
  ok: true
  documents: DocumentRow[]
}

interface Props {
  /** Current settings.bewilligungszeitraum_start — used for the BWZ mismatch banner */
  currentBwzStart?: string | null
  /** Current settings.bewilligungszeitraum_end */
  currentBwzEnd?: string | null
}

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_EXTS = /\.(pdf|jpg|jpeg|png|webp|heic)$/i

const KIND_KEYS: { value: DocumentKind; labelKey: string }[] = [
  { value: "bewilligung", labelKey: "kindBewilligung" },
  { value: "wba", labelKey: "kindWba" },
  { value: "eks_vorlaeufig", labelKey: "kindEksVorlaeufig" },
  { value: "eks_endgueltig", labelKey: "kindEksEndgueltig" },
  { value: "vermoegen", labelKey: "kindVermoegen" },
  { value: "other", labelKey: "kindOther" },
]

// ─── Helpers ──────────────────────────────────────────────────────────

function confidenceLevel(c: number | undefined): "high" | "medium" | "low" {
  if (typeof c !== "number" || !Number.isFinite(c)) return "low"
  if (c >= 70) return "high"
  if (c >= 40) return "medium"
  return "low"
}

function ConfidenceDot({ value }: { value: number | undefined }) {
  const lvl = confidenceLevel(value)
  const colour =
    lvl === "high"
      ? "bg-emerald-500"
      : lvl === "medium"
        ? "bg-amber-500"
        : "bg-rose-500"
  const pct =
    typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${colour}`}
      title={`${pct}%`}
      aria-label={`${pct}%`}
    />
  )
}

function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ""
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(
    cents / 100,
  )
}

function parseCentsInput(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

function isMissingBwz(s: string | null | undefined): boolean {
  return !s || !/^\d{4}-\d{2}-\d{2}$/.test(s)
}

function kindLabel(t: ReturnType<typeof useTranslations<"Jobcenter">>, k: DocumentKind): string {
  const e = KIND_KEYS.find((x) => x.value === k)
  return e ? t(e.labelKey as Parameters<typeof t>[0]) : k
}

// ─── Component ────────────────────────────────────────────────────────

export function JobcenterDocumentUploadDialog({
  currentBwzStart,
  currentBwzEnd,
}: Props) {
  const t = useTranslations("Jobcenter")
  const queryClient = useQueryClient()
  const router = useRouter()

  const [open, setOpen] = React.useState(false)
  const [kind, setKind] = React.useState<DocumentKind>("bewilligung")
  const [dragOver, setDragOver] = React.useState(false)
  const [uploaded, setUploaded] = React.useState<UploadResponse | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [overrides, setOverrides] = React.useState<Record<string, unknown>>({})
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [autoFillVorlaeufig, setAutoFillVorlaeufig] = React.useState(true)

  const reset = React.useCallback(() => {
    setKind("bewilligung")
    setUploaded(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setOverrides({})
    setErrorMsg(null)
    setDragOver(false)
  }, [previewUrl])

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // ─── Recent uploads list ─────────────────────────────────────────────
  const recentQuery = useQuery({
    queryKey: ["jobcenter-documents", "recent"],
    queryFn: async (): Promise<DocumentRow[]> => {
      const r = await fetch("/api/jobcenter/documents?limit=5")
      if (!r.ok) return []
      const data = (await r.json()) as DocumentsListResponse | { ok: false }
      return "ok" in data && data.ok ? data.documents : []
    },
    enabled: open,
    staleTime: 30_000,
  })

  // ─── Upload mutation ─────────────────────────────────────────────────
  const uploadMut = useMutation({
    mutationFn: async (file: File): Promise<UploadResponse> => {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("kind", kind)
      const r = await fetch("/api/jobcenter/documents/upload", {
        method: "POST",
        body: fd,
      })
      const data = (await r.json()) as
        | UploadResponse
        | { ok: false; error: string; message?: string }
      if (!r.ok || !("ok" in data) || !data.ok) {
        const err = data as { error: string }
        throw new Error(mapErrorToMessage(err.error, t))
      }
      return data
    },
    onSuccess: (data, file) => {
      setUploaded(data)
      // Local object URL → preview the *just-uploaded* file without
      // a round-trip for a signed URL. The signed URL is also exposed
      // via the "recent uploads" query, but local URL is instant.
      const blob = new Blob([file], { type: file.type })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      void queryClient.invalidateQueries({
        queryKey: ["jobcenter-documents", "recent"],
      })
    },
    onError: (err: Error) => {
      setErrorMsg(err.message)
    },
  })

  // ─── Apply mutation ──────────────────────────────────────────────────
  const applyMut = useMutation({
    mutationFn: async (): Promise<{
      ok: true
      applied_fields: string[]
      kind?: string
      report_id?: string
    }> => {
      if (!uploaded) throw new Error(t("errParseFailed"))
      const r = await fetch(
        `/api/jobcenter/documents/${uploaded.document_id}/apply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ overrides }),
        },
      )
      const data = (await r.json()) as
        | { ok: true; applied_fields: string[]; kind?: string; report_id?: string }
        | { ok: false; error: string; message?: string }
      if (!r.ok || !("ok" in data) || !data.ok) {
        const err = data as { error: string; message?: string }
        throw new Error(err.message ?? mapErrorToMessage(err.error, t))
      }
      return data
    },
    onSuccess: (data) => {
      toast.success(t("applied"))
      void queryClient.invalidateQueries({ queryKey: ["jobcenter-documents", "recent"] })
      // Auto-open Vorläufige EKS tab if user applied a Bewilligung and
      // opted in to smart-fill.
      if (
        autoFillVorlaeufig &&
        uploaded?.kind === "bewilligung" &&
        data.applied_fields.some((f) => f.startsWith("bewilligungszeitraum"))
      ) {
        setOpen(false)
        reset()
        router.push("/reports/jobcenter?tab=vorlaeufig&from_doc=1")
        router.refresh()
      } else {
        setOpen(false)
        reset()
        router.refresh()
      }
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  // ─── Delete mutation (recent list) ───────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/jobcenter/documents/${id}/delete`, {
        method: "DELETE",
      })
      const data = (await r.json()) as { ok: true } | { ok: false; message?: string }
      if (!r.ok || !("ok" in data) || !data.ok) {
        throw new Error((data as { message?: string }).message ?? "delete failed")
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["jobcenter-documents", "recent"],
      })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ─── File accept ─────────────────────────────────────────────────────
  const acceptFile = (file: File) => {
    setErrorMsg(null)
    if (file.size > MAX_BYTES) {
      setErrorMsg(t("errFileTooLarge"))
      return
    }
    if (!ALLOWED_EXTS.test(file.name)) {
      setErrorMsg(t("errWrongMime"))
      return
    }
    uploadMut.mutate(file)
  }

  // ─── Local helpers for editing parsed values ─────────────────────────
  const parsed = uploaded?.parsed_data
  const confidence = parsed?.field_confidence ?? {}

  function getStringValue(field: string, fallback: string | null): string {
    const ov = overrides[field]
    if (typeof ov === "string") return ov
    return fallback ?? ""
  }
  function getCentsValue(field: string, fallback: number | null): string {
    const ov = overrides[field]
    if (typeof ov === "number") return formatCents(ov)
    return formatCents(fallback)
  }
  function setOv(field: string, value: unknown) {
    setOverrides((prev) => ({ ...prev, [field]: value }))
  }

  // ─── BWZ mismatch detection ──────────────────────────────────────────
  const parsedBwzStart =
    parsed && (parsed.kind === "bewilligung" || parsed.kind === "eks_vorlaeufig" || parsed.kind === "eks_endgueltig")
      ? parsed.bewilligungszeitraum_start
      : null
  const parsedBwzEnd =
    parsed && (parsed.kind === "bewilligung" || parsed.kind === "eks_vorlaeufig" || parsed.kind === "eks_endgueltig")
      ? parsed.bewilligungszeitraum_end
      : null

  const showBwzMismatch =
    !!parsedBwzStart &&
    !!parsedBwzEnd &&
    !isMissingBwz(currentBwzStart) &&
    !isMissingBwz(currentBwzEnd) &&
    (parsedBwzStart !== currentBwzStart || parsedBwzEnd !== currentBwzEnd)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="size-4 text-primary" />
          {t("documentsCta")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[94vh] !w-[98vw] !max-w-[1400px] overflow-y-auto sm:!max-w-[1400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" />
            {t("documentsTitle")}
          </DialogTitle>
          <DialogDescription>{t("documentsHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* ─── Step 1: kind picker ─── */}
          {!uploaded ? (
            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">
                {t("kindLabel")}
              </Label>
              <div className="flex flex-wrap gap-2">
                {KIND_KEYS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      kind === k.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted/60 border-border"
                    }`}
                    aria-pressed={kind === k.value}
                  >
                    {t(k.labelKey as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* ─── Step 2: dropzone OR processing OR preview ─── */}
          {!uploaded && !uploadMut.isPending ? (
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) acceptFile(file)
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
              <p className="font-medium">{t("dropZone")}</p>
              <p className="text-muted-foreground text-xs">
                {t("dropZoneHint")}
              </p>
              <input
                type="file"
                accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/heic,.heic"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) acceptFile(file)
                }}
              />
            </label>
          ) : null}

          {uploadMut.isPending ? (
            <div className="bg-primary/5 grid place-items-center gap-2 rounded-2xl border border-primary/20 p-10 text-center">
              <Loader2 className="text-primary size-8 animate-spin" />
              <p className="font-medium">{t("analyzing")}</p>
              <p className="text-muted-foreground text-xs">{t("analyzingHint")}</p>
            </div>
          ) : null}

          {errorMsg ? (
            <div className="bg-destructive/10 border-destructive/30 grid gap-2 rounded-xl border p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                {errorMsg}
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                {t("retry")}
              </Button>
            </div>
          ) : null}

          {/* ─── Step 3: side-by-side preview + fields ─── */}
          {uploaded && parsed ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              {/* Left: PDF / image preview */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {kindLabel(t, uploaded.kind)}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {t("confidenceOverall", {
                      pct: Math.round(uploaded.parse_confidence),
                    })}
                  </span>
                </div>
                <div className="bg-muted/30 grid h-[520px] place-items-center overflow-hidden rounded-xl border">
                  {previewUrl ? (
                    <embed
                      src={previewUrl}
                      type="application/pdf"
                      className="size-full"
                    />
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      {t("previewUnavailable")}
                    </p>
                  )}
                </div>
                {previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-xs underline"
                  >
                    <ExternalLink className="size-3" />
                    {t("viewOriginal")}
                  </a>
                ) : null}
              </div>

              {/* Right: editable fields */}
              <div className="grid gap-3">
                {showBwzMismatch ? (
                  <div className="bg-amber-500/10 border-amber-500/30 grid gap-1 rounded-xl border p-3 text-xs">
                    <p className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="size-3.5" />
                      {t("bwzMismatchTitle")}
                    </p>
                    <p className="text-amber-700 dark:text-amber-400">
                      {t("bwzMismatchWarning", {
                        docBwz: `${parsedBwzStart} – ${parsedBwzEnd}`,
                        currentBwz: `${currentBwzStart ?? "?"} – ${currentBwzEnd ?? "?"}`,
                      })}
                    </p>
                  </div>
                ) : null}

                {parsed.warnings.length > 0 ? (
                  <div className="bg-amber-500/10 border-amber-500/30 grid gap-1 rounded-xl border p-3 text-[11px]">
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      {t("warningsTitle")}
                    </p>
                    {parsed.warnings.map((w, i) => (
                      <p key={i} className="text-amber-700 dark:text-amber-400">
                        · {w}
                      </p>
                    ))}
                  </div>
                ) : null}

                <ScrollArea className="h-[460px] rounded-xl border bg-muted/10 p-3">
                  {parsed.kind === "bewilligung" ? (
                    <BewilligungFields
                      parsed={parsed as ParsedBewilligung}
                      overrides={overrides}
                      setOv={setOv}
                      confidence={confidence}
                      t={t}
                      getStringValue={getStringValue}
                      getCentsValue={getCentsValue}
                    />
                  ) : parsed.kind === "eks_vorlaeufig" ||
                    parsed.kind === "eks_endgueltig" ? (
                    <EksFields
                      parsed={parsed as ParsedEksVorlaeufig}
                      overrides={overrides}
                      setOv={setOv}
                      confidence={confidence}
                      t={t}
                    />
                  ) : (
                    <GenericFields parsed={parsed as ParsedGeneric} t={t} />
                  )}
                </ScrollArea>

                {parsed.kind === "bewilligung" ? (
                  <div className="bg-muted/30 flex items-center justify-between gap-3 rounded-xl border p-3 text-xs">
                    <div className="grid gap-0.5">
                      <p className="font-semibold">{t("smartFillTitle")}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {t("smartFillHint")}
                      </p>
                    </div>
                    <Switch
                      checked={autoFillVorlaeufig}
                      onCheckedChange={setAutoFillVorlaeufig}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ─── Recent uploads ─── */}
          {!uploaded && recentQuery.data && recentQuery.data.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide">
                {t("recentDocsTitle")}
              </p>
              <div className="grid gap-1.5">
                {recentQuery.data.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-card flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono text-[11px]">
                      {doc.filename}
                    </span>
                    <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px]">
                      {kindLabel(t, doc.kind)}
                    </span>
                    {doc.applied_at ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : null}
                    {doc.preview_url ? (
                      <a
                        href={doc.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title={t("viewOriginal")}
                        aria-label={t("viewOriginal")}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(t("deleteConfirm"))) return
                        deleteMut.mutate(doc.id)
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title={t("deleteDoc")}
                      aria-label={t("deleteDoc")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false)
              reset()
            }}
            disabled={applyMut.isPending}
          >
            {t("cancel")}
          </Button>
          {uploaded ? (
            <Button onClick={() => applyMut.mutate()} disabled={applyMut.isPending}>
              {applyMut.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t("applying")}
                </>
              ) : (
                <>
                  <CheckCircle2 />
                  {t("applyToSettings")}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Bewilligungs-Felder ───────────────────────────────────────────────

function BewilligungFields({
  parsed,
  setOv,
  confidence,
  t,
  getStringValue,
  getCentsValue,
}: {
  parsed: ParsedBewilligung
  overrides: Record<string, unknown>
  setOv: (k: string, v: unknown) => void
  confidence: Record<string, number>
  t: ReturnType<typeof useTranslations<"Jobcenter">>
  getStringValue: (k: string, f: string | null) => string
  getCentsValue: (k: string, f: number | null) => string
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow
          label={t("fieldBwzStart")}
          confidence={confidence.bewilligungszeitraum_start}
        >
          <Input
            type="date"
            value={getStringValue(
              "bewilligungszeitraum_start",
              parsed.bewilligungszeitraum_start,
            )}
            onChange={(e) => setOv("bewilligungszeitraum_start", e.target.value)}
            className="h-8 text-xs"
          />
        </FieldRow>
        <FieldRow
          label={t("fieldBwzEnd")}
          confidence={confidence.bewilligungszeitraum_end}
        >
          <Input
            type="date"
            value={getStringValue(
              "bewilligungszeitraum_end",
              parsed.bewilligungszeitraum_end,
            )}
            onChange={(e) => setOv("bewilligungszeitraum_end", e.target.value)}
            className="h-8 text-xs"
          />
        </FieldRow>
      </div>

      <FieldRow
        label={t("fieldRegelbedarfStufe")}
        confidence={confidence.regelbedarf_stufe}
      >
        <Select
          value={String(parsed.regelbedarf_stufe ?? "")}
          onValueChange={(v) =>
            setOv("regelbedarf_stufe", v ? Number(v) : null)
          }
        >
          <SelectTrigger className="h-8 text-xs">
            {parsed.regelbedarf_stufe ? `Stufe ${parsed.regelbedarf_stufe}` : "—"}
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                Stufe {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow
          label={t("fieldRegelbedarf")}
          confidence={confidence.regelbedarf_monatlich_cents}
        >
          <MoneyInput
            value={getCentsValue(
              "regelbedarf_monatlich_cents",
              parsed.regelbedarf_monatlich_cents,
            )}
            onChange={(cents) => setOv("regelbedarf_monatlich_cents", cents)}
          />
        </FieldRow>
        <FieldRow
          label={t("fieldKdu")}
          confidence={confidence.kdu_monatlich_cents}
        >
          <MoneyInput
            value={getCentsValue(
              "kdu_monatlich_cents",
              parsed.kdu_monatlich_cents,
            )}
            onChange={(cents) => setOv("kdu_monatlich_cents", cents)}
          />
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow
          label={t("fieldMehrbedarf")}
          confidence={confidence.mehrbedarf_cents}
        >
          <MoneyInput
            value={getCentsValue("mehrbedarf_cents", parsed.mehrbedarf_cents)}
            onChange={(cents) => setOv("mehrbedarf_cents", cents)}
          />
        </FieldRow>
        <FieldRow
          label={t("fieldGesamtbedarf")}
          confidence={confidence.buergergeld_bedarf_monatlich_cents}
        >
          <MoneyInput
            value={getCentsValue(
              "buergergeld_bedarf_monatlich_cents",
              parsed.buergergeld_bedarf_monatlich_cents,
            )}
            onChange={(cents) =>
              setOv("buergergeld_bedarf_monatlich_cents", cents)
            }
          />
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label={t("fieldBgNummer")} confidence={confidence.bg_nummer}>
          <Input
            value={getStringValue("bg_nummer", parsed.bg_nummer)}
            onChange={(e) => setOv("bg_nummer", e.target.value)}
            className="h-8 text-xs"
            placeholder="BG-Nr."
          />
        </FieldRow>
        <FieldRow
          label={t("fieldJobcenterName")}
          confidence={confidence.jobcenter_name}
        >
          <Input
            value={getStringValue("jobcenter_name", parsed.jobcenter_name)}
            onChange={(e) => setOv("jobcenter_name", e.target.value)}
            className="h-8 text-xs"
            placeholder="Jobcenter …"
          />
        </FieldRow>
      </div>

      <FieldRow
        label={t("fieldMinorChildren")}
        confidence={confidence.has_minor_children}
      >
        <Switch
          checked={parsed.has_minor_children ?? false}
          onCheckedChange={(v) => setOv("has_minor_children", v)}
        />
      </FieldRow>
    </div>
  )
}

// ─── EKS-Felder ───────────────────────────────────────────────────────

function EksFields({
  parsed,
  setOv,
  confidence,
  t,
}: {
  parsed: ParsedEksVorlaeufig
  overrides: Record<string, unknown>
  setOv: (k: string, v: unknown) => void
  confidence: Record<string, number>
  t: ReturnType<typeof useTranslations<"Jobcenter">>
}) {
  const [rows, setRows] = React.useState(parsed.monthly_prognose)

  // Keep server-side override in sync.
  React.useEffect(() => {
    setOv("monthly_prognose", rows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  function setRow(idx: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        const next = { ...r, ...patch }
        next.saldo_cents = next.einnahmen_cents - next.ausgaben_cents
        return next
      }),
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow
          label={t("fieldBwzStart")}
          confidence={confidence.bewilligungszeitraum_start}
        >
          <Input
            type="date"
            defaultValue={parsed.bewilligungszeitraum_start ?? ""}
            onChange={(e) => setOv("bewilligungszeitraum_start", e.target.value)}
            className="h-8 text-xs"
          />
        </FieldRow>
        <FieldRow
          label={t("fieldBwzEnd")}
          confidence={confidence.bewilligungszeitraum_end}
        >
          <Input
            type="date"
            defaultValue={parsed.bewilligungszeitraum_end ?? ""}
            onChange={(e) => setOv("bewilligungszeitraum_end", e.target.value)}
            className="h-8 text-xs"
          />
        </FieldRow>
      </div>

      <div className="grid gap-1">
        <p className="text-xs font-semibold">{t("fieldMonthlyPrognose")}</p>
        <div className="rounded-md border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-2 py-1.5 text-left">{t("colMonth")}</th>
                <th className="px-2 py-1.5 text-right">{t("colEinnahmen")}</th>
                <th className="px-2 py-1.5 text-right">{t("colAusgaben")}</th>
                <th className="px-2 py-1.5 text-right">{t("colSaldo")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.month + i} className="border-t">
                  <td className="px-2 py-1.5 font-mono text-[11px]">
                    {row.month}
                  </td>
                  <td className="px-1 py-1 text-right">
                    <MoneyInput
                      value={formatCents(row.einnahmen_cents)}
                      onChange={(cents) =>
                        setRow(i, { einnahmen_cents: cents ?? 0 })
                      }
                    />
                  </td>
                  <td className="px-1 py-1 text-right">
                    <MoneyInput
                      value={formatCents(row.ausgaben_cents)}
                      onChange={(cents) =>
                        setRow(i, { ausgaben_cents: cents ?? 0 })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                    {formatCents(row.saldo_cents)} €
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-muted-foreground p-3 text-center text-[11px]"
                  >
                    {t("noMonthsExtracted")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Generic Felder ───────────────────────────────────────────────────

function GenericFields({
  parsed,
  t,
}: {
  parsed: ParsedGeneric
  t: ReturnType<typeof useTranslations<"Jobcenter">>
}) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold">{t("genericSummary")}</p>
      <p className="bg-muted/30 text-muted-foreground rounded-md border p-3 text-[11px] leading-relaxed">
        {parsed.raw_text || t("genericNoText")}
      </p>
    </div>
  )
}

// ─── Reusable building blocks ─────────────────────────────────────────

function FieldRow({
  label,
  confidence,
  children,
}: {
  label: string
  confidence?: number
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <ConfidenceDot value={confidence} />
        <Label className="text-[11px] font-medium">{label}</Label>
      </div>
      {children}
    </div>
  )
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string
  onChange: (cents: number | null) => void
}) {
  // Track whose value is "winning": when `value` (from parent) changes,
  // we mirror it; while the user types, we let local typing win.
  // Pattern from https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // (derived state during render — no useEffect needed).
  const [internal, setInternal] = React.useState(value)
  const [lastUpstream, setLastUpstream] = React.useState(value)
  if (value !== lastUpstream) {
    setLastUpstream(value)
    setInternal(value)
  }
  return (
    <div className="relative">
      <Input
        value={internal}
        onChange={(e) => {
          setInternal(e.target.value)
          onChange(parseCentsInput(e.target.value))
        }}
        className="h-8 pr-7 text-right font-mono text-xs tabular-nums"
        inputMode="decimal"
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px]">
        €
      </span>
    </div>
  )
}

// ─── Error mapping ────────────────────────────────────────────────────

function mapErrorToMessage(
  code: string,
  t: ReturnType<typeof useTranslations<"Jobcenter">>,
): string {
  switch (code) {
    case "ANTHROPIC_API_KEY_MISSING":
      return t("errKeyMissing")
    case "FILE_TOO_LARGE":
      return t("errFileTooLarge")
    case "WRONG_MIME":
    case "UNSUPPORTED_MIME":
      return t("errWrongMime")
    case "AI_PARSE_FAILED":
      return t("errParseFailed")
    case "AI_RATE_LIMIT":
      return t("errVisionRateLimit")
    default:
      return t("errParseFailed")
  }
}
