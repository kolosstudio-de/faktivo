/**
 * GET /api/banking/callback?code=...&state=...
 *
 * TrueLayer leitet hierher zurück nach SCA. Wir tauschen ?code= gegen
 * access_token + refresh_token, holen die accounts mit balance, persistieren
 * — und redirecten zu /de/banking?connected=...
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import {
  exchangeCodeForToken,
  listAccounts,
  getBalance,
  amountToCents,
} from "@/lib/banking/truelayer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL("/de/login", request.url))
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state") ?? ""
  const ref = state.split("|")[0]
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/de/banking?error=${encodeURIComponent(error)}`,
        request.url
      )
    )
  }
  if (!ref || !code) {
    return NextResponse.redirect(
      new URL("/de/banking?error=no-ref-or-code", request.url)
    )
  }

  // Find connection
  const { data: connRow } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("reference", ref)
    .single()

  if (!connRow) {
    return NextResponse.redirect(
      new URL("/de/banking?error=conn-not-found", request.url)
    )
  }

  try {
    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      `${url.protocol}//${url.host}`
    const redirectUri = `${origin}/api/banking/callback`

    const tokens = await exchangeCodeForToken({ code, redirectUri })

    await supabase
      .from("bank_connections")
      .update({
        status: "linked",
        consented_at: new Date().toISOString(),
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
        agreement_max_days: 90,
        expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
      })
      .eq("id", connRow.id)

    // Fetch accounts via TrueLayer Data API
    const accounts = await listAccounts(tokens.access_token)
    for (const acc of accounts) {
      const balance = await getBalance(
        tokens.access_token,
        acc.account_id
      ).catch(() => null)
      await supabase.from("bank_accounts").upsert(
        {
          user_id: user.id,
          connection_id: connRow.id,
          account_id: acc.account_id,
          iban: acc.account_number?.iban ?? null,
          bic: acc.account_number?.swift_bic ?? null,
          currency: acc.currency,
          owner_name: null,
          display_name:
            acc.display_name ?? acc.provider.display_name ?? acc.account_type,
          balance_cents: balance ? amountToCents(balance.current) : null,
          balance_at: new Date().toISOString().slice(0, 10),
        },
        { onConflict: "account_id" }
      )

      // Update bank_connections with provider details from first account
      if (acc.provider) {
        await supabase
          .from("bank_connections")
          .update({
            institution_id: acc.provider.provider_id,
            institution_name: acc.provider.display_name ?? null,
            institution_logo_url: acc.provider.logo_uri ?? null,
          })
          .eq("id", connRow.id)
      }
    }

    return NextResponse.redirect(
      new URL(`/de/banking?connected=${connRow.id}`, request.url)
    )
  } catch (e) {
    await supabase
      .from("bank_connections")
      .update({ status: "error" })
      .eq("id", connRow.id)
    return NextResponse.redirect(
      new URL(
        `/de/banking?error=${encodeURIComponent(
          e instanceof Error ? e.message : "unknown"
        )}`,
        request.url
      )
    )
  }
}
