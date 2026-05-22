"use client"

import * as React from "react"

import { createClient } from "@/lib/supabase/client"

/**
 * Memoized browser Supabase client — one per component lifetime.
 * Always prefer this over `new createClient()` inside effects.
 */
export function useSupabase() {
  const [client] = React.useState(() => createClient())
  return client
}
