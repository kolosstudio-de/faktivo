/**
 * Serverseitiger Sign-In-Proxy.
 *
 * Warum es das gibt:
 *   Vorher rief der Login-Form-Client direkt `supabase.auth.signInWithPassword`
 *   auf — Brute-Force-Schutz lebte nur als UX-Schild in `localStorage`
 *   (`lib/auth/login-rate-limit.ts`), das ein Angreifer trivial wegputzt.
 *   Supabase Auth selbst hat zwar interne Rate-Limits, aber sie sind
 *   global und auf Spam-Verhinderung tariert, nicht auf Anwendungs-Login.
 *
 *   Dieser Endpoint:
 *     1. Validiert Same-Origin (CSRF-Schutz).
 *     2. Rate-Limit 5/5 min, Key = `IP:email-lowercased` — verhindert
 *        IP-Rotation UND E-Mail-Rotation auf derselben IP.
 *     3. Ruft `signInWithPassword` server-seitig auf; der ssr-Cookie-Adapter
 *        setzt die Auth-Cookies automatisch in die Response.
 *
 * Die Quote `recordFailedLoginAttempt`/`getLoginRateStatus` im Client bleibt
 * als zweite UX-Verteidigungslinie bestehen — der Server ist jetzt die
 * eigentliche source of truth.
 *
 * Stand 2026-06-03
 */

import { NextResponse, type NextRequest } from "next/server"

import { validateOrigin } from "@/lib/api/csrf"
import {
  ipFromRequest,
  rateLimit,
  tooManyRequests,
} from "@/lib/api/rate-limit"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 5 Versuche pro 5 Minuten — gleiche Konstanten wie das UX-Schild
// (`lib/auth/login-rate-limit.ts`), damit sich UI-Countdown und Server-
// Antwort nicht widersprechen.
const signinLimit = rateLimit("auth-signin", {
  tokensPerInterval: 5,
  intervalMs: 5 * 60_000,
})

interface SignInBody {
  email?: unknown
  password?: unknown
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  // Body-Parsing — defensive (Client könnte irgendwas POSTen)
  let body: SignInBody
  try {
    body = (await request.json()) as SignInBody
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    )
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    )
  }

  // Rate-Limit-Key: IP + Email. Hält einen Angreifer ab, der EITHER IPs
  // rotiert ODER E-Mails durchprobiert — beides muss limitiert sein.
  const ip = ipFromRequest(request)
  const limited = signinLimit(`${ip}:${email}`)
  if (limited) return tooManyRequests(limited.retryAfterSeconds)

  // Server-side Sign-in — ssr-Adapter setzt sb-…-auth-Cookies in die Response.
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    // Supabase liefert "Email not confirmed" / "Invalid login credentials".
    // Wir mappen das auf semantische Codes, damit der Client lokalisierte
    // Toasts auswählen kann, ohne den raw-String zu parsen.
    let code: "email_not_confirmed" | "invalid_credentials" | "unknown" =
      "unknown"
    if (msg.includes("not confirmed")) code = "email_not_confirmed"
    else if (msg.includes("invalid")) code = "invalid_credentials"

    return NextResponse.json(
      { ok: false, error: code, message: error.message },
      { status: code === "email_not_confirmed" ? 403 : 401 }
    )
  }

  // Erfolg: Auth-Cookies wurden vom ssr-Adapter gesetzt. Nichts Geheimes
  // im Body zurückgeben — der Client refresht ohnehin den Auth-State.
  return NextResponse.json({
    ok: true,
    user: { id: data.user?.id, email: data.user?.email },
  })
}
