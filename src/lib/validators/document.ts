import { z } from "zod"

/**
 * Future-date guard for invoice/quote `issue_date`.
 *
 * Invoices that lie more than 1 day in the future are almost always typos
 * and break GoBD compliance (Zeitnähe-Prinzip — bookings should be near the
 * actual transaction date).
 *
 * Same rule mirrors `src/lib/validators/entry.ts`.
 */
const MAX_FUTURE_DAYS = 1
function isNotTooFarInFuture(iso: string): boolean {
  if (!iso) return true
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  const limit = todayUTC.getTime() + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000
  return d.getTime() <= limit
}

export const lineItemSchema = z.object({
  id: z.string().optional(),
  position: z.number().int().min(1),
  description: z.string().trim().min(1, "required").max(1000),
  quantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1).max(20).default("Stk"),
  unit_code: z.string().trim().max(10).optional().or(z.literal("")),
  unit_price_cents: z.coerce.number().int(),
  vat_rate: z.coerce.number().min(0).max(25),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
})

export type LineItemInput = z.input<typeof lineItemSchema>

export const documentSchema = z.object({
  client_id: z.string().uuid({ message: "required" }),
  /**
   * Optionaler manueller Rechnungs-/Angebots-Nummer-Override.
   * Leer = automatisch generiert via allocate_number RPC (gap-free, GoBD-konform).
   * Gesetzt = wird im Entwurf gespeichert und beim Finalisieren akzeptiert.
   * Format: max 50 Zeichen, alphanum + Bindestrich/Underscore/Slash erlaubt.
   */
  manual_number: z
    .string()
    .trim()
    .max(50)
    .regex(/^[A-Za-z0-9\-_/.]+$/, "invalid-format")
    .optional()
    .or(z.literal("")),
  issue_date: z
    .string()
    .min(1)
    .refine(isNotTooFarInFuture, {
      message: "Rechnungsdatum darf maximal 1 Tag in der Zukunft liegen",
    }),
  delivery_date: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  valid_until: z.string().optional().or(z.literal("")),
  currency: z.string().length(3).default("EUR"),
  reverse_charge: z.boolean().default(false),
  payment_terms: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  internal_notes: z.string().max(2000).optional().or(z.literal("")),
  show_signature: z.boolean().optional().default(false),
  show_stamp: z.boolean().optional().default(false),
  lines: z.array(lineItemSchema).min(1, "at-least-one-line"),
})

export type DocumentInput = z.input<typeof documentSchema>
