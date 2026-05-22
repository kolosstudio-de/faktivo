"use client"

import * as React from "react"
import { Loader2, Lock, Send } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  invoiceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

/**
 * Vor dem Finalisieren zeigen wir das Draft-PDF in einem iframe — so erkennt
 * der User Tippfehler (Adresse, Betrag, USt-Satz) BEVOR die Rechnung
 * unwiderruflich GoBD-gelockt wird. Anschließend bestätigt er per Button.
 *
 * Warum nicht direkt finalisieren: §14 UStG + GoBD verbieten Änderungen
 * nach dem Finalisieren — eine falsche Rechnung erfordert Storno + Neuanlage.
 */
export function FinalizeConfirmDialog({
  invoiceId,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: Props) {
  // Cache-Buster: jeder open-Cycle lädt eine frische PDF (Draft-Inhalt
  // kann sich zwischen dem Click und der Anzeige geändert haben).
  const [iframeKey, setIframeKey] = React.useState(0)
  React.useEffect(() => {
    if (open) setIframeKey((k) => k + 1)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(900px,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>Rechnung finalisieren</DialogTitle>
          <DialogDescription>
            Prüfe die Vorschau. Nach dem Finalisieren ist die Rechnung
            <strong className="px-1">GoBD-gesperrt</strong>
            — Änderungen sind dann nur per Storno-Rechnung möglich.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 -mx-2 my-2 overflow-hidden rounded-lg border">
          <iframe
            key={iframeKey}
            src={`/api/pdf/invoice/${invoiceId}?preview=1`}
            title="Rechnungs-Vorschau"
            className="h-[60vh] w-full bg-white"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Zurück, noch anpassen
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <Lock className="size-3.5" />
                <Send className="size-3.5" />
              </>
            )}
            {isPending ? "Finalisiere …" : "Verbindlich finalisieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
