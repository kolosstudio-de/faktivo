/**
 * Cron-Endpoint: täglich aufgerufen von Vercel Cron / GitHub Actions / external.
 *
 * 1. Geht durch alle Users mit `receives_buergergeld=true` ODER `vat_scheme!=annual`.
 * 2. Plant Reminders mit `planReminders()`.
 * 3. Materialisiert NEU geplante Reminders in der `reminders`-Tabelle (idempotent).
 * 4. Wenn `due_date <= today + 1 day`: schickt Email via Resend (falls Key gesetzt),
 *    markiert `sent_at`. Ohne Key — dry-run, nur logged.
 *
 * Auth: Header `X-Cron-Secret` muss `process.env.CRON_SECRET` matchen.
 *       Lokal: ohne Header → ok (dev mode).
 */

import { NextResponse, type NextRequest } from "next/server"
import { Resend } from "resend"

import { createServiceClient } from "@/lib/supabase/server"
import {
  planReminders,
  renderReminderEmail,
} from "@/lib/jobcenter/reminders"
import type { Settings } from "@/types/database.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RunSummary {
  scanned_users: number
  planned: number
  inserted: number
  emails_sent: number
  emails_skipped_dry_run: number
  errors: { user_id: string; error: string }[]
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get("x-cron-secret")
  const isDev = process.env.NODE_ENV !== "production"
  if (secret && provided !== secret && !isDev) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const summary: RunSummary = {
    scanned_users: 0,
    planned: 0,
    inserted: 0,
    emails_sent: 0,
    emails_skipped_dry_run: 0,
    errors: [],
  }

  // Service client umgeht RLS — wir brauchen Multi-User-Zugriff im Cron.
  const supabase = createServiceClient()

  const { data: usersData, error: usersErr } = await supabase
    .from("settings")
    .select("*")
    .or("receives_buergergeld.eq.true,vat_scheme.neq.annual")

  if (usersErr) {
    return NextResponse.json({ error: usersErr.message }, { status: 500 })
  }

  summary.scanned_users = usersData?.length ?? 0

  const today = new Date()
  const todayPlus1 = new Date(today)
  todayPlus1.setUTCDate(todayPlus1.getUTCDate() + 1)
  const todayISO = today.toISOString().slice(0, 10)
  const todayPlus1ISO = todayPlus1.toISOString().slice(0, 10)

  const resendKey = process.env.RESEND_API_KEY
  const fromAddr = process.env.EMAIL_FROM ?? "Kolos Digital <noreply@kolos.digital>"
  const resend = resendKey ? new Resend(resendKey) : null

  for (const settings of (usersData ?? []) as Settings[]) {
    try {
      const planned = planReminders({ settings, now: today })
      summary.planned += planned.length

      // Idempotent Insert: skip wenn (user, kind, due_date) bereits existiert
      const { data: existing } = await supabase
        .from("reminders")
        .select("kind, due_date")
        .eq("user_id", settings.user_id)
        .gte("due_date", todayISO)
      const existingKey = new Set(
        (existing ?? []).map((r) => `${r.kind}|${r.due_date}`)
      )

      const inserts = planned
        .filter((p) => !existingKey.has(`${p.kind}|${p.due_date}`))
        .map((p) => ({
          user_id: settings.user_id,
          kind: p.kind,
          due_date: p.due_date,
          payload_jsonb: p.payload,
        }))
      if (inserts.length > 0) {
        const { error: insErr } = await supabase
          .from("reminders")
          .insert(inserts)
        if (insErr) throw insErr
        summary.inserted += inserts.length
      }

      // Send due reminders (today + tomorrow)
      const { data: dueList } = await supabase
        .from("reminders")
        .select("id, kind, due_date, payload_jsonb")
        .eq("user_id", settings.user_id)
        .lte("due_date", todayPlus1ISO)
        .is("sent_at", null)
        .is("dismissed_at", null)

      if (dueList && dueList.length > 0) {
        // Lookup user email via auth admin
        const { data: userRes } = await supabase.auth.admin.getUserById(
          settings.user_id
        )
        const email = userRes?.user?.email
        const recipientName =
          [settings.first_name, settings.last_name].filter(Boolean).join(" ") ||
          settings.company_name ||
          "Selbständige:r"

        for (const r of dueList) {
          if (!email || !resend) {
            summary.emails_skipped_dry_run++
            console.log("[cron/reminders DRY RUN]", {
              user_id: settings.user_id,
              kind: r.kind,
              due_date: r.due_date,
            })
            continue
          }
          const tpl = renderReminderEmail(
            {
              kind: r.kind,
              due_date: r.due_date,
              payload: r.payload_jsonb as Record<string, unknown>,
            },
            recipientName
          )
          const sendRes = await resend.emails.send({
            from: fromAddr,
            to: email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          })
          if (!sendRes.error) {
            await supabase
              .from("reminders")
              .update({ sent_at: new Date().toISOString() })
              .eq("id", r.id)
            summary.emails_sent++
          }
        }
      }
    } catch (e) {
      summary.errors.push({
        user_id: settings.user_id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return NextResponse.json(summary)
}
