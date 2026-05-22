"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Landmark, Loader2, Lock, Plus, Shield, Sparkles } from "lucide-react"
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

const POPULAR_BANKS = [
  "🟢 N26",
  "🟠 DKB",
  "🔴 Sparkasse",
  "🔵 ING",
  "🟡 Commerzbank",
  "🔷 Postbank",
  "🟦 Deutsche Bank",
  "🟣 comdirect",
  "🟥 Volksbank/Raiffeisen",
  "⚫ Revolut",
  "🌱 Tomorrow",
  "💵 Wise",
]

export function BankConnector() {
  const [open, setOpen] = React.useState(false)

  const connectMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/banking/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "Connect fehlgeschlagen")
      }
      return (await r.json()) as { redirect: string }
    },
    onSuccess: (data) => {
      window.location.href = data.redirect
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Bank verbinden
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="size-5 text-primary" />
            Bank verbinden via PSD2
          </DialogTitle>
          <DialogDescription>
            Klick auf <strong>Weiter</strong> — du wirst zu unserem
            PSD2-Provider TrueLayer weitergeleitet, wählst deine Bank,
            authentifizierst dich kurz mit TAN/Push, und kommst zurück nach
            Kolos. Ab dann werden deine Transaktionen{" "}
            <strong>automatisch synchronisiert</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="bg-muted/40 grid gap-2 rounded-xl border p-3">
            <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
              Unterstützte Banken (~99 % DE-Marktabdeckung)
            </p>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {POPULAR_BANKS.map((b) => (
                <span
                  key={b}
                  className="bg-card rounded-md border px-2 py-1"
                >
                  {b}
                </span>
              ))}
              <span className="bg-card rounded-md border px-2 py-1 text-muted-foreground">
                + alle Sparkassen, Volksbanken &amp; weitere
              </span>
            </div>
          </div>

          <ul className="grid gap-1.5 text-xs">
            <li className="flex items-center gap-2">
              <Shield className="text-emerald-500 size-3.5" />
              <span>Read-only Zugriff — keine Überweisungen möglich</span>
            </li>
            <li className="flex items-center gap-2">
              <Lock className="text-emerald-500 size-3.5" />
              <span>TAN/Passwort bleibt bei dir, wir sehen sie nie</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="text-emerald-500 size-3.5" />
              <span>90 Tage gültig (PSD2 §35 RTS), danach erneut bestätigen</span>
            </li>
          </ul>

          <p className="text-muted-foreground text-[10px] leading-relaxed">
            EU-konform nach PSD2 §675f BGB. Lizenzierter AIS-Provider:
            TrueLayer Ltd, FCA-reguliert (Visa-Tochter).
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={() => connectMut.mutate()}
            disabled={connectMut.isPending}
          >
            {connectMut.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Landmark />
            )}
            Weiter zu TrueLayer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
