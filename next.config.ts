import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { withSentryConfig } from "@sentry/nextjs"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  poweredByHeader: false,
  typedRoutes: false,
  // Erlaubt Cloudflare-Tunnel-URLs als Origin für HMR/dev-Resources.
  // Ohne das blockiert Next.js den JS-Bundle → Buttons sehen aus,
  // aber Klick passiert nichts, weil React Hydration nicht läuft.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.kolos.digital",
    "*.faktivo.de",
  ],
}

// Sentry-Wrap nur wenn ORG+PROJECT gesetzt — sonst kein Source-Map-Upload,
// und der Build bleibt schnell im local Dev. DSN allein reicht für Runtime-
// Reporting; die Wrapper-Optionen unten kümmern sich um Source-Maps + Tunneling.
const SENTRY_ORG = process.env.SENTRY_ORG
const SENTRY_PROJECT = process.env.SENTRY_PROJECT

const baseConfig = withNextIntl(nextConfig)

export default SENTRY_ORG && SENTRY_PROJECT
  ? withSentryConfig(baseConfig, {
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      // Kein Stack-Trace-Upload während des Dev-Builds — spart 30+ sek.
      silent: !process.env.CI,
      widenClientFileUpload: true,
      // Browser-Adblocker blockieren oft `/sentry/`-Pfade; via `/monitoring`
      // tunneln wir die Reports durch unseren eigenen Origin.
      tunnelRoute: "/monitoring",
      disableLogger: true,
    })
  : baseConfig
