"use client"

import * as React from "react"
import { Keyboard } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Shortcut {
  keys: string[]
  label: string
  scope?: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], label: "Globale Suche öffnen", scope: "Überall" },
  { keys: ["?"], label: "Diese Hilfe öffnen" },
  { keys: ["Esc"], label: "Dialog schließen" },
  { keys: ["Tab"], label: "Nächstes Feld" },
  { keys: ["⏎"], label: "Formular absenden / Aktion bestätigen" },
  { keys: ["⌘", "Enter"], label: "Rechnung finalisieren (im Entwurf)" },
]

export function KeyboardShortcuts() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only fire `?` when no input is focused
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Tastenkürzel
          </DialogTitle>
          <DialogDescription>
            Schneller arbeiten mit Tastenkürzeln.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 text-sm">
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <span>{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-center text-xs">
          Drücke <kbd className="bg-muted rounded border px-1 font-mono text-[10px]">?</kbd> jederzeit um diese Hilfe anzuzeigen.
        </p>
      </DialogContent>
    </Dialog>
  )
}
