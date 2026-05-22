import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Locale segments: /de, /ru, /en, /uk. Strip for guard decisions.
  const LOCALE_REGEX = /^\/(de|ru|en|uk)(?=\/|$)/
  const stripLocale = (p: string) => p.replace(LOCALE_REGEX, "")
  const bare = stripLocale(pathname)

  const isAuthRoute =
    bare.startsWith("/login") ||
    bare.startsWith("/auth") ||
    bare.startsWith("/forgot-password") ||
    bare.startsWith("/reset-password") ||
    bare.startsWith("/sign-up")
  const isApiAuth = bare.startsWith("/api/auth") || bare.startsWith("/auth/callback")
  const isPublicAsset =
    bare.startsWith("/_next") ||
    bare === "/favicon.ico" ||
    bare === "/sitemap.xml" ||
    bare === "/robots.txt" ||
    bare.startsWith("/opengraph") ||
    bare.startsWith("/apple-icon") ||
    /\.(ico|png|jpg|jpeg|gif|webp|svg|xml|txt)$/i.test(bare)
  // Public marketing/legal pages — accessible without auth
  const isPublic =
    bare === "" ||
    bare === "/" ||
    bare.startsWith("/pricing") ||
    bare.startsWith("/impressum") ||
    bare.startsWith("/datenschutz") ||
    bare.startsWith("/agb") ||
    bare.startsWith("/widerruf") ||
    bare.startsWith("/api/waitlist")

  // Not logged in + trying to reach a protected route → redirect to /login
  if (!user && !isAuthRoute && !isApiAuth && !isPublicAsset && !isPublic) {
    const url = request.nextUrl.clone()
    const localePrefix = pathname.match(LOCALE_REGEX)?.[0] ?? "/de"
    url.pathname = `${localePrefix}/login`
    return NextResponse.redirect(url)
  }

  // Logged in + on /login → bounce to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    const localePrefix = pathname.match(LOCALE_REGEX)?.[0] ?? "/de"
    url.pathname = `${localePrefix}/dashboard`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
