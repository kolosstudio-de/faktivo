/**
 * GET  /api/recurring        — list user's recurring expenses
 * POST /api/recurring        — create new
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { advanceNextDue } from "@/lib/recurring"
import type { RecurringExpense } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("active", { ascending: false })
    .order("next_due_date", { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ recurrings: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const body = (await request.json()) as Partial<RecurringExpense>

  if (!body.name || !body.amount_cents || !body.frequency) {
    return NextResponse.json(
      { error: "name, amount_cents, frequency required" },
      { status: 400 }
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const startDate = body.start_date ?? today
  const nextDue = body.next_due_date ?? startDate

  const { data, error } = await supabase
    .from("recurring_expenses")
    .insert({
      user_id: user.id,
      scope: body.scope ?? "private",
      kind: body.kind ?? "subscription",
      name: body.name,
      vendor: body.vendor ?? null,
      category_id: body.category_id ?? null,
      frequency: body.frequency,
      amount_cents: body.amount_cents,
      vat_rate: body.vat_rate ?? 19,
      payment_method: body.payment_method ?? null,
      start_date: startDate,
      end_date: body.end_date ?? null,
      next_due_date: nextDue,
      remaining_payments: body.remaining_payments ?? null,
      total_amount_cents: body.total_amount_cents ?? null,
      remaining_amount_cents: body.remaining_amount_cents ?? null,
      auto_detected: body.auto_detected ?? false,
      auto_detection_confidence: body.auto_detection_confidence ?? null,
      active: body.active ?? true,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Touch advanceNextDue to ensure import is used (no-op runtime)
  void advanceNextDue
  return NextResponse.json({ recurring: data })
}
