/**
 * Zentrale Anbieter- und Kontaktdaten — wird in Impressum / Datenschutz / AGB /
 * Widerrufsbelehrung referenziert. Hier ändern → überall aktuell.
 *
 * RECHTSFORM
 * ----------
 * Vasyl Kolos betreibt Faktivo als angemeldetes Gewerbe (Einzelunternehmen,
 * NICHT im Handelsregister, nicht Kaufmann nach HGB) und nutzt die
 * Kleinunternehmer-Regelung gemäß § 19 UStG (kein Umsatzsteuerausweis,
 * solange Umsatz < 22.000 € im 1. Jahr / < 50.000 € im Folgejahr).
 *
 * „Kolos Digital" ist KEINE eingetragene Firma, sondern bloß eine frühere
 * Marken-Bezeichnung — wird nirgendwo mehr als rechtliche Anbieter-Bezeichnung
 * verwendet. Rechtlich verbindlich ist der bürgerliche Name „Vasyl Kolos".
 * „Faktivo" ist eine Geschäftsbezeichnung / Produktname.
 */

export const BRAND = {
  // Produktname (Geschäftsbezeichnung)
  legal_name: "Faktivo",
  product_name: "Faktivo",
  // Inhaber / Verantwortlicher (rechtlich verbindlicher Name)
  owner: "Vasyl Kolos",
  // Rechtsform — wird in Impressum / AGB ausgewiesen
  legal_form: "Einzelunternehmen · Kleinunternehmer nach § 19 UStG",
  street: "Rückäckerweg 4",
  postal_code: "93055",
  city: "Regensburg",
  country: "Deutschland",
  email: "kolosvasiliysergeevich@gmail.com",
  phone: "+49 175 3797913",
  // Kleinunternehmer (§ 19 UStG) — keine USt-IdNr-Pflicht.
  // Optional bei B2B-Kunden im EU-Ausland zu beantragen beim BZSt.
  vat_id: "Kleinunternehmer nach § 19 UStG — keine Umsatzsteuer-ID erforderlich",
  // W-IdNr wird seit November 2024 vom BZSt automatisch vergeben.
  // Falls bereits vergeben: hier eintragen.
  business_id: "Wirtschafts-Identifikationsnummer (W-IdNr.) wird ergänzt, sobald vom BZSt vergeben",
  // Datenschutz-Beauftragter — bei < 20 Mitarbeitenden ist keiner zu bestellen.
  dpo_name: "Vasyl Kolos (selbst — keine Bestellpflicht, da < 20 Beschäftigte)",
  // Zuständige Datenschutz-Aufsichtsbehörde für Bayern (Sitz Regensburg).
  // BayLDA — siehe https://www.lda.bayern.de
  supervisory_authority:
    "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach — https://www.lda.bayern.de",
  // Zuständiges Finanzamt (für Hinweis auf Rechnungen)
  tax_office: "Finanzamt Regensburg",
  // Hinweis auf Kleinunternehmer-Regelung — in AGB & auf Rechnungen erforderlich
  small_business_hint:
    "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmer-Regelung).",
} as const

export const HOSTING = {
  // Faktivo läuft aktuell als „Local-as-a-Server" über Cloudflare Tunnel
  // → Mac in Deutschland → Cloudflare-Edge Frankfurt → Endkunden.
  // Sobald produktiv: Vercel Frankfurt + Supabase Cloud Frankfurt.
  current_phase:
    "Local-as-a-Server (Mac am Anbieter-Sitz Regensburg) via Cloudflare Tunnel — Übergang auf Vercel/Supabase EU geplant",
  region: "Deutschland / EU-Region (Frankfurt)",
} as const

/**
 * ENCRYPTION-Status — was wir technisch heute schon umsetzen und was Roadmap ist.
 * Im Datenschutz transparent ausweisen — keine Versprechen, die wir nicht halten.
 */
