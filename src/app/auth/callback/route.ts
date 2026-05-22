import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { locales, defaultLocale } from "@/i18n/locale"

/**
 * Auth-Callback für:
 *   1) E-Mail-Bestätigung (Signup) — `?code=…&type=signup`
 *   2) Magic Link — `?code=…`
 *   3) OAuth (Google, Apple) — `?code=…`
 *   4) Passwort-Reset — `?code=…&type=recovery`
 *
 * Erfolgsfall → Redirect ins Dashboard in der gewählten Locale.
 * Fehlerfall  → Redirect zur Login-Seite mit `?error=…`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const type = searchParams.get("type")
  const errorDescription = searchParams.get("error_description")

  // Locale aus Cookie / Referer / Default ermitteln
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  const referer = request.headers.get("referer") ?? ""
  const refererMatch = referer.match(/\/(de|en|ru|uk)(?:\/|$|\?)/)
  const detectedLocale = (
    locales.includes((cookieLocale ?? "") as never)
      ? cookieLocale
      : refererMatch?.[1]
  ) as (typeof locales)[number] | undefined
  const locale = detectedLocale ?? defaultLocale

  // Custom redirect target (z. B. nach Login zurück zu /pricing)
  const next = searchParams.get("next") ?? `/${locale}/dashboard`

  // OAuth-Provider hat einen Fehler zurückgegeben (User klickte "Abbrechen" o. ä.)
  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/${locale}/login?error=${encodeURIComponent(errorDescription)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/${locale}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  // Spezialfall: Passwort-Reset → User soll auf reset-password landen, nicht Dashboard
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/${locale}/reset-password`)
  }

  // Erfolg → Dashboard
  // Immer x-forwarded-host bevorzugen (Cloudflare-Tunnel + Vercel).
  // Ohne Forwarding (direkt localhost) → origin verwenden.
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin

  return NextResponse.redirect(`${publicOrigin}${next}`)
}
