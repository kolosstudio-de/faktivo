/**
 * Sentry — Client-Side (Browser).
 *
 * Next.js lädt diese Datei automatisch im Browser-Bundle, sobald sie als
 * `src/instrumentation-client.ts` existiert. Ohne `NEXT_PUBLIC_SENTRY_DSN`
 * ist init ein No-Op.
 */

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay nur in Prod — sonst zieht es jeden Klick im Dev mit.
    replaysSessionSampleRate:
      process.env.NODE_ENV === "production" ? 0.05 : 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        // Buchhaltungsdaten sollen NICHT in Replay landen — wir maskieren
        // alle Text-Eingaben und Eingabewerte.
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    sendDefaultPii: false,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  })
}

// Required by Next.js when client instrumentation is enabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
