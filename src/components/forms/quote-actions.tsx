"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  Download,
  Loader2,
  MoreHorizontal,
  Receipt,
  Send,
  Trash2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useRouter } from "@/i18n/navigation"
import { finalizeQuote } from "@/lib/numbering"
import { computeLineTotals, sumDocumentTotals } from "@/lib/money"
import type { LineItem, Quote, QuoteStatus } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Props {
  quote: Quote
  lines: LineItem[]
  isKleinunternehmer: boolean
}

export function QuoteActions({ quote, lines, isKleinunternehmer }: Props) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["quotes"] })
    router.refresh()
  }

  const finalizeMut = useMutation({
    mutationFn: () => finalizeQuote(supabase, quote.id),
    onSuccess: () => {
      toast.success("Angebot finalisiert & versendet")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const statusMut = useMutation({
    mutationFn: async (status: QuoteStatus) => {
      const { error } = await supabase
        .from("quotes")
        .update({ status })
        .eq("id", quote.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Status aktualisiert")
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      // Cascade will remove line_items if FK is set that way, otherwise manual cleanup:
      await supabase
        .from("line_items")
        .delete()
        .eq("parent_id", quote.id)
        .eq("parent_kind", "quote")
      const { error } = await supabase.from("quotes").delete().eq("id", quote.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Gelöscht")
      queryClient.invalidateQueries({ queryKey: ["quotes"] })
      router.push("/quotes")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const convertMut = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const perLine = lines.map((l) =>
        computeLineTotals({
          quantity: Number(l.quantity),
          unitPriceCents: l.unit_price_cents,
          vatRatePct: isKleinunternehmer ? 0 : Number(l.vat_rate),
          discountPct: Number(l.discount_pct),
        })
      )
      const totals = sumDocumentTotals(perLine, { isKleinunternehmer })

      const today = new Date().toISOString().slice(0, 10)
      const due = new Date()
      due.setDate(due.getDate() + 14)

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          client_id: quote.client_id,
          quote_id: quote.id,
          issue_date: today,
          delivery_date: today,
          due_date: due.toISOString().slice(0, 10),
          is_kleinunternehmer_at_issue: isKleinunternehmer,
          currency: quote.currency,
          notes: quote.notes,
          internal_notes: quote.internal_notes,
          subtotal_cents: totals.subtotalCents,
          vat_cents: totals.vatCents,
          total_cents: totals.totalCents,
        })
        .select()
        .single()
      if (error) throw error

      const liInserts = lines.map((l, i) => {
        const t = perLine[i]
        return {
          user_id: user.id,
          parent_id: invoice!.id,
          parent_kind: "invoice" as const,
          position: i + 1,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_code: l.unit_code,
          unit_price_cents: l.unit_price_cents,
          vat_rate: isKleinunternehmer ? 0 : l.vat_rate,
          discount_pct: l.discount_pct,
          line_subtotal_cents: t.lineSubtotalCents,
          line_vat_cents: t.lineVatCents,
          line_total_cents: t.lineTotalCents,
        }
      })
      const { error: liErr } = await supabase
        .from("line_items")
        .insert(liInserts)
      if (liErr) throw liErr

      // Mark quote as converted
      await supabase
        .from("quotes")
        .update({ status: "converted", converted_invoice_id: invoice!.id })
        .eq("id", quote.id)

      return invoice!.id
    },
    onSuccess: (invoiceId) => {
      toast.success("In Rechnung umgewandelt")
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["quotes"] })
      router.push(`/invoices/${invoiceId}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const isImported = Boolean(quote.is_imported)
  const canFinalize = quote.status === "draft"
  const canConvert = quote.status !== "converted" && quote.status !== "rejected"
  const canDelete = quote.status === "draft" || isImported

  return (
    <div className="flex items-center gap-2">
      {canFinalize ? (
        <Button
          size="sm"
          onClick={() => finalizeMut.mutate()}
          disabled={finalizeMut.isPending}
        >
          {finalizeMut.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Send />
          )}
          Finalisieren & senden
        </Button>
      ) : null}

      {canConvert ? (
        <Button
          size="sm"
          variant="default"
          onClick={() => convertMut.mutate()}
          disabled={convertMut.isPending}
        >
          {convertMut.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Receipt />
          )}
          In Rechnung umwandeln
        </Button>
      ) : null}

      {quote.number ? (
        <Button size="sm" variant="outline" asChild>
          <a
            href={`/api/pdf/quote/${quote.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download />
            PDF
          </a>
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {quote.status === "sent" ? (
            <>
              <DropdownMenuItem
                onClick={() => statusMut.mutate("accepted")}
              >
                <CheckCircle2 />
                Als angenommen markieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => statusMut.mutate("rejected")}>
                <XCircle />
                Als abgelehnt markieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive"
                >
                  <Trash2 />
                  {isImported ? "Import löschen" : "Entwurf löschen"}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isImported ? "Import löschen?" : "Entwurf löschen?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isImported
                      ? "Das importierte Angebot wird entfernt. Du kannst es danach neu importieren (gleiche oder andere Nummer)."
                      : "Diese Aktion kann nicht rückgängig gemacht werden."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMut.mutate()}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
