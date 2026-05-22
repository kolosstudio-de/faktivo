import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Faktivo",
    short_name: "Faktivo",
    description:
      "Rechnungen · Bürgergeld-EKS · Banking · DSGVO-konform aus Frankfurt für Selbstständige in Deutschland.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#10b981",
    lang: "de",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Neue Rechnung",
        short_name: "Rechnung",
        description: "Neue Rechnung erstellen",
        url: "/de/invoices/new",
      },
      {
        name: "Banking",
        short_name: "Banking",
        description: "Bank-Transaktionen",
        url: "/de/banking",
      },
      {
        name: "Verträge & Abos",
        short_name: "Abos",
        description: "Wiederkehrende Verpflichtungen",
        url: "/de/finances/abos",
      },
    ],
  }
}
