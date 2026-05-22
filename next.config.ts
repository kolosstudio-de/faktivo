import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

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

export default withNextIntl(nextConfig)
