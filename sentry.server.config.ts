/**
 * Sentry — Server-Side (Node-runtime route handlers, server components).
 *
 * Init wird via `instrumentation.ts`'s `register()`-Hook geladen, sobald
 * Next die Node-Runtime hochfährt. Ohne NEXT_PUBLIC_SENTRY_DSN ist init
 * ein No-Op — kein Error, kein Traffic, ideal für lokales Dev.
 */

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // PII vermeiden — wir verarbeiten Buchhaltungsdaten unter DSGVO/GoBD.
    // Sentry darf keine Body-Inhalte / Headers mit Cookies/Tokens sehen.
    sendDefaultPii: false,
    integrations: [
      // OS-Info, http-Spans etc. kommen automatisch
    ],
    beforeSend(event) {
      // Stripe-Signaturen, JWS, OAuth-Tokens niemals in Reports leaken
      if (event.request?.headers) {
        for (const k of Object.keys(event.request.headers)) {
          if (
            /^(authorization|cookie|x-tl-signature|tl-signature|stripe-signature|x-cron-secret)$/i.test(
              k,
            )
          ) {
            event.request.headers[k] = "[Filtered]"
          }
        }
      }
      return event
    },
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  })
}
