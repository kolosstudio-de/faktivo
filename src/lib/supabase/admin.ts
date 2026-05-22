import { createClient as createAdminSupabase } from "@supabase/supabase-js"

/**
 * Service-role Supabase client — bypasses RLS.
 *
 * WARNING: Only import from server-only code (route handlers, server actions,
 * server components). Never from client components.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
