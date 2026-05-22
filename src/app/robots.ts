import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://kolos.digital"

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/de", "/en", "/ru", "/de/impressum", "/de/datenschutz", "/de/agb"],
        disallow: [
          "/api/",
          "/auth/",
          "/*/dashboard",
          "/*/invoices",
          "/*/quotes",
          "/*/clients",
          "/*/settings",
          "/*/admin",
          "/*/billing",
          "/*/finances",
          "/*/reports",
          "/*/onboarding",
          "/*/login",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
