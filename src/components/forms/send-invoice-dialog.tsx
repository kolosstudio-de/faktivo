"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2, Mail, Send } from "lucide-react"
import { toast } from "sonner"

import type { Invoice } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  invoice: Invoice
  clientEmail: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SendInvoiceDialog({ invoice, clientEmail, open, onOpenChange }: Props) {
  const [message, setMessage] = React.useState("")
  const [bcc, setBcc] = React.useState("")

  const sendMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoice/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || undefined,
          bcc: bcc || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Senden fehlgeschlagen")
      }
      return data as {
        ok: true
        provider: "resend" | "dry-run"
        id?: string
        previewText?: string
      }
    },
    onSuccess: (result) => {
      if (result.provider === "dry-run") {
        toast.success("Dry-Run gesendet (RESEND_API_KEY nicht gesetzt)", {
          description: "Im Produktionsbetrieb geht der PDF per Email raus.",
        })
      } else {
        toast.success(`Email versendet an ${clientEmail}`, {
          description: result.id ? `Resend-ID: ${result.id}` : undefined,
        })
      }
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Rechnung per Email senden
          </DialogTitle>
          <DialogDescription>
            Der PDF und die wichtigsten Daten werden an{" "}
            <span className="font-mono">{clientEmail ?? "—"}</span> gesendet.
          </DialogDescription>
        </DialogHeader>

        {!clientEmail ? (
          <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-500/20 p-3 text-xs">
            Dieser Kunde hat keine E-Mail-Adresse hinterlegt. Trage sie zuerst im Kunden-Profil ein.
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="send-msg" className="text-sm">
                Persönliche Nachricht (optional)
              </Label>
              <Textarea
                id="send-msg"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="z.B. ‚Vielen Dank für den Auftrag — anbei die Rechnung.'"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="send-bcc" className="text-sm">
                BCC (optional)
              </Label>
              <Input
                id="send-bcc"
                type="email"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="buchhaltung@example.com"
              />
            </div>
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
            onClick={() => sendMut.mutate()}
            disabled={!clientEmail || sendMut.isPending}
          >
            {sendMut.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Jetzt senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
