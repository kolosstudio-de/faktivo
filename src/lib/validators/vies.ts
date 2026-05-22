/**
 * VIES VAT-ID **live**-Validation (server-only).
 *
 * Spec: https://ec.europa.eu/taxation_customs/vies/#/technical-information
 * REST: https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{number}
 *
 * Cached 24 h in `vies_cache` (DB). Format-Vorprüfung ist in
 * `vies-format.ts` ausgelagert — importierbar im Client-Bundle.
 */

import { createServiceClient } from "@/lib/supabase/server"
import { isVatFormatValid, normalizeVatId } from "@/lib/validators/vies-format"

export { isVatFormatValid, normalizeVatId } from "@/lib/validators/vies-format"

export interface ViesValidation {
  isValid: boolean
  name?: string
  address?: string
  requestDate?: string
  source: "cache" | "vies"
  error?: "invalid_format" | "vies_unavailable" | "not_in_vies"
}

const VIES_TTL_HOURS = 24

interface ViesRestResponse {
  isValid?: boolean
  userError?: string
  name?: string | null
  address?: string | null
  requestDate?: string
  vatNumber?: string
  countryCode?: string
}

/**
 * Validiert eine USt-IdNr. via VIES, mit DB-Cache.
 *
 * Fehlertoleranz: wenn VIES nicht erreichbar ist und kein Cache existiert,
 * liefert die Funktion `{ isValid: false, source: 'vies', error: 'vies_unavailable' }`
 * — der Caller darf das als "noch nicht entschieden" interpretieren statt
 * den Kunden zu blockieren.
 */
export async function validateViesVat(rawVatId: string): Promise<ViesValidation> {
  const vatId = normalizeVatId(rawVatId)
  if (!isVatFormatValid(vatId)) {
    return { isValid: false, source: "vies", error: "invalid_format" }
  }

  const supabase = createServiceClient()

  const { data: cached } = await supabase
    .from("vies_cache")
    .select("*")
    .eq("vat_id", vatId)
    .maybeSingle()

  if (cached && new Date(cached.fresh_until).getTime() > Date.now()) {
    return {
      isValid: cached.is_valid,
      name: cached.name ?? undefined,
      address: cached.address ?? undefined,
      requestDate: cached.request_date ?? undefined,
      source: "cache",
    }
  }

  const country = vatId.slice(0, 2)
  const number = vatId.slice(2)
  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${country}/vat/${number}`

  let restResponse: ViesRestResponse | null = null
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      restResponse = (await res.json()) as ViesRestResponse
    }
  } catch {
    // network / timeout
  }

  if (!restResponse) {
    return { isValid: false, source: "vies", error: "vies_unavailable" }
  }

  const isValid = restResponse.isValid === true
  const fetchedAt = new Date().toISOString()
  const freshUntil = new Date(
    Date.now() + VIES_TTL_HOURS * 60 * 60_000,
  ).toISOString()

  await supabase.from("vies_cache").upsert({
    vat_id: vatId,
    is_valid: isValid,
    name: restResponse.name ?? null,
    address: restResponse.address ?? null,
    request_date: restResponse.requestDate ?? null,
    fetched_at: fetchedAt,
    fresh_until: freshUntil,
  })

  return {
    isValid,
    name: restResponse.name ?? undefined,
    address: restResponse.address ?? undefined,
    requestDate: restResponse.requestDate ?? undefined,
    source: "vies",
    error: isValid ? undefined : "not_in_vies",
  }
}
