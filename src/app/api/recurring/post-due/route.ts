/**
 * POST /api/recurring/post-due
 *
 * Erstellt expense_entries für alle fälligen Recurrings (next_due_date ≤ today).
 * Nach Erstellung: advance next_due_date.
 *
 * Cron-mode (X-Cron-Secret) → für ALLE User.
 * User-mode → nur für eingeloggten User.
 */

import { NextResponse, type NextRequest } from "next/server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { advanceNextDue, isDue } from "@/lib/recurring"
import type { RecurringExpense } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

interface Summary {
  recurrings_processed: number
  expense_entries_created: number
  errors: { id: string; error: string }[]
}

type Db =
  | ReturnType<typeof createServiceClient>
  | Awaited<ReturnType<typeof createClient>>

async function processForUser(
  supabase: Db,
  userId: string,
  today: string,
  summary: Summary
) {
  const { data: dueRecurrings } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .lte("next_due_date", today)

  for (const r of (dueRecurrings ?? []) as RecurringExpense[]) {
    if (!isDue(r, today)) continue

    summary.recurrings_processed++

    try {
      // Idempotency: check if already posted for this date
      const { data: alreadyPosted } = await supabase
        .from("recurring_postings")
        .select("id")
        .eq("recurring_id", r.id)
        .eq("posted_for_date", r.next_due_date)
        .maybeSingle()

      if (alreadyPosted) {
        // Just advance schedule
        await supabase
          .from("recurring_expenses")
          .update({
            next_due_date: advanceNextDue(r.next_due_date, r.frequency),
            last_posted_date: r.next_due_date,
          })
          .eq("id", r.id)
        continue
      }

      // Create expense_entry
      const { data: exp, error: expErr } = await supabase
        .from("expense_entries")
        .insert({
          user_id: userId,
          scope: r.scope,
          occurred_on: r.next_due_date,
          amount_cents: r.amount_cents,
          currency: "EUR",
          category_id: r.category_id,
          vendor: r.vendor,
          description: `${r.name} (auto · ${r.frequency})`,
          payment_method: r.payment_method,
          vat_rate: r.vat_rate,
          is_deductible: r.scope === "business",
          recurring_source_id: r.id,
        })
        .select("id")
        .single()

      if (expErr || !exp) {
        summary.errors.push({ id: r.id, error: expErr?.message ?? "insert failed" })
        continue
      }

      // Track in recurring_postings
      await supabase.from("recurring_postings").insert({
        user_id: userId,
        recurring_id: r.id,
        expense_entry_id: exp.id,
        posted_for_date: r.next_due_date,
        amount_cents: r.amount_cents,
      })

      // Advance schedule
      const nextDue = advanceNextDue(r.next_due_date, r.frequency)
      const remainingPayments =
        r.remaining_payments != null ? Math.max(0, r.remaining_payments - 1) : null
      const remainingAmount =
        r.remaining_amount_cents != null
          ? Math.max(0, r.remaining_amount_cents - r.amount_cents)
          : null

      await supabase
        .from("recurring_expenses")
        .update({
          next_due_date: nextDue,
          last_posted_date: r.next_due_date,
          remaining_payments: remainingPayments,
          remaining_amount_cents: remainingAmount,
          // Auto-deactivate when loan is fully paid
          active:
            remainingPayments === 0 || (remainingAmount !== null && remainingAmount <= 0)
              ? false
              : true,
        })
        .eq("id", r.id)

      summary.expense_entries_created++
    } catch (e) {
      summary.errors.push({
        id: r.id,
        error: e instanceof Error ? e.message : "unknown",
      })
    }
  }
}

export async function POST(request: NextRequest) {
  const summary: Summary = {
    recurrings_processed: 0,
    expense_entries_created: 0,
    errors: [],
  }
  const today = new Date().toISOString().slice(0, 10)

  const cronSecret = process.env.CRON_SECRET
  const provided = request.headers.get("x-cron-secret")
  if (cronSecret && provided === cronSecret) {
    const supabase = createServiceClient()
    const { data: users } = await supabase
      .from("recurring_expenses")
      .select("user_id")
      .eq("active", true)
      .lte("next_due_date", today)
    const uniqueUsers = [...new Set((users ?? []).map((u) => u.user_id))]
    for (const uid of uniqueUsers) {
      await processForUser(supabase, uid, today, summary)
    }
    return NextResponse.json(summary)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  await processForUser(supabase, user.id, today, summary)
  return NextResponse.json(summary)
}
