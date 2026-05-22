import { NextResponse } from "next/server"
import JSZip from "jszip"
import { createHash } from "node:crypto"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GoBD / Z3 Datenträgerüberlassung Export.
 * §147 Abs. 6 AO — structured ZIP for Finanzamt Betriebsprüfung.
 *
 * Contains:
 *   - index.xml  (IDEA-style descriptor, gdpdu-01-09-2004 schema)
 *   - gdpdu-01-09-2004.dtd  (DTD reference)
 *   - one CSV per table (semicolon-separated, UTF-8, header row first)
 *   - manifest.json with SHA-256 hashes for audit-chain verification
 */

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const tables = [
    "invoices",
    "line_items",
    "payments",
    "clients",
    "expense_entries",
    "income_entries",
    "mahnungen",
    "document_archive",
    "audit_log",
  ]

  const zip = new JSZip()
  const hashes: Record<string, string> = {}
  const rowCounts: Record<string, number> = {}

  for (const table of tables) {
    const { data } = await supabase.from(table).select("*").eq("user_id", user.id)
    const rows = (data ?? []) as Record<string, unknown>[]
    rowCounts[table] = rows.length

    if (rows.length === 0) {
      zip.file(`${table}.csv`, "")
      continue
    }

    const headers = Object.keys(rows[0])
    const csvLines = [
      headers.map((h) => `"${h}"`).join(";"),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const v = row[h]
            if (v == null) return '""'
            if (typeof v === "object")
              return `"${JSON.stringify(v).replace(/"/g, '""')}"`
            return `"${String(v).replace(/"/g, '""')}"`
          })
          .join(";")
      ),
    ]
    const csv = csvLines.join("\r\n") + "\r\n"
    zip.file(`${table}.csv`, csv)
    hashes[`${table}.csv`] = createHash("sha256").update(csv).digest("hex")
  }

  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">
<DataSet>
  <Version>1.0</Version>
  <DataSupplier>
    <Name>${escapeXml(user.email ?? "Kolos Digital Finanzen user")}</Name>
    <Location>Germany</Location>
    <Comment>Auto-generated GoBD Z3 export from Kolos Digital Finanzen</Comment>
  </DataSupplier>
  <Media>
    <Name>DigitalData</Name>
${tables
  .map(
    (t) => `    <Table name="${t}">
      <URL>${t}.csv</URL>
      <Separator>;</Separator>
      <Delimiter>"</Delimiter>
      <DecimalSymbol>.</DecimalSymbol>
      <DigitGroupingSymbol>,</DigitGroupingSymbol>
      <Range><From>2</From></Range>
      <Description>${rowCounts[t]} rows</Description>
    </Table>`
  )
  .join("\n")}
  </Media>
</DataSet>`

  zip.file("index.xml", indexXml)
  zip.file(
    "gdpdu-01-09-2004.dtd",
    "<!-- Official DTD: https://www.bundesfinanzministerium.de/ (§147 AO). Placeholder; Finanzamt IDEA tool validates automatically. -->\n"
  )

  const manifest = {
    generated_at: new Date().toISOString(),
    user_id: user.id,
    format: "GoBD Z3 / IDEA",
    reference: "§147 Abs. 6 AO, GoBD 28.11.2019",
    rowCounts,
    hashes,
  }
  zip.file("manifest.json", JSON.stringify(manifest, null, 2))

  const buffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  })

  const filename = `GoBD-Z3-${new Date().toISOString().slice(0, 10)}.zip`

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
