import { NextResponse, type NextRequest } from "next/server"

import { sendInvoiceEmail } from "@/lib/email/send-invoice"
import { validateOrigin } from "@/lib/api/csrf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const originError = validateOrigin(request)
  if (originError) return originError
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const customMessage = typeof body?.message === "string" ? body.message : undefined
  const bcc = typeof body?.bcc === "string" ? body.bcc : undefined

  const result = await sendInvoiceEmail(id, { customMessage, bcc })

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
