import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"

import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider, themeInitScript } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext", "cyrillic"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Instrument Serif: italic display font with high character — used for hero
// keywords ("Rechnungen, EÜR und Anlage EKS — auf Deutsch") to inject editorial
// gravity into the otherwise grotesque-only Geist hierarchy. One weight, italic
// only — keeps payload small, signals "editorial" rather than "another tech-co".
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["italic", "normal"],
})

export const metadata: Metadata = {
  title: {
    template: "%s · Faktivo",
    default: "Faktivo — Buchhaltung & Rechnungen für Selbstständige",
  },
  description:
    "Rechnungen, Belege, Bürgergeld-EKS und Banking — DSGVO- & GoBD-konform aus Deutschland. Auf Deutsch, Englisch, Русский, Українською.",
  robots: { index: false, follow: false },
  applicationName: "Faktivo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Faktivo",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        {/* Setzt class="dark" vor Hydration — verhindert White-Flash bei
            geladener dunkler Theme. Inline, weil React nicht früh genug
            läuft. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} bg-background text-foreground min-h-dvh antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider delay={150}>
              {children}
              {/*
                top-right überlappt auf < 768 px die Burger-Navigation und
                den Account-Avatar. top-center bleibt mobil sichtbar und
                kollidiert nicht mit der Status-Bar (iOS Safe-Area).
              */}
              <Toaster
                position="top-center"
                richColors
                closeButton
                mobileOffset={{ top: "1rem" }}
              />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