export const ENCRYPTION = {
  in_transit:
    "TLS 1.3 für alle Verbindungen (Browser ↔ Server, Server ↔ Datenbank, Server ↔ Subdienstleister).",
  at_rest:
    "AES-256 Verschlüsselung im Ruhezustand (Supabase / AWS eu-central-1, Frankfurt). Datenbank-Snapshots ebenfalls verschlüsselt.",
  client_side: "Aktuell keine Ende-zu-Ende-Verschlüsselung im Browser.",
  roadmap:
    "Optionaler Zero-Knowledge-Modus in Entwicklung: Sensible Felder (Belege, Beträge, Notizen) werden mit einer benutzerdefinierten Passphrase im Browser verschlüsselt, bevor sie an den Server übermittelt werden. Der Anbieter kann die Klartext-Inhalte technisch nicht einsehen. Geplant für Business-Tarif als Opt-in.",
} as const

export const SUBPROCESSORS = [
  {
    name: "Supabase (Supabase, Inc.)",
    purpose: "Datenbank, Authentifizierung, Datei-Speicherung (Storage), Realtime",
    location: "EU-Region (Frankfurt, AWS eu-central-1)",
    dpa_basis: "Standard-AVV (Art. 28 DSGVO) inkl. EU-Standardvertragsklauseln",
    url: "https://supabase.com/legal/dpa",
  },
  {
    name: "Vercel Inc.",
    purpose: "Hosting der Web-Anwendung, Edge-CDN, Serverless-Funktionen",
    location: "EU-Region (Frankfurt)",
    dpa_basis: "DPA inkl. SCCs + EU-U.S. Data Privacy Framework",
    url: "https://vercel.com/legal/dpa",
  },
  {
    name: "Cloudflare Germany GmbH",
    purpose: "Reverse-Proxy / DDoS-Schutz / TLS-Terminierung (Cloudflare Tunnel)",
    location: "EU-Region (Frankfurt)",
    dpa_basis: "DPA inkl. SCCs",
    url: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
  {
    name: "Resend, Inc.",
    purpose: "Transaktions-E-Mails (Login-Bestätigung, Rechnungsversand, Passwort-Reset)",
    location: "EU-Region",
    dpa_basis: "DPA (Art. 28 DSGVO) inkl. SCCs",
    url: "https://resend.com/legal/dpa",
  },
  {
    name: "Stripe Payments Europe Ltd.",
    purpose: "Zahlungsabwicklung für Pro/Business-Abonnements (nur bei zahlungspflichtiger Buchung)",
    location: "EU (Irland)",
    dpa_basis: "Stripe DPA inkl. SCCs",
    url: "https://stripe.com/legal/dpa",
  },
  {
    name: "Anthropic Ireland Ltd.",
    purpose: "AI-gestützte Klassifizierung, Beleg-OCR und Banking-PDF-Import (Claude API) — nur wenn AI-Funktion aktiv genutzt",
    location: "Irland (EU); Anthropic-Server u. a. in den USA mit SCCs",
    dpa_basis: "Anthropic DPA inkl. SCCs · Zero-Retention-Modus (keine Speicherung der API-Anfragen)",
    url: "https://www.anthropic.com/legal/dpa",
  },
  {
    name: "Google Ireland Ltd.",
    purpose:
      'OAuth „Sign in with Google" — nur wenn Nutzer:in Google-Login aktiv wählt; übermittelt werden ausschließlich E-Mail + Name aus dem Google-Profil',
    location: "EU (Irland)",
    dpa_basis: "Google DPA inkl. SCCs",
    url: "https://cloud.google.com/terms/data-processing-addendum",
  },
  {
    name: "Apple Distribution International Ltd.",
    purpose:
      'OAuth „Sign in with Apple" — nur wenn Nutzer:in Apple-Login aktiv wählt; übermittelt werden ausschließlich E-Mail (oder anonymisiert) + opaker User-Identifier',
    location: "EU (Irland) / Apple-Server weltweit mit SCCs",
    dpa_basis: "Apple Sign in with Apple Terms · DPA",
    url: "https://www.apple.com/legal/applepayments/dpa/",
  },
] as const

export type Subprocessor = (typeof SUBPROCESSORS)[number]
