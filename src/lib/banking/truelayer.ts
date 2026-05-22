/**
 * TrueLayer Open Banking Data API client.
 *
 * https://docs.truelayer.com/docs/data-api
 *
 * PSD2 AIS flow:
 *   1. Build Authorization URL → redirect User
 *   2. User authentifiziert sich beim Bank (z.B. Sparkasse) via TrueLayer's UI
 *   3. TrueLayer callback → wir tauschen ?code= gegen access_token + refresh_token
 *   4. Wir pollen GET /data/v1/accounts/{id}/transactions
 *   5. Webhooks via /api/banking/truelayer-webhook für Real-Time Push (< 5 sek)
 *
 * Free tier: 5K Data API calls/Monat, Webhooks inklusive.
 *
 * Required env:
 *   TRUELAYER_CLIENT_ID
 *   TRUELAYER_CLIENT_SECRET
 *   TRUELAYER_USE_SANDBOX = "1" (optional — default sandbox if client_id starts with "sandbox-")
 */

/** Switch to sandbox if env-flag oder client_id beginnt mit "sandbox-". */
export function isSandbox(): boolean {
  if (process.env.TRUELAYER_USE_SANDBOX === "1") return true
  return (process.env.TRUELAYER_CLIENT_ID ?? "").startsWith("sandbox-")
}

function authBase(): string {
  return isSandbox()
    ? "https://auth.truelayer-sandbox.com"
    : "https://auth.truelayer.com"
}
function apiBase(): string {
  return isSandbox()
    ? "https://api.truelayer-sandbox.com"
    : "https://api.truelayer.com"
}

const SCOPES = [
  "info",
  "accounts",
  "balance",
  "transactions",
  "offline_access", // damit wir refresh_token bekommen
] as const

export function hasCredentials(): boolean {
  return Boolean(
    process.env.TRUELAYER_CLIENT_ID && process.env.TRUELAYER_CLIENT_SECRET
  )
}

// ─── Authorization URL (Step 1) ───────────────────────────────────────────

export interface AuthUrlInput {
  redirectUri: string
  state: string
}

/**
 * Baut die TrueLayer Authorization URL.
 *
 * In Sandbox: nutzt mock-Provider (uk-ob-mock-bank, etc.) — DE-Banken sind
 * im Sandbox nicht verfügbar.
 * In Live (production): zeigt User den TrueLayer Bank-Picker mit allen
 * deutschen PSD2-Banken (Sparkasse, Volksbanken, N26, DKB, ING,
 * Commerzbank, Postbank, comdirect, etc.).
 */
export function buildAuthorizationUrl(input: AuthUrlInput): string {
  const clientId = process.env.TRUELAYER_CLIENT_ID
  if (!clientId) {
    throw new Error("TRUELAYER_CLIENT_ID missing in .env")
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES.join(" "),
    redirect_uri: input.redirectUri,
    state: input.state,
  })
  if (isSandbox()) {
    // Im Sandbox: nur mock-Provider sind verfügbar.
    params.set("providers", "uk-ob-all uk-oauth-all uk-cs-mock")
    params.set("enable_mock", "true")
  } else {
    // Live: alle deutschen PSD2-Provider
    params.set("providers", "de-ob-all")
  }
  return `${authBase()}/?${params.toString()}`
}

// ─── Token exchange (Step 3) ─────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number // seconds
  token_type: "Bearer"
  scope: string
}

export async function exchangeCodeForToken(input: {
  code: string
  redirectUri: string
}): Promise<TokenResponse> {
  const clientId = process.env.TRUELAYER_CLIENT_ID!
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET!
  const r = await fetch(`${authBase()}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    }),
  })
  if (!r.ok) {
    throw new Error(`TrueLayer token exchange failed ${r.status}: ${await r.text()}`)
  }
  return (await r.json()) as TokenResponse
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const clientId = process.env.TRUELAYER_CLIENT_ID!
  const clientSecret = process.env.TRUELAYER_CLIENT_SECRET!
  const r = await fetch(`${authBase()}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })
  if (!r.ok) {
    throw new Error(`TrueLayer refresh failed ${r.status}: ${await r.text()}`)
  }
  return (await r.json()) as TokenResponse
}

// ─── Data API ─────────────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  results: T[]
  status: string
}

async function dataFetch<T>(
  accessToken: string,
  path: string
): Promise<ApiEnvelope<T>> {
  const r = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) {
    throw new Error(`TrueLayer ${path} → ${r.status}: ${await r.text()}`)
  }
  return (await r.json()) as ApiEnvelope<T>
}

export interface TLAccount {
  account_id: string
  account_type: string
  display_name?: string
  currency: string
  account_number?: {
    iban?: string
    swift_bic?: string
    number?: string
    sort_code?: string
  }
  provider: { provider_id: string; display_name?: string; logo_uri?: string }
  update_timestamp?: string
}

export async function listAccounts(accessToken: string): Promise<TLAccount[]> {
  const r = await dataFetch<TLAccount>(accessToken, "/data/v1/accounts")
  return r.results
}

export interface TLBalance {
  currency: string
  available: number
  current: number
  overdraft?: number
  update_timestamp?: string
}

export async function getBalance(
  accessToken: string,
  accountId: string
): Promise<TLBalance | null> {
  const r = await dataFetch<TLBalance>(
    accessToken,
    `/data/v1/accounts/${accountId}/balance`
  )
  return r.results[0] ?? null
}

export interface TLTransaction {
  transaction_id: string
  timestamp: string // ISO datetime
  description: string
  amount: number // negativ = Belastung, positiv = Gutschrift
  currency: string
  transaction_type: "DEBIT" | "CREDIT"
  transaction_category?: string
  meta?: {
    transaction_type?: string
    bank_transaction_id?: string
    provider_transaction_category?: string
    counter_party_preferred_name?: string
  }
  merchant_name?: string
  running_balance?: { amount: number; currency: string }
}

export async function listTransactions(
  accessToken: string,
  accountId: string,
  opts?: { from?: string; to?: string }
): Promise<TLTransaction[]> {
  const qs = new URLSearchParams()
  if (opts?.from) qs.set("from", opts.from)
  if (opts?.to) qs.set("to", opts.to)
  const tail = qs.toString() ? `?${qs}` : ""
  const r = await dataFetch<TLTransaction>(
    accessToken,
    `/data/v1/accounts/${accountId}/transactions${tail}`
  )
  return r.results
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function amountToCents(amount: number): number {
  return Math.round(amount * 100)
}

export function txExternalId(tx: TLTransaction): string {
  return tx.transaction_id || tx.meta?.bank_transaction_id ||
    `synth:${tx.timestamp}:${tx.amount}:${tx.description.slice(0, 60)}`
}

export function txCounterpartyName(tx: TLTransaction): string | null {
  return tx.merchant_name ?? tx.meta?.counter_party_preferred_name ?? null
}
