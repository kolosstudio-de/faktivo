/**
 * In-memory rate-limiter (token-bucket / sliding-window).
 *
 * Caveat: in Vercel-Serverless ist die Map per-Instance, nicht global.
 * Reicht für Brute-Force-Schutz auf License-Endpoints (Attacker müsste
 * gleichzeitig viele Edge-Instanzen ansprechen), nicht für hartes Quota.
 * Für globales Rate-Limit später @upstash/ratelimit + Redis einsetzen.
 *
 * Verwendung:
 *   ```ts
 *   const rl = rateLimit("license-activate", { tokensPerInterval: 5, intervalMs: 60_000 })
 *   const limited = rl(ipFrom(request))
 *   if (limited) return tooManyRequests()
 *   ```
 */

import { NextResponse, type NextRequest } from "next/server"

interface BucketState {
  /** Timestamps (ms) der letzten requests, max-Länge = tokensPerInterval. */
  hits: number[]
}

interface RateLimitOptions {
  /** Max. requests pro intervalMs. */
  tokensPerInterval: number
  intervalMs: number
  /** Max. anzahl Keys im Cache (LRU-Schutz gegen Memory-Blowup). */
  maxKeys?: number
}

/**
 * Sliding-Window-Limiter. Liefert eine Funktion `(key) => limited`.
 * `limited` ist null, wenn ok, oder { retryAfterSeconds } wenn blockiert.
 */
export function rateLimit(_name: string, opts: RateLimitOptions) {
  const cache = new Map<string, BucketState>()
  const maxKeys = opts.maxKeys ?? 5000

  return function check(key: string): { retryAfterSeconds: number } | null {
    const now = Date.now()
    const state = cache.get(key) ?? { hits: [] }
    // LRU-style: move-to-end on access
    if (cache.has(key)) cache.delete(key)
    cache.set(key, state)

    // Drop expired hits
    state.hits = state.hits.filter((t) => now - t < opts.intervalMs)

    if (state.hits.length >= opts.tokensPerInterval) {
      const oldest = Math.min(...state.hits)
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((opts.intervalMs - (now - oldest)) / 1000),
      )
      return { retryAfterSeconds }
    }

    state.hits.push(now)

    // Cap cache
    if (cache.size > maxKeys) {
      const oldestKey = cache.keys().next().value
      if (oldestKey !== undefined) cache.delete(oldestKey)
    }
    return null
  }
}

/**
 * Extrahiert eine möglichst stabile Client-IP aus dem Request.
 * Bevorzugt `x-forwarded-for` (Vercel setzt's), fällt zurück auf Remote-Addr.
 */
export function ipFromRequest(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    // erstes IP in der Liste = der echte Client
    return xff.split(",")[0].trim()
  }
  return request.headers.get("x-real-ip") ?? "unknown"
}

/** Standard 429-Antwort mit Retry-After-Header. */
export function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "rate_limited", retry_after_seconds: retryAfterSeconds },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  )
}
