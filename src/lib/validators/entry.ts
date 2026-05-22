import { z } from "zod"

/**
 * Future-date guard for `occurred_on`.
 *
 * Rationale: bookkeeping entries that lie more than ~24h in the future are
 * almost always typos. We allow today + 1 day of slack so timezone-edge
 * cases (local-midnight at UTC-12 etc.) don't trip honest entries.
 *
 * Same rule is applied in `document.ts` to `issue_date`.
 */
const MAX_FUTURE_DAYS = 1
function isNotTooFarInFuture(iso: string): boolean {
  if (!iso) return true // upstream .min(1) handles empties
  // Parse as date-only, ignore TZ.
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  const limit = todayUTC.getTime() + MAX_FUTURE_DAYS * 24 * 60 * 60 * 1000
  return d.getTime() <= limit
}

export const entrySchema = z.object({
  occurred_on: z
    .string()
    .min(1)
    .refine(isNotTooFarInFuture, {
      message: "Datum darf maximal 1 Tag in der Zukunft liegen",
    }),
  amount: z.string().min(1),
  category_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  vendor: z.string().max(120).optional().or(z.literal("")),
  payment_method: z.string().max(40).optional().or(z.literal("")),
  vat_rate: z.coerce.number().min(0).max(25).default(0),
  is_deductible: z.boolean().default(true),
  jobcenter_relevant: z.boolean().default(true),
  private_share_pct: z.coerce.number().min(0).max(100).default(0),
  attachment_url: z.string().optional().or(z.literal("")),
  /** Kfz-Pauschale (§9 EStG): wenn gesetzt → amount_cents wird aus km × 30c berechnet. */
  is_kfz_pauschale: z.boolean().default(false),
  mileage_km: z.coerce.number().min(0).max(100000).default(0),
})

export type EntryInput = z.input<typeof entrySchema>
