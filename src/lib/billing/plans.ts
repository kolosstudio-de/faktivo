// Faktivo-Tarife — Stand Apr 2026, Marktbenchmark gegen sevDesk / Lexware /
// Zervant. Free-Tier mit echter E-Rechnung (XRechnung 3.0 / ZUGFeRD).
// Alle Preise: Endpreis ohne USt. (§ 19 UStG, Kleinunternehmer).
//
// Annual-Preis = 12 × Jahresmonats-Wert; ~20 % unter Monats-Abo.

export interface PlanConfig {
  id: "free" | "pro" | "business"
  name: string
  price_monthly_cents: number
  /** Preis pro Monat im Jahres-Abo (Anzeige) — nicht das Total. */
  price_yearly_per_month_cents: number
  /** Total bei Jahres-Abo = price_yearly_per_month_cents × 12. */
  price_yearly_total_cents: number
  stripe_price_id_monthly?: string // env-driven
  stripe_price_id_yearly?: string
  mollie_price_id_monthly?: string
  mollie_price_id_yearly?: string
  tagline: string
  highlights: string[]
  limits: {
    rechnungen_per_month: number | "unlimited"
    clients: number | "unlimited"
    eks_per_quarter: number | "unlimited"
    banking_sync: boolean
    ocr: boolean
    mahnwesen: boolean
    datev_export: boolean
    elster_export: boolean
    team_access: boolean
    api_access: boolean
    custom_branding: boolean
    multi_company: boolean | number
    zero_knowledge: boolean
  }
  popular?: boolean
}

export const PLANS: PlanConfig[] = [
  {
    id: "free",
    name: "Free",
    price_monthly_cents: 0,
    price_yearly_per_month_cents: 0,
    price_yearly_total_cents: 0,
    tagline: "Für den Start — dauerhaft kostenlos",
    highlights: [
      "3 Rechnungen pro Monat",
      "Unbegrenzt Angebote",
      "E-Rechnung (XRechnung 3.0 / ZUGFeRD)",
      "§ 19 Kleinunternehmer-konform",
      "1 Bankkonto (read-only CSV)",
      "1 Sprache (DE/EN/RU/UK wählbar)",
      "Faktivo-Branding im PDF-Footer",
    ],
    limits: {
      rechnungen_per_month: 3,
      clients: 25,
      eks_per_quarter: 1,
      banking_sync: false,
      ocr: false,
      mahnwesen: false,
      datev_export: false,
      elster_export: false,
      team_access: false,
      api_access: false,
      custom_branding: false,
      multi_company: false,
      zero_knowledge: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    price_monthly_cents: 990, // 9,90 €
    price_yearly_per_month_cents: 790, // 7,90 € / Mon. im Jahresabo
    price_yearly_total_cents: 9480, // 7,90 × 12 = 94,80 €
    stripe_price_id_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    stripe_price_id_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY,
    mollie_price_id_monthly: process.env.NEXT_PUBLIC_MOLLIE_PRICE_PRO_MONTHLY,
    mollie_price_id_yearly: process.env.NEXT_PUBLIC_MOLLIE_PRICE_PRO_YEARLY,
    tagline: "Für Freelancer & Kleinunternehmer",
    highlights: [
      "Unbegrenzt Rechnungen + Angebote",
      "Banking Auto-Sync",
      "Mahnwesen 3-stufig (§ 288 BGB)",
      "Anlage EKS — unbegrenzt",
      "DATEV-Export EXTF 700",
      "E-Rechnung Versand",
      "Eigenes Logo + 3 PDF-Vorlagen",
      "Alle 4 Sprachen aktiv",
    ],
    limits: {
      rechnungen_per_month: "unlimited",
      clients: "unlimited",
      eks_per_quarter: "unlimited",
      banking_sync: true,
      ocr: false,
      mahnwesen: true,
      datev_export: true,
      elster_export: false,
      team_access: false,
      api_access: false,
      custom_branding: true,
      multi_company: false,
      zero_knowledge: false,
    },
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    price_monthly_cents: 1990, // 19,90 €
    price_yearly_per_month_cents: 1590, // 15,90 € / Mon. im Jahresabo
    price_yearly_total_cents: 19080, // 15,90 × 12 = 190,80 €
    stripe_price_id_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY,
    stripe_price_id_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY,
    mollie_price_id_monthly:
      process.env.NEXT_PUBLIC_MOLLIE_PRICE_BUSINESS_MONTHLY,
    mollie_price_id_yearly:
      process.env.NEXT_PUBLIC_MOLLIE_PRICE_BUSINESS_YEARLY,
    tagline: "Für Agenturen & kleine GmbHs",
    highlights: [
      "Alles aus Pro",
      "Receipt OCR (KI-basiert)",
      "ELSTER-Bridge (UStVA, EÜR)",
      "Steuerberater-Zugang (read-only)",
      "Bis zu 3 User",
      "Bis zu 3 Firmen",
      "API + Webhooks",
      "Zero-Knowledge-Modus (sobald released)",
      "Priorität-Support (DE)",
    ],
    limits: {
      rechnungen_per_month: "unlimited",
      clients: "unlimited",
      eks_per_quarter: "unlimited",
      banking_sync: true,
      ocr: true,
      mahnwesen: true,
      datev_export: true,
      elster_export: true,
      team_access: true,
      api_access: true,
      custom_branding: true,
      multi_company: 3,
      zero_knowledge: true,
    },
  },
]

/** Helper: Ersparnis im Jahres-Abo gegenüber 12× Monatsabo. */
export function annualSavingsPct(plan: PlanConfig): number {
  if (plan.price_monthly_cents === 0) return 0
  const monthly12 = plan.price_monthly_cents * 12
  if (monthly12 === 0) return 0
  return Math.round(
    ((monthly12 - plan.price_yearly_total_cents) / monthly12) * 100,
  )
}
