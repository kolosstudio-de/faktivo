"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  Sparkles,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { formatMoney } from "@/lib/money"
import type { DocScope } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Props {
  scope: DocScope
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface OcrResult {
  amount_cents: number | null
  vat_rate: number | null
  vendor: string | null
  date: string | null
  category_hint: string | null
  description: string | null
  confidence: number
  source: "claude-vision" | "stub-dev"
}

export function BelegScanDialog({ scope, open, onOpenChange }: Props) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const [preview, setPreview] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<OcrResult | null>(null)
  const [belegId, setBelegId] = React.useState<string | null>(null)

  const reset = React.useCallback(() => {
    setPreview(null)
    setResult(null)
    setBelegId(null)
  }, [])

  // Adjust-state-on-prop-change pattern (statt useEffect) — clearen wir bei
  // jedem dialog-close die Vorschau, ohne cascading effect-render.
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (!open) reset()
  }

  const scanMut = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 8 * 1024 * 1024) {
        throw new Error("Datei zu groß (max 8 MB)")
      }
      const url = URL.createObjectURL(file)
      setPreview(url)

      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/belege/ocr", { method: "POST", body: fd })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? "OCR fehlgeschlagen")
      }
      const json = await r.json()
      return json
    },
    onSuccess: (data) => {
      setResult(data.ocr)
      setBelegId(data.beleg?.id ?? null)
      if (data.ocr.source === "stub-dev") {
        toast.warning(
          "Kein ANTHROPIC_API_KEY gesetzt — Stub-Antwort. Setze den Key in .env.local."
        )
      } else if (
        data.ocr.confidence >= 0.8 &&
        data.ocr.amount_cents != null
      ) {
        // Auto-import wenn AI sehr sicher
        toast.success("Beleg erkannt — wird automatisch importiert …")
        setTimeout(() => importMut.mutate(), 600)
      } else {
        toast.success("Beleg erkannt — bitte prüfen und übernehmen")
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const importMut = useMutation({
    mutationFn: async () => {
      if (!result || result.amount_cents == null) {
        throw new Error("Kein Betrag erkannt — manuelle Eingabe nötig")
      }
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("not authenticated")

      const insertRow = {
        user_id: user.id,
        scope,
        kind: "expense" as const,
        occurred_on:
          result.date ?? new Date().toISOString().slice(0, 10),
        amount_cents: result.amount_cents,
        vendor: result.vendor,
        description: result.description,
        vat_rate: result.vat_rate ?? 19,
        is_deductible: true,
        jobcenter_relevant: true,
      }
      const { data: created, error } = await supabase
        .from("expense_entries")
        .insert(insertRow)
        .select()
        .single()
      if (error) throw error

      // Verknüpfe beleg → expense
      if (belegId && created) {
        await supabase
          .from("belege")
          .update({ expense_entry_id: created.id })
          .eq("id", belegId)
      }
      return created
    },
    onSuccess: () => {
      toast.success("Ausgabe angelegt")
      queryClient.invalidateQueries({ queryKey: ["expense_entries"] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" />
            Quittung scannen
          </DialogTitle>
          <DialogDescription>
            Foto der Quittung hochladen — Claude Vision liest Betrag, USt und
            Verkäufer automatisch aus.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <label className="border-primary/30 hover:bg-muted/40 group grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed p-12 text-center transition">
            <div className="bg-primary/10 text-primary grid size-14 place-items-center rounded-2xl">
              <Camera className="size-6" />
            </div>
            <p className="font-medium">Foto wählen oder Beleg fotografieren</p>
            <p className="text-muted-foreground text-xs">
              JPG / PNG / WEBP · max 8 MB
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) scanMut.mutate(f)
              }}
            />
          </label>
        ) : (
          <div className="grid gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Beleg-Vorschau"
                className="max-h-60 rounded-xl border object-contain"
              />
            ) : null}

            {scanMut.isPending ? (
              <div className="bg-muted/40 flex items-center gap-2 rounded-xl border p-3 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Analysiere Beleg mit Claude Vision …
              </div>
            ) : null}

            {result ? (
              <div className="bg-muted/40 grid gap-3 rounded-xl border p-4 text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span className="font-semibold">OCR-Ergebnis</span>
                  {result.confidence >= 0.7 ? (
                    <CheckCircle2 className="ml-auto size-4 text-emerald-500" />
                  ) : (
                    <span className="text-muted-foreground ml-auto text-xs">
                      Konf.: {(result.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Betrag:</dt>
                  <dd className="font-mono font-semibold">
                    {result.amount_cents != null
                      ? formatMoney(result.amount_cents)
                      : "—"}
                  </dd>
                  <dt className="text-muted-foreground">USt-Satz:</dt>
                  <dd>{result.vat_rate != null ? `${result.vat_rate} %` : "—"}</dd>
                  <dt className="text-muted-foreground">Verkäufer:</dt>
                  <dd>{result.vendor ?? "—"}</dd>
                  <dt className="text-muted-foreground">Datum:</dt>
                  <dd>{result.date ?? "—"}</dd>
                  <dt className="text-muted-foreground">Beschreibung:</dt>
                  <dd className="line-clamp-2">{result.description ?? "—"}</dd>
                  <dt className="text-muted-foreground">Kategorie:</dt>
                  <dd className="text-xs uppercase tracking-wide">
                    {result.category_hint ?? "—"}
                  </dd>
                </dl>
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reset}
              disabled={scanMut.isPending || importMut.isPending}
            >
              <Upload className="size-4" />
              Anderen Beleg wählen
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={() => importMut.mutate()}
            disabled={
              !result || result.amount_cents == null || importMut.isPending
            }
          >
            {importMut.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            Als Ausgabe übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
