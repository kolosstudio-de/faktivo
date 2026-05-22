/**
 * Sonner-Toast-Wrapper mit Dedup-Key.
 *
 * Warum:
 *   Bei Bulk-Operationen (z.B. 50 banking_transactions kategorisiert in
 *   einer Session) feuern wir oft denselben "saved"-Toast hintereinander.
 *   Ohne Dedup-Key stapelt Sonner sie alle übereinander.
 *
 * Verwendung:
 *   ```ts
 *   import { toast } from "@/lib/utils/toast"
 *
 *   toast.success("Transaktion kategorisiert")
 *   // Identische Nachricht innerhalb 1.5 s → Counter (×2, ×3 …) statt neuem Toast.
 *   ```
 */

import { toast as sonnerToast } from "sonner"

const DEDUPE_WINDOW_MS = 1500

interface SeenEntry {
  /** Sonner toast ID, returned by sonnerToast.* calls. */
  id: string | number
  /** Last time this exact message was shown. */
  ts: number
  /** Wie oft gestapelt — fließt in den sichtbaren Counter ein. */
  count: number
}

const seen = new Map<string, SeenEntry>()

type SonnerLevel = "success" | "error" | "info" | "warning" | "message"

function keyFor(level: SonnerLevel, message: string): string {
  return `${level}::${message}`
}

function shouldDedupe(key: string): SeenEntry | null {
  const prev = seen.get(key)
  if (!prev) return null
  if (Date.now() - prev.ts > DEDUPE_WINDOW_MS) return null
  return prev
}

function show(level: SonnerLevel, message: string, opts?: Parameters<typeof sonnerToast.success>[1]) {
  const key = keyFor(level, message)
  const prev = shouldDedupe(key)

  if (prev) {
    prev.count += 1
    prev.ts = Date.now()
    const visibleMessage = `${message} (×${prev.count})`
    // Sonner has no native "update by id and re-extend" — we dismiss
    // and re-show, which works smoothly because timing is < 1.5 s.
    sonnerToast.dismiss(prev.id)
    const id = level === "message"
      ? sonnerToast(visibleMessage, opts)
      : sonnerToast[level](visibleMessage, opts)
    prev.id = id
    return id
  }

  const id = level === "message"
    ? sonnerToast(message, opts)
    : sonnerToast[level](message, opts)
  seen.set(key, { id, ts: Date.now(), count: 1 })
  return id
}

export const toast = {
  success: (message: string, opts?: Parameters<typeof sonnerToast.success>[1]) =>
    show("success", message, opts),
  error: (message: string, opts?: Parameters<typeof sonnerToast.error>[1]) =>
    show("error", message, opts),
  info: (message: string, opts?: Parameters<typeof sonnerToast.info>[1]) =>
    show("info", message, opts),
  warning: (message: string, opts?: Parameters<typeof sonnerToast.warning>[1]) =>
    show("warning", message, opts),
  message: (message: string, opts?: Parameters<typeof sonnerToast>[1]) =>
    show("message", message, opts),
  /** Direktzugriff für promise() / loading() / dismiss() etc. */
  raw: sonnerToast,
}
