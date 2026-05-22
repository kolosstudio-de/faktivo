import { NextResponse, type NextRequest } from "next/server"
import { renderToStream } from "@react-pdf/renderer"

import { createClient } from "@/lib/supabase/server"
import { MahnungPdf } from "@/lib/pdf/mahnung-pdf"
import type {
  Client,
  Invoice,
  Mahnung,
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

  const { data: mahnung } = await supabase
    .from("mahnungen")
    .select("*")
    .eq("id", id)
    .single()

  if (!mahnung) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const m = mahnung as Mahnung

  const [invRes, settingsRes] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", m.invoice_id).single(),
    supabase.from("settings").select("*").eq("user_id", user.id).single(),
  ])

  if (!invRes.data || !settingsRes.data) {
    return NextResponse.json({ error: "related docs missing" }, { status: 500 })
  }
  const invoice = invRes.data as Invoice
  const settings = settingsRes.data as Settings

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", invoice.client_id)
    .single()

  const stream = await renderToStream(
    MahnungPdf({
      mahnung: m,
      invoice,
      client: client as Client,
      settings,
    })
  )

  const chunks: Buffer[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
  }
  const buffer = Buffer.concat(chunks)

  const filename = `Mahnung-${m.stufe}-${invoice.number ?? "entwurf"}.pdf`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
