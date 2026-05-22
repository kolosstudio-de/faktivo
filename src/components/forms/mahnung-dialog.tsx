"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, Download, Loader2 } from "lucide-react"
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

  const outstanding = invoice.total_cents - invoice.paid_cents

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zahlungserinnerung / Mahnung erstellen</DialogTitle>
          <DialogDescription>
            Rechnung {invoice.number} · Offen: {formatMoney(outstanding)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
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
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {formatMoney(m.total_cents)}
                    </span>
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

          <div className="bg-muted/50 rounded-xl border p-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              Die Mahnung enthält Verzugszinsen nach §288 BGB (Basis + 5 p.p. bei
              Verbrauchern, +9 p.p. bei B2B), eine konfigurierbare Mahngebühr
              und — bei B2B-Rechnungen — die €40 Verzugspauschale nach §288 V
              BGB (einmalig).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
