import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-Client für Cron-Jobs / Admin-Endpoints. Umgeht RLS — nur in
 * vertrauenswürdigen Server-Routes verwenden, NIE an Client zurückgeben.
 *
 * Env: SUPABASE_SERVICE_ROLE_KEY (lokal aus `supabase status`).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error(
      "createServiceClient: missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) env"
    )
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — can be ignored if middleware refreshes sessions.
          }
        },
      },
    }
  )
}
