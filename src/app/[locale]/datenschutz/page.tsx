import { setRequestLocale } from "next-intl/server"
import Link from "next/link"
import { ArrowLeft, Shield } from "lucide-react"

import { BRAND, ENCRYPTION, HOSTING } from "@/lib/legal/info"

export const metadata = { title: "Datenschutzerklärung" }

export default async function DatenschutzPage({
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
          <Shield className="text-primary mr-2 inline size-6" />
          Datenschutzerklärung
        </h1>
        <p className="text-muted-foreground text-xs">
          Informationen gemäß Art. 13 / 14 DSGVO &amp; § 25 TDDDG. Verständlich
          formuliert, ohne Juristendeutsch — wie es Art. 12 DSGVO verlangt.
        </p>

        {/* 1. Verantwortlicher */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)</h2>
          <p>
            {BRAND.legal_name} — {BRAND.legal_form}
            <br />
            {BRAND.owner}
            <br />
            {BRAND.street}, {BRAND.postal_code} {BRAND.city}, {BRAND.country}
            <br />
            E-Mail:{" "}
            <a href={`mailto:${BRAND.email}`} className="text-primary underline">
              {BRAND.email}
            </a>
          </p>
          <p className="text-muted-foreground text-xs">
            Datenschutzbeauftragte:r: {BRAND.dpo_name}. Anfragen direkt an die
            o. g. E-Mail.
          </p>
        </section>

        {/* 2. Hosting */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">2. Hosting & Betrieb</h2>
          <p>
            Aktuelle Betriebsphase: <b>{HOSTING.current_phase}</b>. Region:{" "}
            <b>{HOSTING.region}</b>.
          </p>
          <p className="text-muted-foreground">
            Eine vollständige Liste der eingesetzten Sub-Auftragsverarbeiter
            (Supabase, Vercel, Cloudflare, Resend, Stripe, Anthropic, Google,
            Apple) findest du auf der Seite{" "}
            <Link
              href={`/${locale}/datenschutz/subprocessors`}
              className="text-primary underline"
            >
              Sub-Auftragsverarbeiter
            </Link>
            . Mit jedem dieser Anbieter besteht ein Auftragsverarbeitungsvertrag
            (AVV) gemäß Art. 28 DSGVO inkl. EU-Standardvertragsklauseln. Jede
            Änderung wird 30 Tage vor Inkrafttreten angekündigt — du kannst
            innerhalb dieser Frist widersprechen.
          </p>
        </section>

        {/* 3. Welche Daten */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">3. Welche Daten wir verarbeiten</h2>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              <b>Konto-Daten</b>: E-Mail-Adresse, gehashtes Passwort (Argon2id),
              optional Name aus Google-/Apple-OAuth — zur Anmeldung und
              Identifikation.
            </li>
            <li>
              <b>Stammdaten</b> (selbst eingegeben): Firma, Anschrift,
              USt-IdNr., IBAN, Logo — zur Erstellung von Rechnungen.
            </li>
            <li>
              <b>Geschäftsdaten</b> (selbst eingegeben): Kunden, Rechnungen,
              Angebote, Belege, Cashflow-Einträge — Kerninhalt der App.
            </li>
            <li>
              <b>Beleg-Bilder/PDFs</b>: hochgeladene Belege werden in
              EU-Storage abgelegt; Inhalt nur für Klassifizierung an Anthropic
              gesendet, dort kein Training.
            </li>
            <li>
              <b>Technische Logs</b>: IP-Adresse, User-Agent, Zeitstempel — 7
              Tage zur Abwehr von Missbrauch (Art. 6 Abs. 1 lit. f DSGVO),
              danach automatisch gelöscht.
            </li>
            <li>
              <b>Zahlungsdaten</b>: ausschließlich bei Stripe. Wir sehen nur
              eine maskierte Karten-ID (z. B. &bdquo;•••• 4242&ldquo;); vollständige
              Karten-/Bankdaten sind uns nicht zugänglich.
            </li>
            <li>
              <b>Keine Tracking-Cookies</b>, kein Google Analytics, kein Meta
              Pixel, keine Werbenetzwerke.
            </li>
          </ul>
        </section>

        {/* 4. Zwecke und Rechtsgrundlagen */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">4. Zwecke & Rechtsgrundlagen</h2>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              <b>Vertragserfüllung</b> (Art. 6 Abs. 1 lit. b DSGVO): Bereitstellung
              von Konto, Speicherung deiner Geschäftsdaten, Rechnungs-Erstellung.
            </li>
            <li>
              <b>Rechtliche Verpflichtung</b> (Art. 6 Abs. 1 lit. c DSGVO): GoBD-,
              HGB-, AO-konforme Aufbewahrung von Rechnungs- und Buchungsbelegen.
            </li>
            <li>
              <b>Berechtigtes Interesse</b> (Art. 6 Abs. 1 lit. f DSGVO):
              Sicherheit (Anti-Missbrauch-Logs), Service-Verbesserung anhand
              aggregierter, anonymer Nutzungsstatistiken.
            </li>
            <li>
              <b>Einwilligung</b> (Art. 6 Abs. 1 lit. a DSGVO): nur dort, wo
              ausdrücklich abgefragt — z. B. AI-Klassifizierung von Belegen oder
              optionale Newsletter-Anmeldung.
            </li>
          </ul>
        </section>

        {/* 5. AI / Anthropic */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            5. AI-Funktionen (Anthropic Claude)
          </h2>
          <p className="text-muted-foreground">
            Wenn du die optionale Funktion &bdquo;Beleg automatisch klassifizieren&ldquo;
            oder &bdquo;OCR durchführen&ldquo; nutzt, wird der Belegtext bzw. das Beleg-Bild
            an die Anthropic-API (Claude) übertragen. Anthropic verarbeitet die
            Daten <b>im Zero-Retention-Modus</b> — die Anfrage wird sofort nach
            Antwort gelöscht und nicht zum Training verwendet (vertraglich
            zugesichert via Anthropic Enterprise DPA). Die Übermittlung erfolgt
            in die EU (Anthropic Ireland Ltd.); soweit Daten in die USA gelangen,
            ist dies durch EU-Standardvertragsklauseln abgesichert. Du kannst
            die AI-Funktion jederzeit in den Einstellungen deaktivieren.
          </p>
          <p className="text-muted-foreground">
            <b>Jobcenter-Dokument-Upload (AI-Extraktion):</b> Wenn du
            Bewilligungsbescheid, WBA oder Anlage-EKS-Scans hochlädst, wird der
            Bild- bzw. PDF-Inhalt an die Anthropic Vision-API (claude-haiku-4-5)
            übertragen, damit Felder (BWZ, Regelbedarf, BG-Nr. usw.)
            automatisch extrahiert werden können. Es gelten dieselben
            Schutzmaßnahmen: Zero-Retention, kein Training, EU-Übermittlung
            mit SCC-Absicherung. Anthropic löscht die Anfrage unmittelbar nach
            Antwort; auf Wunsch kannst du Löschung explizit anfordern. Die
            Original-Datei bleibt verschlüsselt in deinem privaten Storage-
            Bucket (Supabase EU) und ist ausschließlich für dich abrufbar.
          </p>
        </section>

        {/* 6. Cookies */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            6. Cookies & lokale Speicherung (§ 25 TDDDG)
          </h2>
          <p className="text-muted-foreground">
            Wir setzen <b>ausschließlich technisch notwendige</b> Cookies und
            Storage-Einträge:
          </p>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              <code>sb-*</code> Session-Cookies von Supabase — für die
              Anmeldung. Lebensdauer: bis Logout / 1 Stunde Inaktivität.
            </li>
            <li>
              <code>NEXT_LOCALE</code> — speichert deine Sprachwahl (DE/EN/RU/UK).
            </li>
            <li>
              <code>theme</code> — speichert Hell-/Dunkelmodus.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Diese Cookies sind nach § 25 Abs. 2 Nr. 2 TDDDG{" "}
            <b>einwilligungsfrei</b>, da sie zur Bereitstellung des
            ausdrücklich gewünschten Telemediendienstes unbedingt erforderlich
            sind. Daher zeigen wir <b>keinen Cookie-Banner</b>. Erst wenn wir
            eines Tages Tracking, Analytics oder Marketing-Cookies einsetzen
            sollten, würden wir vorher deine Einwilligung einholen.
          </p>
        </section>

        {/* 6.5 Verschlüsselung */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            6a. Verschlüsselung & technische Schutzmaßnahmen (Art. 32 DSGVO)
          </h2>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              <b>Übertragung</b>: {ENCRYPTION.in_transit}
            </li>
            <li>
              <b>Ruhezustand</b>: {ENCRYPTION.at_rest}
            </li>
            <li>
              <b>Client-seitig</b>: {ENCRYPTION.client_side}
            </li>
          </ul>
          <p className="text-muted-foreground">
            <b>Roadmap</b>: {ENCRYPTION.roadmap}
          </p>
          <p className="text-muted-foreground">
            Wir kommunizieren bewusst transparent: Stand heute ist Faktivo
            nicht ende-zu-ende-verschlüsselt. Bei Fragen zur technischen
            Architektur kontaktiere{" "}
            <a href={`mailto:${BRAND.email}`} className="text-primary underline">
              {BRAND.email}
            </a>
            .
          </p>
        </section>

        {/* 7. Empfänger */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            7. Empfänger / Weitergabe (Art. 13 Abs. 1 lit. e DSGVO)
          </h2>
          <p className="text-muted-foreground">
            Eine Weitergabe deiner Daten an Dritte erfolgt nur an die unter
            Punkt 2 / auf der Subprocessor-Seite gelisteten Auftragsverarbeiter.
            Eine kommerzielle Weitergabe (z. B. an Werbenetzwerke, Datenbroker)
            findet <b>nicht</b> statt. Eine Übermittlung in Drittländer
            (außerhalb EU/EWR) erfolgt nur, soweit dies durch EU-SCCs oder das
            EU-U.S. Data Privacy Framework abgesichert ist (siehe
            Subprocessor-Seite).
          </p>
        </section>

        {/* 8. Aufbewahrungsfristen */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            8. Aufbewahrungsfristen (Art. 13 Abs. 2 lit. a DSGVO)
          </h2>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              Rechnungen, Buchungsbelege, GoBD-Daten:{" "}
              <b>10 Jahre</b> (§ 147 AO; verkürzt auf 8 Jahre für Buchungsbelege
              ab 2025 nach BEG IV).
            </li>
            <li>
              Angebote &amp; Geschäftskorrespondenz: <b>6 Jahre</b> (§ 257 HGB).
            </li>
            <li>
              Konto-Stammdaten: bis zur Löschung des Kontos durch dich.
            </li>
            <li>
              Technische Server-Logs: <b>7 Tage</b>, danach automatisch
              überschrieben.
            </li>
            <li>
              Marketing-/Newsletter-E-Mails: bis zum Widerruf, bei
              Inaktivität max. 2 Jahre.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Bei Konto-Löschung werden alle nicht aufbewahrungspflichtigen Daten
            innerhalb von 30 Tagen gelöscht. Aufbewahrungspflichtige Daten
            werden für die Dauer der gesetzlichen Frist gesperrt und danach
            endgültig gelöscht.
          </p>
        </section>

        {/* 9. Deine Rechte */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            9. Deine Rechte (Art. 15–22 DSGVO)
          </h2>
          <ul className="text-muted-foreground list-disc pl-5">
            <li>
              <b>Auskunft</b> über die zu deiner Person gespeicherten Daten
              (Art. 15)
            </li>
            <li>
              <b>Berichtigung</b> unrichtiger Daten (Art. 16) — direkt in den
              Einstellungen möglich
            </li>
            <li>
              <b>Löschung</b> / &bdquo;Recht auf Vergessenwerden&ldquo; (Art. 17) — Konto
              löschen unter <i>Einstellungen → Konto → Konto löschen</i>
            </li>
            <li>
              <b>Einschränkung der Verarbeitung</b> (Art. 18)
            </li>
            <li>
              <b>Datenübertragbarkeit</b> (Art. 20) — Export aller deiner Daten
              als JSON / CSV / GoBD-ZIP unter <i>Einstellungen → Export</i>
            </li>
            <li>
              <b>Widerspruch</b> gegen die Verarbeitung (Art. 21) — insbesondere
              gegen auf berechtigtem Interesse gestützte Verarbeitung
            </li>
            <li>
              <b>Widerruf von Einwilligungen</b> (Art. 7 Abs. 3) — jederzeit
              ohne Angabe von Gründen, mit Wirkung für die Zukunft
            </li>
            <li>
              <b>Beschwerderecht</b> bei der Aufsichtsbehörde (Art. 77) —
              zuständig: {BRAND.supervisory_authority}
            </li>
          </ul>
          <p className="text-muted-foreground">
            Anfragen nach Art. 15–22 DSGVO werden innerhalb eines Monats
            beantwortet (Art. 12 Abs. 3 DSGVO) und sind kostenlos.
          </p>
        </section>

        {/* 10. Automatisierte Entscheidungen */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            10. Automatisierte Entscheidungsfindung (Art. 22 DSGVO)
          </h2>
          <p className="text-muted-foreground">
            Eine automatisierte Entscheidungsfindung im Sinne von Art. 22
            DSGVO mit Rechtswirkung für dich findet <b>nicht</b> statt. Die
            AI-Klassifizierung von Belegen ist ein reiner Vorschlagsmechanismus
            — die finale Buchung entscheidest stets du.
          </p>
        </section>

        {/* 11. Pflichtangabe? */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">
            11. Bereitstellung der Daten — verpflichtend?
          </h2>
          <p className="text-muted-foreground">
            Die Angabe einer E-Mail-Adresse ist zur Konto-Erstellung
            erforderlich. Ohne diese kann kein Vertrag über die Nutzung von
            Faktivo zustande kommen. Alle anderen Angaben (Firma, Anschrift,
            USt-IdNr. usw.) sind freiwillig — werden aber für die Erstellung
            rechtsgültiger Rechnungen benötigt (§ 14 UStG).
          </p>
        </section>

        {/* 12. Aktualität */}
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">12. Aktualität & Änderungen</h2>
          <p className="text-muted-foreground">
            Wir behalten uns vor, diese Datenschutzerklärung anzupassen, soweit
            sich Rechtslage oder Verarbeitungsvorgänge ändern. Wesentliche
            Änderungen werden mit 30 Tagen Vorlauf in der App und per E-Mail
            angekündigt.
          </p>
        </section>

        <p className="text-muted-foreground mt-8 text-xs">
          Stand: {new Date().toLocaleDateString("de-DE")}
        </p>
      </div>
    </div>
  )
}
