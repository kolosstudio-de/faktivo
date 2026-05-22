/**
 * CSRF / Origin verification for state-changing API routes.
 *
 * Why this exists:
 *   Next.js + Supabase use cookie auth, which makes us vulnerable to drive-by
 *   POSTs from third-party origins (CSRF). Adding a strict Origin check on
 *   every mutating route closes that gap without breaking same-origin XHR.
 *
 * Usage:
 *   ```ts
 *   export async function POST(request: NextRequest) {
 *     const originError = validateOrigin(request)
 *     if (originError) return originError
 *     // ...your existing handler logic
 *   }
 *   ```
 *
 * Skip on idempotent verbs (GET/HEAD) — caller decides when to call this.
 * Skip on webhooks that already verify a signature (Stripe, TrueLayer, etc.).
 */

import { NextResponse, type NextRequest } from "next/server"

const ALLOWED_LOCALHOSTS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
])

const DEV_TUNNEL_SUFFIXES = [
  ".trycloudflare.com",
  ".loca.lt",
  ".ngrok-free.app",
  ".ngrok.io",
]

/**
 * Build the allowlist from env + dev fallbacks.
 * Cached as a frozen set so we don't re-compute on every request.
 */
function getAllowedOrigins(): { exact: Set<string>; suffixes: string[] } {
  const exact = new Set<string>(ALLOWED_LOCALHOSTS)

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (publicUrl) {
    // Strip trailing slash + normalize.
    exact.add(publicUrl.replace(/\/+$/, ""))
  }
  // Vercel sets VERCEL_URL on every deploy. Trust it as a same-origin.
  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    exact.add(`https://${vercelUrl.replace(/^https?:\/\//, "")}`)
  }

  // In dev, accept cloudflared/ngrok tunnels by suffix so the user can test
  // mobile flows without re-deploying. Disabled in production.
  const suffixes = process.env.NODE_ENV === "production" ? [] : DEV_TUNNEL_SUFFIXES

  return { exact, suffixes }
}

/**
 * Returns null if the request passes Origin/Referer validation; otherwise
 * returns a 403 NextResponse the caller should return immediately.
 *
 * Logic:
 *   1. If neither Origin nor Referer is set → reject (no same-origin signal).
 *   2. Prefer Origin. If absent, fall back to Referer's origin component.
 *   3. Compare against the allowlist (exact + suffix match for dev tunnels).
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  // Derive the candidate origin.
  let candidate: string | null = null
  if (origin && origin !== "null") {
    candidate = origin
  } else if (referer) {
    try {
      const u = new URL(referer)
      candidate = `${u.protocol}//${u.host}`
    } catch {
      candidate = null
    }
  }

  if (!candidate) {
    return NextResponse.json(
      { error: "missing_origin" },
      { status: 403 }
    )
  }

  const { exact, suffixes } = getAllowedOrigins()
  if (exact.has(candidate)) return null

  // Suffix match for dev tunnels (any *.trycloudflare.com etc.).
  try {
    const host = new URL(candidate).hostname
    for (const suffix of suffixes) {
      if (host.endsWith(suffix)) return null
    }
  } catch {
    // candidate wasn't a valid URL
  }

  return NextResponse.json(
    { error: "origin_not_allowed", origin: candidate },
    { status: 403 }
  )
}
