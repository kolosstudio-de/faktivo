"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Ban,
  Bell,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useRouter } from "@/i18n/navigation"
import { finalizeInvoice, stornoInvoice } from "@/lib/numbering"
import type { Invoice } from "@/types/database.types"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PaymentDialog } from "./payment-dialog"
import { MahnungDialog } from "./mahnung-dialog"
import { SendInvoiceDialog } from "./send-invoice-dialog"
import { FinalizeConfirmDialog } from "./finalize-confirm-dialog"

interface Props {
  invoice: Invoice
  clientEmail?: string | null
}

export function InvoiceActions({ invoice, clientEmail }: Props) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [mahnungOpen, setMahnungOpen] = React.useState(false)
  const [sendOpen, setSendOpen] = React.useState(false)
  const [stornoOpen, setStornoOpen] = React.useState(false)
  const [stornoReason, setStornoReason] = React.useState("")

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    router.refresh()
  }

  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = React.useState(false)

  const finalizeMut = useMutation({
    mutationFn: () => finalizeInvoice(supabase, invoice.id),
    onSuccess: () => {
      toast.success("Rechnung finalisiert — Nummer vergeben")
      setFinalizeConfirmOpen(false)
      invalidate()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      await supabase
        .from("line_items")
        .delete()
        .eq("parent_id", invoice.id)
        .eq("parent_kind", "invoice")
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoice.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Gelöscht")
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      router.push("/invoices")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const stornoMut = useMutation({
    // reason ist im Dialog auf min. 3 Zeichen vorvalidiert (siehe Button-disabled-Logik);
    // wir geben den getrimmten String 1:1 weiter — die Helper-Funktion fast-fails
    // bei < 3 Zeichen mit derselben Meldung wie der serverseitige Check.
    mutationFn: (reason: string) =>
      stornoInvoice(supabase, invoice.id, reason),
    onSuccess: (storno) => {
      toast.success("Storno-Rechnung erstellt")
      setStornoOpen(false)
      invalidate()
      if (storno) router.push(`/invoices/${storno.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const duplicateMut = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const today = new Date().toISOString().slice(0, 10)
      const { data: newInvoice, error } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          client_id: invoice.client_id,
          issue_date: today,
          delivery_date: today,
          due_date: null,
          status: "draft",
          subtotal_cents: invoice.subtotal_cents,
          vat_cents: invoice.vat_cents,
          total_cents: invoice.total_cents,
          currency: invoice.currency,
          is_kleinunternehmer_at_issue: invoice.is_kleinunternehmer_at_issue,
          reverse_charge: invoice.reverse_charge,
          payment_terms: invoice.payment_terms,
          notes: invoice.notes,
          internal_notes: `Kopie von ${invoice.number ?? "Entwurf"}`,
        })
        .select()
        .single()
      if (error) throw error

      // Copy line items
      const { data: originalLines } = await supabase
        .from("line_items")
        .select("*")
        .eq("parent_id", invoice.id)
        .eq("parent_kind", "invoice")
        .order("position")

      if (originalLines && originalLines.length > 0) {
        const newLines = (originalLines as Array<Record<string, unknown>>).map(
          (l) => ({
            user_id: user.id,
            parent_id: newInvoice!.id,
            parent_kind: "invoice",
            position: l.position,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_code: l.unit_code,
            unit_price_cents: l.unit_price_cents,
            vat_rate: l.vat_rate,
            discount_pct: l.discount_pct,
            line_subtotal_cents: l.line_subtotal_cents,
            line_vat_cents: l.line_vat_cents,
            line_total_cents: l.line_total_cents,
          })
        )
        await supabase.from("line_items").insert(newLines)
      }

      return newInvoice!.id
    },
    onSuccess: (newId) => {
      toast.success("Kopie als Entwurf erstellt")
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      router.push(`/invoices/${newId}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const isDraft = invoice.status === "draft"
  const isImported = Boolean(invoice.is_imported)
  const isLocked = Boolean(invoice.locked_at)
  const canStorno = isLocked && invoice.status !== "cancelled" && !isImported
  const canPay = isLocked && invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.total_cents > 0
  const canMahnen =
    isLocked &&
    invoice.status !== "paid" &&
    invoice.status !== "cancelled" &&
    invoice.total_cents - invoice.paid_cents > 0
  const canDelete = isDraft || isImported

  return (
    <>
      <div className="flex items-center gap-2">
        {isDraft ? (
          <Button
            size="sm"
            onClick={() => setFinalizeConfirmOpen(true)}
            disabled={finalizeMut.isPending}
          >
            {finalizeMut.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
            {finalizeMut.isPending ? "Vergebe Nummer …" : "Finalisieren"}
          </Button>
        ) : null}

        <FinalizeConfirmDialog
          invoiceId={invoice.id}
          open={finalizeConfirmOpen}
          onOpenChange={(o) => {
            if (!finalizeMut.isPending) setFinalizeConfirmOpen(o)
          }}
          onConfirm={() => finalizeMut.mutate()}
          isPending={finalizeMut.isPending}
        />

        {canPay ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => setPaymentOpen(true)}
          >
            <Wallet />
            Zahlung erfassen
          </Button>
        ) : null}

        {canMahnen ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMahnungOpen(true)}
            className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          >
            <Bell />
            Mahnung
          </Button>
        ) : null}

        {invoice.number && isLocked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSendOpen(true)}
          >
            <Send />
            Per Email senden
          </Button>
        ) : null}

        {canPay ? (
          <PayLinkButton invoice={invoice} />
        ) : null}

        {invoice.number ? (
          <>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/pdf/invoice/${invoice.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <Download />
                PDF
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/erechnung/${invoice.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <Download />
                XRechnung (XML)
              </a>
            </Button>
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canStorno ? (
              <>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setStornoOpen(true)
                  }}
                  className="text-amber-600 focus:text-amber-600"
                >
                  <Ban />
                  Storno-Rechnung erstellen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onClick={() => duplicateMut.mutate()}>
              <Copy />
              Als Entwurf duplizieren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
                        ? "Die importierte Rechnung und ihre Positionen werden entfernt. Das hochgeladene PDF bleibt vorübergehend im Speicher. Der Nummernkreis bleibt unverändert — wenn du erneut unter gleicher Nummer importierst, wähle denselben Wert."
                        : "Es wird keine Nummer verbrannt. Finalisierte Rechnungen können nicht gelöscht werden (GoBD)."}
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

      <PaymentDialog
        invoice={invoice}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />

      <MahnungDialog
        invoice={invoice}
        open={mahnungOpen}
        onOpenChange={setMahnungOpen}
      />

      <SendInvoiceDialog
        invoice={invoice}
        clientEmail={clientEmail ?? null}
        open={sendOpen}
        onOpenChange={setSendOpen}
      />

      <Dialog open={stornoOpen} onOpenChange={setStornoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storno-Rechnung erstellen</DialogTitle>
            <DialogDescription>
              Erzeugt eine Storno-Rechnung mit negativen Beträgen und einer
              eigenen Nummer. Die Originalrechnung wird als „Storniert&ldquo;
              markiert und bleibt nach §14c UStG / GoBD dauerhaft im Archiv —
              auch nach 10 Jahren noch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="storno-reason">
              Grund <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="storno-reason"
              rows={3}
              placeholder="z. B. Falsche Adresse, Leistung abgebrochen, …"
              value={stornoReason}
              onChange={(e) => setStornoReason(e.target.value)}
              aria-invalid={stornoReason.trim().length > 0 && stornoReason.trim().length < 3}
            />
            <p className="text-muted-foreground text-xs">
              Mindestens 3 Zeichen — Pflichtfeld für Audit & Steuerberater-Nachvollzug.
            </p>
          </div>
          <div className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-lg border p-3 text-xs">
            <strong>Achtung:</strong> Dieser Schritt ist nicht rückgängig zu
            machen. Die Originalrechnung erhält dauerhaft den Status
            „Storniert&ldquo;.
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStornoOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => stornoMut.mutate(stornoReason.trim())}
              disabled={
                stornoMut.isPending || stornoReason.trim().length < 3
              }
              className="bg-amber-600 hover:bg-amber-700"
            >
              {stornoMut.isPending ? <Loader2 className="animate-spin" /> : null}
              Verbindlich stornieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Stripe Payment Link Button ────────────────────────────────────────────
function PayLinkButton({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/invoices/${invoice.id}/payment-link`, {
        method: "POST",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "Konnte Pay-Link nicht erstellen")
      }
      return (await r.json()) as { url: string; id: string; reused: boolean }
    },
    onSuccess: () => {
      setOpen(true)
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const url = invoice.stripe_payment_link_url ?? createMut.data?.url ?? ""

  if (!invoice.stripe_payment_link_url) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => createMut.mutate()}
        disabled={createMut.isPending}
        className="border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-400"
      >
        {createMut.isPending ? <Loader2 className="animate-spin" /> : <Zap />}
        Pay-Link erstellen
      </Button>
    )
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-400"
      >
        <CreditCard />
        Pay-Link
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-5 text-violet-500" />
              Stripe Payment Link
            </DialogTitle>
            <DialogDescription>
              Teile diesen Link mit deinem Kunden. Sobald er bezahlt, fließt der
              Betrag automatisch in deine Rechnung — ohne dein Zutun.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="bg-muted/50 flex items-center gap-2 rounded-lg border p-3">
              <code className="flex-1 truncate font-mono text-xs">{url}</code>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => {
                  navigator.clipboard.writeText(url)
                  toast.success("In Zwischenablage kopiert")
                }}
              >
                <Copy className="size-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>

            <div className="bg-violet-500/5 border-violet-500/20 rounded-lg border p-3 text-xs leading-relaxed">
              <p className="font-medium text-violet-700 dark:text-violet-400">
                💡 So funktioniert&apos;s:
              </p>
              <ul className="mt-1.5 grid gap-1 text-muted-foreground">
                <li>· Kunde klickt Link → bezahlt mit Karte/SEPA/Klarna</li>
                <li>· Stripe schickt Webhook → Rechnung wird automatisch als bezahlt markiert</li>
                <li>· Du bekommst Email-Bestätigung (wenn Resend aktiv)</li>
                <li>· Stripe-Gebühr: 1,5 % + 0,25 € (zahlt der Kunde, nicht du)</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
