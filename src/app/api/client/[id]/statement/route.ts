import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import type { Client, Invoice, Payment } from "@/types/database.types"
import { clientDisplayName } from "@/lib/utils/client-display"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Customer statement (Kontoauszug) — CSV of all invoices + payments for a client.
 */
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

  const [clientRes, invRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("invoices")
      .select("*, payments(*)")
      .eq("client_id", id)
      .eq("user_id", user.id)
      .order("issue_date"),
  ])

  if (!clientRes.data) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const client = clientRes.data as Client
  const invoices = (invRes.data ?? []) as (Invoice & { payments?: Payment[] })[]

  // Build CSV (semicolon + UTF-8 BOM for Excel DE)
  const rows: string[] = [
    `Kontoauszug für ${clientDisplayName(client)}`,
    `Stand: ${new Date().toLocaleDateString("de-DE")}`,
    "",
    "Datum;Typ;Nummer;Beschreibung;Soll;Haben;Saldo",
  ]

  let saldo = 0
  const events: {
    date: string
    type: string
    num: string
    desc: string
    soll: number
    haben: number
  }[] = []

  for (const inv of invoices) {
    if (inv.status === "cancelled") continue
    events.push({
      date: inv.issue_date,
      type: "Rechnung",
      num: inv.number ?? "Entwurf",
      desc: inv.notes?.slice(0, 60) ?? "",
      soll: inv.total_cents,
      haben: 0,
    })
    for (const p of inv.payments ?? []) {
      events.push({
        date: p.paid_at,
        type: "Zahlung",
        num: p.reference ?? inv.number ?? "",
        desc: `${p.method}`,
        soll: 0,
        haben: p.amount_cents,
      })
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date))

  for (const e of events) {
    saldo += e.soll - e.haben
    rows.push(
      [
        e.date,
        e.type,
        `"${e.num}"`,
        `"${e.desc.replace(/"/g, '""')}"`,
        e.soll > 0 ? formatMoney(e.soll) : "",
        e.haben > 0 ? formatMoney(e.haben) : "",
        formatMoney(saldo),
      ].join(";")
    )
  }

  rows.push("")
  rows.push(`Saldo offen;;;;;;${formatMoney(saldo)}`)

  const csv = "\uFEFF" + rows.join("\r\n") + "\r\n"
  const filename = `Kontoauszug-${clientDisplayName(client).replace(/\s+/g, "-")}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
