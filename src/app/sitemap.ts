import type { MetadataRoute } from "next"

import { locales } from "@/i18n/locale"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://kolos.digital"
  const publicPaths = ["", "/impressum", "/datenschutz", "/agb", "/datenschutz/subprocessors"]

  const urls: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const path of publicPaths) {
      urls.push({
        url: `${base}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1.0 : 0.5,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${base}/${l}${path}`])
          ),
        },
      })
    }
  }

  return urls
}
