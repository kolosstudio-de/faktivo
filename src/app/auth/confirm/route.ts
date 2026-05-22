/**
 * Email-Confirm-Endpoint (Supabase-empfohlener Token-Hash-Flow).
 *
 * Wird vom E-Mail-Bestätigungslink getroffen:
 *   {{ .SiteURL }}/auth/confirm?token_hash=…&type=signup&next=/de/dashboard
 *
 * Vorteil ggü. {{ .ConfirmationURL }}: keine Kong-/auth/v1-/verify-Probleme,
 * weil wir die Verifikation server-seitig in Next.js machen und dann lokal
 * cookies setzen.
 *
 * Doku: https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr
 */
import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { defaultLocale, locales } from "@/i18n/locale"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const nextPath = searchParams.get("next")

  // Locale aus Cookie / Referer / Default
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  const refererMatch = (request.headers.get("referer") ?? "").match(
    /\/(de|en|ru|uk)(?:\/|$|\?)/,
  )
  const detectedLocale = (
    locales.includes((cookieLocale ?? "") as never)
      ? cookieLocale
      : refererMatch?.[1]
  ) as (typeof locales)[number] | undefined
  const locale = detectedLocale ?? defaultLocale

  // Public-facing URL (Cloudflare Tunnel / Vercel)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  const publicOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin

  const fallback = `${publicOrigin}/${locale}/dashboard`
  const target = nextPath
    ? // Erlaube nur Pfade, niemals fremde Origins
      nextPath.startsWith("/")
      ? `${publicOrigin}${nextPath}`
      : fallback
    : fallback

  if (!token_hash || !type) {
    return NextResponse.redirect(
      `${publicOrigin}/${locale}/login?error=missing_token`,
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })

  if (error) {
    return NextResponse.redirect(
      `${publicOrigin}/${locale}/login?error=${encodeURIComponent(error.message)}`,
    )
  }

  // Spezialfall: Recovery → reset-password
  if (type === "recovery") {
    return NextResponse.redirect(`${publicOrigin}/${locale}/reset-password`)
  }

  return NextResponse.redirect(target)
}
