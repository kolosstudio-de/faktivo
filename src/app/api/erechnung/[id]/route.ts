import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { generateXRechnungCII } from "@/lib/erechnung/xrechnung"
import type {
  Client,
  Invoice,
  LineItem,
  Settings,
} from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const [invRes, linesRes, settingsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase
      .from("line_items")
      .select("*")
      .eq("parent_id", id)
      .eq("parent_kind", "invoice")
      .order("position"),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ])

  if (!invRes.data || !settingsRes.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  const invoice = invRes.data as Invoice
  const settings = settingsRes.data as Settings
  const lines = (linesRes.data ?? []) as LineItem[]

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single()

  if (!client) {
    return NextResponse.json({ error: "client missing" }, { status: 500 })
  }

  const xml = generateXRechnungCII({
    invoice,
    lines,
    client: client as Client,
    settings,
  })

  const filename = `XRechnung-${invoice.number ?? "Entwurf"}.xml`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-EN-16931-Profile":
        "urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0",
    },
  })
}
