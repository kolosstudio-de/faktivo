import type { SupabaseClient } from "@supabase/supabase-js"

import type { DocNumberKind, Invoice, Quote } from "@/types/database.types"

/**
 * Numbering RPC wrappers — gap-free sequence allocation.
 *
 * NEVER call these until the user finalizes (issues) the document.
 * The DB function runs inside a transaction with FOR UPDATE to prevent races.
 */

type AnySupabase = SupabaseClient

export async function allocateNumber(
  supabase: AnySupabase,
  kind: DocNumberKind,
  year?: number
): Promise<string> {
  const { data, error } = await supabase.rpc("allocate_number", {
    p_kind: kind,
    ...(year !== undefined ? { p_year: year } : {}),
  })
  if (error) throw error
  if (!data) throw new Error("allocate_number returned no data")
  return data as string
}

export async function finalizeInvoice(
  supabase: AnySupabase,
  invoiceId: string
): Promise<Invoice | null> {
  const { data, error } = await supabase.rpc("finalize_invoice", {
    p_invoice_id: invoiceId,
  })
  if (error) throw error
  return data as Invoice | null
}

export async function finalizeQuote(
  supabase: AnySupabase,
  quoteId: string
): Promise<Quote | null> {
  const { data, error } = await supabase.rpc("finalize_quote", {
    p_quote_id: quoteId,
  })
  if (error) throw error
  return data as Quote | null
}

/**
 * Storno-Begründung ist seit 2026-06-03 serverseitig erforderlich
 * (min. 3 Zeichen nach trim, RPC raised sqlstate `22023` sonst — siehe
 * Migration `20260603000001_storno_require_reason.sql`). Daher: `reason`
 * pflicht-Parameter, kein conditional-spread mehr.
 */
export async function stornoInvoice(
  supabase: AnySupabase,
  invoiceId: string,
  reason: string
): Promise<Invoice | null> {
  const cleaned = (reason ?? "").trim()
  if (cleaned.length < 3) {
    // Fast-fail clientseitig, bevor wir ein Roundtrip schicken — die Fehlermeldung
    // entspricht dem Server-RAISE, damit UI-Handling identisch bleibt.
    throw new Error(
      "storno_invoice: reason required (min 3 chars after trim)"
    )
  }
  const { data, error } = await supabase.rpc("storno_invoice", {
    p_invoice_id: invoiceId,
    p_reason: cleaned,
  })
  if (error) throw error
  return data as Invoice | null
}

/**
 * Format a sequence number client-side for display purposes only.
 * Never use this to generate an actual invoice number — always go through the RPC.
 */
export function formatSequenceNumber(
  prefix: string,
  year: number,
  value: number,
  width = 4
): string {
  return `${prefix}-${year}-${String(value).padStart(width, "0")}`
}
