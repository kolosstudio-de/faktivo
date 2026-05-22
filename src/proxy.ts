import createIntlMiddleware from "next-intl/middleware"
import type { NextRequest } from "next/server"

import { routing } from "./i18n/routing"
import { updateSession } from "./lib/supabase/middleware"

const intlMiddleware = createIntlMiddleware(routing)

// Next.js 16 exports the middleware as `proxy`.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // SEO files + PWA manifest + icons + API routes must bypass locale + auth
  // handling entirely. Without the manifest/icons in this list, the proxy
  // redirects them to /de/login → PWA installation breaks (307 → auth gate).
  if (
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/apple-icon") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/")
  ) {
    return
  }

  // Auth callback must NOT be locale-prefixed — handled at /auth/callback directly.
  if (pathname.startsWith("/auth/")) {
    return await updateSession(request)
  }

  // First run Supabase session refresh — this may redirect unauthenticated users
  const supabaseResponse = await updateSession(request)

  // If Supabase decided to redirect (login or dashboard bounce), respect it
  if (
    supabaseResponse.headers.get("location") &&
    supabaseResponse.status >= 300 &&
    supabaseResponse.status < 400
  ) {
    return supabaseResponse
  }

  // Otherwise let next-intl handle locale routing
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
