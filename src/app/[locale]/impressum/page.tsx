import { setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { BRAND } from "@/lib/legal/info"

export const metadata = { title: "Impressum" }

export default async function ImpressumPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="bg-background min-h-dvh px-6 py-10 md:py-16">
      <div className="mx-auto grid max-w-2xl gap-6 text-sm leading-relaxed">
        <Link
          href={`/${locale}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3" /> Zurück
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Impressum</h1>
        <p className="text-muted-foreground text-xs">
          Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz, ehem. § 5 TMG)
        </p>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">Anbieter</h2>
          <p>
            <b>{BRAND.legal_name}</b>
            <br />
            Inhaber: {BRAND.owner}
            <br />
            {BRAND.street}
            <br />
            {BRAND.postal_code} {BRAND.city}
            <br />
            {BRAND.country}
          </p>
          <p className="text-muted-foreground text-xs">
            Rechtsform: {BRAND.legal_form}. Nicht im Handelsregister
            eingetragen — keine Eintragungspflicht, da kein Kaufmann i. S. d. HGB.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">Kontakt</h2>
          <p>
            E-Mail:{" "}
            <a href={`mailto:${BRAND.email}`} className="text-primary underline">
              {BRAND.email}
            </a>
            <br />
            Telefon: {BRAND.phone}
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">
            Umsatzsteuer (§ 19 UStG)
          </h2>
          <p className="text-muted-foreground">
            {BRAND.vat_id}. {BRAND.small_business_hint}
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">
            Wirtschafts-Identifikationsnummer (§ 139c AO)
          </h2>
          <p className="text-muted-foreground">{BRAND.business_id}</p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">
            Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
          </h2>
          <p>
            {BRAND.owner}, Anschrift wie oben.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">
            Verbraucherstreitbeilegung / Universalschlichtungsstelle (§ 36 VSBG)
          </h2>
          <p className="text-muted-foreground">
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">EU-Streitschlichtung (Art. 14 ODR-VO)</h2>
          <p className="text-muted-foreground">
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              ec.europa.eu/consumers/odr
            </a>
            . Unsere E-Mail-Adresse findest du oben im Impressum.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">Haftung für Inhalte</h2>
          <p className="text-muted-foreground">
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte
            auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
            §§ 8–10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
            übermittelte oder gespeicherte fremde Informationen zu überwachen
            oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
            hinweisen.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">Haftung für Links</h2>
          <p className="text-muted-foreground">
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren
            Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
            fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
            verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
            der Seiten verantwortlich.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-semibold">Urheberrecht</h2>
          <p className="text-muted-foreground">
            Die durch den Seitenbetreiber erstellten Inhalte und Werke auf
            diesen Seiten unterliegen dem deutschen Urheberrecht. Die
            Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
            Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der
            schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
          </p>
        </section>

        <p className="text-muted-foreground mt-8 text-xs">
          Stand: {new Date().toLocaleDateString("de-DE")}
        </p>
      </div>
    </div>
  )
}
