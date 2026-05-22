/**
 * Next.js Instrumentation hook.
 *
 * Wird einmal beim Start des Servers aufgerufen — wir nutzen ihn um Sentry
 * je nach Runtime (node vs edge) korrekt zu initialisieren. Doku:
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config")
  }
}

// Re-export Sentry's request-error hook so unhandled errors in route handlers
// and server components get captured.
export const onRequestError = Sentry.captureRequestError
