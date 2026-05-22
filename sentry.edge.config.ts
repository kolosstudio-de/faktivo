/**
 * Sentry — Edge-Runtime (proxy.ts / Vercel Edge functions).
 *
 * Kleinerer Init-Footprint als der Server-Config — Edge hat keinen vollen
 * Node-Stack. Wird via `instrumentation.ts` geladen.
 */

import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  })
}
