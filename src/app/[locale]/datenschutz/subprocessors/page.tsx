import { setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { ArrowLeft, Database, ExternalLink } from "lucide-react"

import { BRAND, SUBPROCESSORS } from "@/lib/legal/info"

export const metadata = { title: "Sub-Auftragsverarbeiter" }

export default async function SubprocessorsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="bg-background min-h-dvh px-6 py-10 md:py-16">
      <div className="mx-auto grid max-w-3xl gap-6 text-sm leading-relaxed">
        <Link
          href={`/${locale}/datenschutz`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3" /> Zurück zur Datenschutzerklärung
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          <Database className="text-primary mr-2 inline size-6" />
          Sub-Auftragsverarbeiter
        </h1>
        <p className="text-muted-foreground">
          Liste aller externen Dienste, die personenbezogene Daten im Rahmen
          der Nutzung von {BRAND.product_name} verarbeiten. Mit jedem Anbieter
          besteht ein Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO
          inkl. EU-Standardvertragsklauseln. Änderungen werden 30 Tage vor
          Inkrafttreten angekündigt — du kannst widersprechen, bevor sie
          wirksam werden.
        </p>

        <div className="grid gap-3">
          {SUBPROCESSORS.map((s) => (
            <div key={s.name} className="bg-card rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-1">
                  <h2 className="text-base font-semibold">{s.name}</h2>
                  <p className="text-muted-foreground text-xs">{s.purpose}</p>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                >
                  DPA / AVV
                  <ExternalLink className="size-3" />
                </a>
              </div>
              <dl className="text-muted-foreground mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-xs">
                <dt>Standort</dt>
                <dd>{s.location}</dd>
                <dt>AVV/DPA</dt>
                <dd>{s.dpa_basis}</dd>
              </dl>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-8 text-xs">
          Stand: {new Date().toLocaleDateString("de-DE")} · Kontakt für
          DSGVO-Anfragen:{" "}
          <a
            href={`mailto:${BRAND.email}`}
            className="text-primary underline"
          >
            {BRAND.email}
          </a>
        </p>
      </div>
    </div>
  )
}
