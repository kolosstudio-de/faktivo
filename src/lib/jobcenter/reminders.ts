/**
 * Reminder-Engine: berechnet, welche Erinnerungen für eine User-Settings
 * fällig sind. Quelle der Wahrheit für Steuer- und Jobcenter-Termine.
 *
 * Wird vom Cron-Endpoint `/api/cron/reminders` und (optional) bei jedem
 * Settings-Save aufgerufen, um upcoming reminders in der DB zu materialisieren.
 *
 * Alle Berechnungen sind reine Funktionen — kein DB-Zugriff, kein Resend.
 * Persistierung passiert in der Route.
 */

import type { ReminderKind, Settings } from "@/types/database.types"

export interface DueReminder {
  kind: ReminderKind
  due_date: string // ISO YYYY-MM-DD
  payload: Record<string, unknown>
}

const ISO = (d: Date) => d.toISOString().slice(0, 10)

export interface PlanRemindersInput {
  settings: Settings
  now?: Date
  /** Welche Monate des BWZ wurden bereits eingereicht (last_eks_submitted_for_month). */
}

/**
 * Plant Erinnerungen ab `now` (default: heute) bis ~6 Monate in die Zukunft.
 *
 * Regeln:
 *   - eks_monthly:        wenn receives_buergergeld → am 5. jedes Monats für den
 *                          Vormonat (typische Praxis: Anfang neuen Monats EKS abgeben)
 *   - eks_endgueltig:     30 Tage vor BWZ-Ende, wenn BWZ gesetzt
 *   - steuererklaerung:   31.07. des Folgejahres (oder 28./29.02. wenn Steuerberater),
 *                          erst aktiv ab 01.06. des Folgejahres als Reminder.
 *   - ust_voranmeldung:   nur wenn !is_kleinunternehmer und vat_scheme = "monthly"|"quarterly"
 *                          → 10. des Folgemonats / -quartals
 *   - eu_zm:              25. des Folgemonats wenn EU B2B-Umsätze (skip wenn KU)
 */
