import { setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { ArrowLeft, RotateCcw } from "lucide-react"

import { BRAND } from "@/lib/legal/info"

export const metadata = { title: "Widerrufsbelehrung" }

export default async function WiderrufPage({
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
        <h1 className="text-3xl font-semibold tracking-tight">
          <RotateCcw className="text-primary mr-2 inline size-6" />
          Widerrufsbelehrung
        </h1>
        <p className="text-muted-foreground text-xs">
          Diese Belehrung gilt für Verträge, die ein Verbraucher (§ 13 BGB) im
          Wege des Fernabsatzes mit {BRAND.legal_name} schließt.
        </p>

        {/* Widerrufsrecht */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Widerrufsrecht</h2>
          <p>
            Sie haben das Recht, binnen <b>vierzehn Tagen</b> ohne Angabe von
            Gründen diesen Vertrag zu widerrufen.
          </p>
          <p className="text-muted-foreground">
            Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
            Vertragsschlusses.
          </p>
          <p className="text-muted-foreground">
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({BRAND.legal_name},{" "}
            {BRAND.owner}, {BRAND.street}, {BRAND.postal_code} {BRAND.city},
            E-Mail{" "}
            <a href={`mailto:${BRAND.email}`} className="text-primary underline">
              {BRAND.email}
            </a>
            ) mittels einer eindeutigen Erklärung (z. B. ein mit der Post
            versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag
            zu widerrufen, informieren. Sie können dafür das untenstehende
            Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben
            ist.
          </p>
          <p className="text-muted-foreground">
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
            Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
            Widerrufsfrist absenden.
          </p>
        </section>

        {/* Folgen */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Folgen des Widerrufs</h2>
          <p className="text-muted-foreground">
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen,
            die wir von Ihnen erhalten haben, einschließlich der
            Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus
            ergeben, dass Sie eine andere Art der Lieferung als die von uns
            angebotene, günstigste Standardlieferung gewählt haben), unverzüglich
            und spätestens binnen <b>vierzehn Tagen</b> ab dem Tag
            zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses
            Vertrags bei uns eingegangen ist.
          </p>
          <p className="text-muted-foreground">
            Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das
            Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei
            denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in
            keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte
            berechnet.
          </p>
        </section>

        {/* Vorzeitiges Erlöschen */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            Vorzeitiges Erlöschen des Widerrufsrechts (§ 356 Abs. 5 BGB)
          </h2>
          <p className="text-muted-foreground">
            Bei einem Vertrag über die Bereitstellung von <b>digitalen Inhalten</b>{" "}
            oder <b>digitalen Dienstleistungen</b> erlischt Ihr Widerrufsrecht
            vorzeitig, wenn:
          </p>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              Sie ausdrücklich zugestimmt haben, dass mit der Ausführung des
              Vertrags vor Ablauf der Widerrufsfrist begonnen wird, und
            </li>
            <li>
              Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre
              Zustimmung mit Beginn der Ausführung des Vertrags Ihr
              Widerrufsrecht verlieren.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Diese Zustimmung holen wir während des Bezahlvorgangs (Stripe
            Checkout) explizit per Checkbox ein und dokumentieren sie. Ohne
            Ihre Zustimmung beginnen wir die Ausführung erst nach Ablauf der
            14-Tage-Frist.
          </p>
        </section>

        {/* Muster-Widerrufsformular */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Muster-Widerrufsformular</h2>
          <p className="text-muted-foreground text-xs">
            Wenn Sie den Vertrag widerrufen wollen, können Sie dieses Formular
            ausfüllen und an uns senden:
          </p>
          <div className="bg-muted/40 grid gap-3 rounded-xl border p-4 text-xs">
            <p>
              An <b>{BRAND.legal_name}</b>
              <br />
              {BRAND.owner}
              <br />
              {BRAND.street}, {BRAND.postal_code} {BRAND.city}
              <br />
              E-Mail:{" "}
              <a
                href={`mailto:${BRAND.email}`}
                className="text-primary underline"
              >
                {BRAND.email}
              </a>
            </p>
            <p>
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*)
              abgeschlossenen Vertrag über die Erbringung der folgenden
              Dienstleistung (*):
            </p>
            <p className="text-muted-foreground">
              ___________________________________________________
            </p>
            <p>
              Bestellt am (*) / erhalten am (*):{" "}
              <span className="text-muted-foreground">_______________</span>
              <br />
              Name des/der Verbraucher(s):{" "}
              <span className="text-muted-foreground">_______________</span>
              <br />
              Anschrift des/der Verbraucher(s):{" "}
              <span className="text-muted-foreground">_______________</span>
              <br />
              Datum:{" "}
              <span className="text-muted-foreground">_______________</span>
              <br />
              Unterschrift (nur bei Mitteilung auf Papier):{" "}
              <span className="text-muted-foreground">_______________</span>
            </p>
            <p className="text-muted-foreground">
              (*) Unzutreffendes streichen.
            </p>
          </div>
        </section>

        {/* Widerrufs-Button (ab Juni 2026) */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            Widerruf per Knopfdruck (ab 19. Juni 2026)
          </h2>
          <p className="text-muted-foreground">
            Ab dem 19. Juni 2026 stellen wir gemäß § 356a BGB einen leicht
            zugänglichen <b>Widerrufs-Button</b> in den Kontoeinstellungen
            bereit. Mit einem Klick und einer Bestätigung können Sie ab diesem
            Zeitpunkt Ihren Vertrag rechtssicher widerrufen — alternativ zur
            E-Mail- oder Brief-Form.
          </p>
        </section>

        <p className="text-muted-foreground mt-8 text-xs">
          Stand: {new Date().toLocaleDateString("de-DE")} · Diese Belehrung
          entspricht dem Muster gemäß Anlage 1 zu Art. 246a § 1 Abs. 2 EGBGB.
        </p>
      </div>
    </div>
  )
}
