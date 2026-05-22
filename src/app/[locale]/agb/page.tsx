import { setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { BRAND } from "@/lib/legal/info"

export const metadata = { title: "Allgemeine Geschäftsbedingungen" }

export default async function AgbPage({
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
          Allgemeine Geschäftsbedingungen (AGB)
        </h1>
        <p className="text-muted-foreground text-xs">
          Stand: {new Date().toLocaleDateString("de-DE")} · Anbieter:{" "}
          {BRAND.legal_name} ({BRAND.owner}). Vor Live-Schaltung empfohlene
          Prüfung durch Fachanwalt für IT-Recht.
        </p>

        {/* § 1 */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 1 Geltungsbereich, Vertragsparteien</h2>
          <p className="text-muted-foreground">
            (1) Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge
            zwischen {BRAND.legal_name} ({BRAND.owner}, {BRAND.street},{" "}
            {BRAND.postal_code} {BRAND.city} — nachfolgend &bdquo;Anbieter&ldquo;) und dem
            Kunden über die Nutzung der Software-as-a-Service-Anwendung
            &bdquo;{BRAND.product_name}&ldquo; (nachfolgend &bdquo;Software&ldquo; oder &bdquo;Dienst&ldquo;).
          </p>
          <p className="text-muted-foreground">
            (2) Kunde im Sinne dieser AGB ist sowohl Verbraucher (§ 13 BGB) als
            auch Unternehmer (§ 14 BGB). Soweit Klauseln nur Verbraucher oder
            nur Unternehmer betreffen, ist dies ausdrücklich gekennzeichnet.
          </p>
          <p className="text-muted-foreground">
            (3) Abweichende AGB des Kunden werden nicht Vertragsbestandteil,
            auch wenn der Anbieter ihrer Geltung im Einzelfall nicht
            ausdrücklich widerspricht.
          </p>
        </section>

        {/* § 2 */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 2 Vertragsgegenstand</h2>
          <p className="text-muted-foreground">
            (1) Der Anbieter stellt die Software als browser- bzw.
            App-basierten Dienst zur Verfügung. Die Software unterstützt den
            Kunden bei der Erstellung von Angeboten, Rechnungen, der
            Belegerfassung sowie bei einfachen buchhalterischen Auswertungen.
          </p>
          <p className="text-muted-foreground">
            (2) Der konkrete Funktionsumfang ergibt sich aus der gebuchten
            Tarifstufe (Free, Pro, Business) gemäß Preisseite und
            Leistungsbeschreibung im Onboarding-Prozess.
          </p>
          <p className="text-muted-foreground">
            (3) <b>Keine Steuerberatung</b>: Die Software ersetzt weder eine
            Steuerberatung noch eine Buchhaltungsdienstleistung im Sinne des
            StBerG. Der Kunde ist für die Richtigkeit, Vollständigkeit und
            Rechtzeitigkeit seiner steuerlichen Erklärungen selbst
            verantwortlich.
          </p>
        </section>

        {/* § 3 */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">
            § 3 Vertragsschluss, Registrierung
          </h2>
          <p className="text-muted-foreground">
            (1) Der Vertrag kommt zustande durch (a) Registrierung mit E-Mail
            und Passwort und Bestätigung der E-Mail-Adresse, (b) Anmeldung über
            einen Drittanbieter-OAuth (Google, Apple), oder (c) Abschluss eines
            kostenpflichtigen Abonnements über Stripe.
          </p>
          <p className="text-muted-foreground">
            (2) Der Free-Tarif erfordert keine Zahlungsmittel. Pro- und
            Business-Tarife werden über Stripe abgerechnet — die Stripe-AGB
            gelten ergänzend.
          </p>
          <p className="text-muted-foreground">
            (3) Mit Abschluss des Vertrages bestätigt der Kunde, geschäftsfähig
            und mindestens 18 Jahre alt zu sein.
          </p>
        </section>

        {/* § 4 */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 4 Leistungserbringung, Verfügbarkeit</h2>
          <p className="text-muted-foreground">
            (1) Der Anbieter erbringt die Software-Leistungen mit angemessener
            Sorgfalt. Eine Verfügbarkeit von 99,5 % im Jahresmittel wird
            angestrebt; geplante Wartungsfenster werden vorab angekündigt.
          </p>
          <p className="text-muted-foreground">
            (2) Während der frühen Beta-Phase (&bdquo;Local-as-a-Server&ldquo;) können
            kürzere Ausfallzeiten auftreten. Der Anbieter weist transparent
            darauf hin, sofern eine konkrete Verfügbarkeitszusage (SLA) nicht
            besteht.
          </p>
          <p className="text-muted-foreground">
            (3) Höhere Gewalt (z. B. Internet-Ausfälle, Stromausfall,
            Cyberangriffe Dritter) befreit den Anbieter für die Dauer und im
            Umfang der Auswirkung von der Leistungspflicht.
          </p>
        </section>

        {/* § 5 */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 5 Vergütung, Zahlung, Preise</h2>
          <p className="text-muted-foreground">
            (1) Es gilt die jeweils auf der Preisseite ausgewiesene Preisliste.
            Die Preise verstehen sich als Endpreise gemäß § 1 Abs. 1 PAngV.
          </p>
          <p className="text-muted-foreground">
            (2) <b>Kleinunternehmer-Regelung:</b> Der Anbieter nutzt die
            Regelung nach § 19 UStG. Auf den Rechnungen wird daher{" "}
            <b>keine Umsatzsteuer ausgewiesen</b>; ein
            Vorsteuerabzug auf Seiten des Kunden ist insoweit nicht möglich.
            Sollte der Anbieter künftig zur Regelbesteuerung übergehen, werden
            Bestandskunden mindestens 30 Tage vorher informiert.
          </p>
          <p className="text-muted-foreground">
            (3) Die Vergütung wird im Voraus für den jeweiligen
            Abrechnungszeitraum (monatlich oder jährlich) per Stripe
            (SEPA-Lastschrift, Kreditkarte, ggf. Apple Pay/Google Pay) erhoben.
          </p>
          <p className="text-muted-foreground">
            (4) Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang nach
            Mahnung mit angemessener Frist auszusetzen, bis die Zahlung
            geleistet wurde. Aufbewahrungspflichtige Daten bleiben für den
            Kunden während dieser Zeit lesbar zugänglich (Read-Only-Modus).
          </p>
        </section>

        {/* § 6 */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 6 Laufzeit, Kündigung</h2>
          <p className="text-muted-foreground">
            (1) Bei monatlicher Zahlung verlängert sich der Vertrag automatisch
            um jeweils einen weiteren Monat, sofern er nicht spätestens zum
            Monatsende gekündigt wird (Art. 246a § 1 Abs. 2 EGBGB).
          </p>
          <p className="text-muted-foreground">
            (2) Bei jährlicher Zahlung kann der Vertrag jederzeit zum Ende des
            laufenden Abrechnungszeitraums gekündigt werden.
          </p>
          <p className="text-muted-foreground">
            (3) Die Kündigung ist über die Kündigungs-Schaltfläche in den
            Kontoeinstellungen (§ 312k BGB) sowie per E-Mail an{" "}
            <a href={`mailto:${BRAND.email}`} className="text-primary underline">
              {BRAND.email}
            </a>{" "}
            möglich.
          </p>
          <p className="text-muted-foreground">
            (4) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund
            bleibt unberührt.
          </p>
        </section>

        {/* § 7 Widerrufsrecht für Verbraucher */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">
            § 7 Widerrufsrecht für Verbraucher
          </h2>
          <p className="text-muted-foreground">
            (1) Verbrauchern (§ 13 BGB) steht ein 14-tägiges Widerrufsrecht zu.
            Die vollständige Widerrufsbelehrung sowie das Muster-Widerrufsformular
            findest du unter{" "}
            <Link href={`/${locale}/widerruf`} className="text-primary underline">
              /widerruf
            </Link>
            .
          </p>
          <p className="text-muted-foreground">
            (2) Bei digitalen Diensten erlischt das Widerrufsrecht vorzeitig,
            wenn der Verbraucher (i) ausdrücklich zugestimmt hat, dass mit der
            Ausführung vor Ablauf der Widerrufsfrist begonnen wird, und (ii)
            seine Kenntnis bestätigt, dass er durch diese Zustimmung sein
            Widerrufsrecht verliert (§ 356 Abs. 5 BGB).
          </p>
          <p className="text-muted-foreground">
            (3) Ab dem 19. Juni 2026 stellt der Anbieter zusätzlich einen
            Widerrufs-Button gemäß § 356a BGB zur Verfügung, sobald die
            Vorgaben des Umsetzungsgesetzes verbindlich werden.
          </p>
        </section>

        {/* § 8 Pflichten Kunde */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 8 Pflichten des Kunden</h2>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              Geheimhaltung der Anmeldedaten und unverzügliche Mitteilung bei
              Verdacht auf Missbrauch.
            </li>
            <li>
              Wahrheitsgemäße und aktuelle Stammdaten (insb. für
              Rechnungserstellung gem. § 14 UStG).
            </li>
            <li>
              Keine Verwendung der Software für rechtswidrige Zwecke (z. B.
              Geldwäsche, Steuerhinterziehung).
            </li>
            <li>
              Eigenverantwortliche Sicherung relevanter Geschäftsdaten — der
              Anbieter führt Backups, ersetzt aber keine eigenen Sicherungen.
            </li>
          </ul>
        </section>

        {/* § 9 Haftung */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 9 Haftung</h2>
          <p className="text-muted-foreground">
            (1) Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung
            des Lebens, des Körpers oder der Gesundheit, sofern sie auf einer
            vorsätzlichen oder fahrlässigen Pflichtverletzung beruhen.
          </p>
          <p className="text-muted-foreground">
            (2) Im Übrigen haftet der Anbieter nur bei Vorsatz und grober
            Fahrlässigkeit. Bei einfacher Fahrlässigkeit haftet er nur bei
            Verletzung wesentlicher Vertragspflichten (Kardinalpflichten); die
            Haftung ist in diesem Fall auf den vertragstypischen, vorhersehbaren
            Schaden begrenzt.
          </p>
          <p className="text-muted-foreground">
            (3) Eine Haftung nach dem Produkthaftungsgesetz und für arglistig
            verschwiegene Mängel bleibt unberührt.
          </p>
          <p className="text-muted-foreground">
            (4) Eine Haftung für steuerliche Folgen (z. B. fehlerhafte
            Buchungen, falsche USt-Voranmeldungen) ist ausgeschlossen — die
            Software stellt lediglich Werkzeuge bereit; die Verantwortung für
            steuerliche Sorgfalt verbleibt beim Kunden bzw. dessen
            Steuerberater:in.
          </p>
        </section>

        {/* § 10 Datenschutz */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 10 Datenschutz, GoBD</h2>
          <p className="text-muted-foreground">
            Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
            <Link
              href={`/${locale}/datenschutz`}
              className="text-primary underline"
            >
              Datenschutzerklärung
            </Link>
            . Soweit der Kunde im Sinne der DSGVO &bdquo;Verantwortlicher&ldquo; ist und
            wir personenbezogene Daten in seinem Auftrag verarbeiten,
            schließen wir auf Anfrage einen Auftragsverarbeitungsvertrag (AVV)
            gemäß Art. 28 DSGVO ab. Die Software ist auf GoBD-konforme Prozesse
            ausgelegt (Unveränderbarkeit finalisierter Rechnungen,
            Aufbewahrungsfristen, Verfahrensdokumentation in Vorbereitung).
          </p>
        </section>

        {/* § 11 Änderungen */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 11 Änderungen der AGB</h2>
          <p className="text-muted-foreground">
            (1) Der Anbieter kann diese AGB ändern, soweit dies aus Gründen der
            Rechtsentwicklung, technischer Anpassungen oder zur Schließung
            künftig auftretender Regelungslücken erforderlich ist.
          </p>
          <p className="text-muted-foreground">
            (2) Änderungen werden dem Kunden mindestens 30 Tage vor
            Inkrafttreten per E-Mail mitgeteilt. Widerspricht der Kunde nicht
            innerhalb von 30 Tagen ab Zugang, gelten die Änderungen als
            akzeptiert; auf diese Folge wird in der Mitteilung gesondert
            hingewiesen. Im Widerspruchsfall steht beiden Parteien ein
            Sonderkündigungsrecht zum Inkrafttreten der neuen AGB zu.
          </p>
        </section>

        {/* § 12 Schlussbestimmungen */}
        <section className="grid gap-2">
          <h2 className="text-base font-semibold">§ 12 Schlussbestimmungen</h2>
          <p className="text-muted-foreground">
            (1) Es gilt das Recht der Bundesrepublik Deutschland unter
            Ausschluss des UN-Kaufrechts. Verbraucherschutzrechtliche zwingende
            Bestimmungen des Wohnsitzstaates des Verbrauchers bleiben unberührt
            (Art. 6 Abs. 2 Rom-I-VO).
          </p>
          <p className="text-muted-foreground">
            (2) Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist —
            soweit der Kunde Kaufmann, juristische Person des öffentlichen
            Rechts oder öffentlich-rechtliches Sondervermögen ist — der Sitz
            des Anbieters. Bei Verbrauchern gelten die gesetzlichen
            Gerichtsstände.
          </p>
          <p className="text-muted-foreground">
            (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt
            die Wirksamkeit der übrigen Bestimmungen unberührt. Anstelle der
            unwirksamen Bestimmung gilt die gesetzliche Regelung.
          </p>
        </section>
      </div>
    </div>
  )
}