export function planReminders({
  settings,
  now = new Date(),
}: PlanRemindersInput): DueReminder[] {
  const out: DueReminder[] = []

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const horizon = new Date(today)
  horizon.setUTCMonth(horizon.getUTCMonth() + 6)

  // ─── 1. EKS monatlich ────────────────────────────────────────────────────
  if (settings.receives_buergergeld) {
    // Reminder-Datum: 5. jedes Monats für den Vormonat
    const cursor = new Date(today)
    cursor.setUTCDate(5)
    if (cursor < today) cursor.setUTCMonth(cursor.getUTCMonth() + 1)

    while (cursor <= horizon) {
      const previousMonth = new Date(cursor)
      previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1, 1)
      const monthKey = ISO(previousMonth)

      // Skip if already submitted
      const lastSub = settings.last_eks_submitted_for_month
      if (!lastSub || monthKey > lastSub) {
        out.push({
          kind: "eks_monthly",
          due_date: ISO(cursor),
          payload: { for_month: monthKey },
        })
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }

  // ─── 2. EKS endgültig (Ende BWZ) ─────────────────────────────────────────
  if (settings.receives_buergergeld && settings.bewilligungszeitraum_end) {
    const bwzEnd = new Date(settings.bewilligungszeitraum_end + "T00:00:00Z")
    const reminder = new Date(bwzEnd)
    reminder.setUTCDate(reminder.getUTCDate() - 30)
    if (reminder >= today && reminder <= horizon) {
      out.push({
        kind: "eks_endgueltig",
        due_date: ISO(reminder),
        payload: { bwz_end: settings.bewilligungszeitraum_end },
      })
    }
  }

  // ─── 3. Einkommensteuererklärung ─────────────────────────────────────────
  // Reminder: 01.06. des Folgejahres (60 Tage vor 31.07. Frist)
  // Wenn Steuerberater: 28.02. ÜBERnächstes Jahr (z.B. 2026er Erklärung bis 28.02.2028)
  const lastTaxYear = today.getUTCFullYear() - 1
  if ((settings.last_steuererklaerung_for_year ?? 0) < lastTaxYear) {
    const hasBerater = Boolean(settings.steuerberater_name?.trim())
    const reminderYear = hasBerater ? lastTaxYear + 2 : lastTaxYear + 1
    const reminderDate = hasBerater
      ? new Date(Date.UTC(reminderYear, 0, 1)) // 01.01. des Berater-Jahres
      : new Date(Date.UTC(reminderYear, 5, 1)) // 01.06. des Pflichtjahres
    if (reminderDate >= today && reminderDate <= horizon) {
      out.push({
        kind: "steuererklaerung",
        due_date: ISO(reminderDate),
        payload: {
          for_year: lastTaxYear,
          deadline: hasBerater
            ? `${reminderYear}-02-28`
            : `${reminderYear}-07-31`,
          via_steuerberater: hasBerater,
        },
      })
    }
  }

  // ─── 4. USt-Voranmeldung ─────────────────────────────────────────────────
  if (!settings.is_kleinunternehmer) {
    const scheme = settings.vat_scheme as string | undefined
    if (scheme === "monthly" || scheme === "quarterly") {
      const cursor = new Date(today)
      cursor.setUTCDate(10) // 10. ist Voranmeldungs-Frist
      if (cursor < today) cursor.setUTCMonth(cursor.getUTCMonth() + 1)
      while (cursor <= horizon) {
        if (scheme === "monthly") {
          const prev = new Date(cursor)
          prev.setUTCMonth(prev.getUTCMonth() - 1, 1)
          out.push({
            kind: "ust_voranmeldung",
            due_date: ISO(cursor),
            payload: { for_month: ISO(prev), scheme: "monthly" },
          })
          cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        } else {
          // quarterly: 10.04, 10.07, 10.10, 10.01
          const m = cursor.getUTCMonth()
          const isQuarterEnd = m === 3 || m === 6 || m === 9 || m === 0
          if (isQuarterEnd) {
            out.push({
              kind: "ust_voranmeldung",
              due_date: ISO(cursor),
              payload: { scheme: "quarterly" },
            })
          }
          cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        }
      }
    }
  }

  return out
    .filter(
      (r, i, arr) =>
        arr.findIndex((x) => x.kind === r.kind && x.due_date === r.due_date) === i
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
}

/**
 * Subject + Body für die Email-Benachrichtigung. Wird von der Resend-Route
 * konsumiert.
 */
export function renderReminderEmail(
  reminder: DueReminder,
  recipientName: string
): { subject: string; html: string; text: string } {
  switch (reminder.kind) {
    case "eks_monthly": {
      const month = reminder.payload.for_month as string
      return {
        subject: `Anlage EKS für ${month.slice(0, 7)} fällig`,
        text: `Hallo ${recipientName},\n\nfür ${month.slice(0, 7)} ist deine monatliche Anlage EKS beim Jobcenter fällig. In Kolos Digital findest du den fertigen EKS-PDF unter Berichte → Jobcenter.\n\nMit freundlichen Grüßen\nKolos Digital`,
        html: `<p>Hallo ${recipientName},</p><p>für <strong>${month.slice(0, 7)}</strong> ist deine monatliche Anlage EKS beim Jobcenter fällig.</p><p>👉 <a href="https://kolos.digital/de/reports/jobcenter">Zur EKS-Übersicht</a></p>`,
      }
    }
    case "eks_endgueltig":
      return {
        subject: "Endgültige EKS-Erklärung — Bewilligungszeitraum endet bald",
        text: `Hallo ${recipientName},\n\nin 30 Tagen endet dein Bewilligungszeitraum (${reminder.payload.bwz_end}). Du musst die endgültige EKS einreichen — basierend auf Ist-Einkünften, nicht der Prognose.\n\nKolos Digital berechnet die Rückforderung automatisch.`,
        html: `<p>Hallo ${recipientName},</p><p>In <strong>30 Tagen</strong> endet dein Bewilligungszeitraum (<strong>${reminder.payload.bwz_end}</strong>). Reiche die endgültige EKS ein — Kolos berechnet die Rückforderung automatisch.</p>`,
      }
    case "steuererklaerung":
      return {
        subject: `Einkommensteuererklärung ${reminder.payload.for_year} bis ${reminder.payload.deadline}`,
        text: `Hallo ${recipientName},\n\ndeine Einkommensteuererklärung für ${reminder.payload.for_year} muss bis ${reminder.payload.deadline} beim Finanzamt sein. Nutze den DATEV-Export aus Kolos für deinen Steuerberater oder gib die Werte direkt in ELSTER ein.`,
        html: `<p>Hallo ${recipientName},</p><p>Deine <strong>Einkommensteuererklärung ${reminder.payload.for_year}</strong> ist bis <strong>${reminder.payload.deadline}</strong> fällig.</p>`,
      }
    case "ust_voranmeldung":
      return {
        subject: "USt-Voranmeldung am 10. fällig",
        text: `Hallo ${recipientName},\n\nam 10. ist deine Umsatzsteuer-Voranmeldung fällig. Übertrage die Werte aus Kolos in ELSTER.`,
        html: `<p>Hallo ${recipientName},</p><p>Am <strong>10. dieses Monats</strong> ist deine USt-Voranmeldung fällig.</p>`,
      }
    case "eu_zm":
      return {
        subject: "Zusammenfassende Meldung (EU B2B) am 25. fällig",
        text: `Hallo ${recipientName},\n\nfür EU-B2B-Umsätze ist die ZM bis zum 25. fällig.`,
        html: `<p>Hallo ${recipientName},</p><p>EU-B2B Zusammenfassende Meldung bis <strong>25.</strong> einreichen.</p>`,
      }
  }
}
