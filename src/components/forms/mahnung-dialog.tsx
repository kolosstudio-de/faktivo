"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Download,
  Loader2,
  Send,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { formatMoney } from "@/lib/money"
import type { Invoice, Mahnung, MahnungStufe } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface Props {
  invoice: Invoice
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MahnungDialog({ invoice, open, onOpenChange }: Props) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const { data: existing = [] } = useQuery({
    queryKey: ["mahnungen", invoice.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mahnungen")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("issued_at", { ascending: false })
      if (error) throw error
      return data as Mahnung[]
    },
    enabled: open,
  })

  const nextStufe: MahnungStufe = React.useMemo(() => {
    const used = new Set(existing.map((m) => m.stufe))
    if (!used.has("1")) return "1"
    if (!used.has("2")) return "2"
    return "3"
  }, [existing])

  const [stufe, setStufe] = React.useState<MahnungStufe>(nextStufe)
  const [prevNextStufe, setPrevNextStufe] = React.useState<MahnungStufe>(nextStufe)
  if (prevNextStufe !== nextStufe) {
    setPrevNextStufe(nextStufe)
    setStufe(nextStufe)
  }

  const createMut = useMutation({
    mutationFn: async (s: MahnungStufe) => {
      const { data, error } = await supabase.rpc("create_mahnung", {
        p_invoice_id: invoice.id,
        p_stufe: s,
      })
      if (error) throw error
      return data as Mahnung
    },
    onSuccess: (m) => {
      toast.success(`Mahnung Stufe ${m.stufe} erstellt`)
      queryClient.invalidateQueries({ queryKey: ["mahnungen"] })
      onOpenChange(false)
      // Open PDF in new tab
      window.open(`/api/mahnung/${m.id}`, "_blank")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Mahnung per E-Mail senden — geht über `/api/mahnung/[id]/send` (validate-
  // Origin + auth + Resend / Dry-Run). Server sperrt erneuten Versand per
  // 409; wir spiegeln das in den Toast. Per-Row-Pending-State, damit nur die
  // Zeile spinnt, die gerade sendet.
  const [sendingId, setSendingId] = React.useState<string | null>(null)
  const sendMut = useMutation({
    mutationFn: async (id: string) => {
      setSendingId(id)
      const res = await fetch(`/api/mahnung/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        provider?: string
        message?: string
      }
      if (!res.ok) {
        const err = new Error(
          data.message ?? data.error ?? `HTTP ${res.status}`,
        )
        ;(err as Error & { status?: number }).status = res.status
        throw err
      }
      return data
    },
    onSuccess: (data) => {
      const provider = data.provider === "resend" ? "per E-Mail" : "(Dry-Run)"
      toast.success(`Mahnung gesendet ${provider}`)
      queryClient.invalidateQueries({ queryKey: ["mahnungen", invoice.id] })
    },
    onError: (e: Error & { status?: number }) => {
      if (e.status === 409) {
        toast.warning("Bereits gesendet", { description: e.message })
      } else {
        toast.error(e.message)
      }
    },
    onSettled: () => setSendingId(null),
  })

  const outstanding = invoice.total_cents - invoice.paid_cents

  // 2-Schritt-Wizard: Stufe wählen → Recht + Vorschau bestätigen.
  // Vorher: alles auf einem Screen ohne Step-Visualisierung, der User klickte
  // "Erstellen" oft zu früh ohne die Verzugszins-Hinweise zu lesen.
  const [step, setStep] = React.useState<1 | 2>(1)
  React.useEffect(() => {
    if (!open) setStep(1)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(560px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>Zahlungserinnerung / Mahnung erstellen</DialogTitle>
          <DialogDescription>
            Rechnung {invoice.number} · Offen: {formatMoney(outstanding)}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="text-muted-foreground mb-1 flex items-center gap-3 text-xs">
          <span className={cn("flex items-center gap-1.5", step === 1 && "text-foreground font-medium")}>
            <span className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
              step === 1 ? "bg-primary text-primary-foreground" : "bg-muted",
            )}>
              {step > 1 ? <Check className="size-3" /> : "1"}
            </span>
            Mahnstufe
          </span>
          <span className="bg-border h-px flex-1" />
          <span className={cn("flex items-center gap-1.5", step === 2 && "text-foreground font-medium")}>
            <span className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
              step === 2 ? "bg-primary text-primary-foreground" : "bg-muted",
            )}>
              2
            </span>
            Bestätigung
          </span>
        </div>

        <div className={cn("grid gap-4", step !== 1 && "hidden")}>
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Mahnstufe wählen
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["1", "2", "3"] as MahnungStufe[]).map((s) => {
                const used = existing.some((m) => m.stufe === s)
                const label =
                  s === "1"
                    ? "Zahlungserinnerung"
                    : s === "2"
                      ? "1. Mahnung"
                      : "Letzte Mahnung"
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStufe(s)}
                    disabled={used && stufe !== s}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      stufe === s
                        ? "border-primary bg-primary/5 ring-primary/20 ring-4"
                        : used
                          ? "border-border bg-muted/50 opacity-60"
                          : "border-border hover:border-primary/40"
                    )}
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      Stufe {s}
                    </div>
                    <div className="text-sm font-medium">{label}</div>
                    {used ? (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        · bereits erstellt
                      </div>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {existing.length > 0 ? (
            <div className="grid gap-2 rounded-xl border p-3">
              <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                Bereits erstellt
              </p>
              {existing.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <span className="font-medium">Stufe {m.stufe}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      · {new Date(m.issued_at).toLocaleDateString("de-DE")}
                    </span>
                    {m.sent_at ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                        <Check className="size-2.5" />
                        gesendet
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {formatMoney(m.total_cents)}
                    </span>
                    {/* Send-Button: deaktiviert, wenn bereits gesendet — server
                        gibt 409 zurück. Spinner pro-Row über sendingId. */}
                    <Button
                      size="icon"
                      variant={m.sent_at ? "ghost" : "default"}
                      className="size-7"
                      title={
                        m.sent_at
                          ? `Bereits gesendet am ${new Date(m.sent_at).toLocaleString("de-DE")}`
                          : "Per E-Mail an Kunde senden"
                      }
                      disabled={!!m.sent_at || sendingId === m.id}
                      onClick={() => sendMut.mutate(m.id)}
                    >
                      {sendingId === m.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                    </Button>
                    <Button size="icon" variant="ghost" asChild className="size-7">
                      <a
                        href={`/api/mahnung/${m.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="size-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

        </div>

        <div className={cn("grid gap-4", step !== 2 && "hidden")}>
          <div className="rounded-xl border p-4">
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
              Du erstellst gleich
            </p>
            <p className="text-lg font-semibold">
              {stufe === "1"
                ? "Stufe 1 — Zahlungserinnerung"
                : stufe === "2"
                  ? "Stufe 2 — 1. Mahnung"
                  : "Stufe 3 — Letzte Mahnung"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Rechnung {invoice.number} · {formatMoney(outstanding)} offen
            </p>
          </div>

          <div className="bg-muted/50 rounded-xl border p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="text-foreground mb-1 font-medium">Was im PDF steht:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Verzugszinsen nach §288 BGB (Basis + 5 p.p. bei Verbrauchern,
                +9 p.p. bei B2B)
              </li>
              <li>Konfigurierbare Mahngebühr (Settings → Mahnwesen)</li>
              <li>
                Bei B2B: €40 Verzugspauschale nach §288 V BGB (einmalig pro
                Forderung)
              </li>
              <li>Neue Zahlungsfrist + Hinweis auf gerichtliches Verfahren</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {step === 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button onClick={() => setStep(2)}>
                Weiter
                <ArrowRight className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={createMut.isPending}
              >
                <ArrowLeft className="size-3.5" />
                Zurück
              </Button>
              <Button
                onClick={() => createMut.mutate(stufe)}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Bell />
                )}
                Erstellen & PDF öffnen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
