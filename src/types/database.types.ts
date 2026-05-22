// Kolos Digital Finanzverwaltung — Database types
// Hand-written to match the migrations. Regenerate from Supabase CLI later:
//   npx supabase gen types typescript --local > src/types/database.types.ts

export type ClientType = "person" | "company"
export type DocScope = "business" | "personal"
export type DocNumberKind = "invoice" | "quote" | "credit_note"
export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted"
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled"
export type LineParentKind = "quote" | "invoice"
export type EntryKind = "income" | "expense"
export type JobcenterStatus = "draft" | "submitted" | "approved" | "rejected"

export type LegalForm =
  | "freiberufler"
  | "einzelunternehmen"
  | "gbr"
  | "ug"
  | "gmbh"
  | "ohg"
  | "kg"
  | "kuenstler"
  | "andere"
export type TaxRegime = "kleinunternehmer" | "regelbesteuerung" | "durchschnittssatz"
export type VatScheme = "ist" | "soll"
export type SkrChart = "SKR03" | "SKR04"
export type PlanTier = "free" | "pro" | "business" | "trial"
export type MahnungStufe = "1" | "2" | "3"
export type MahnungStatus = "draft" | "sent" | "paid" | "escalated"

export interface Mahnung {
  id: string
  user_id: string
  invoice_id: string
  stufe: MahnungStufe
  issued_at: string
  due_at: string | null
  base_amount_cents: number
  fee_cents: number
  verzugszinsen_cents: number
  verzugspauschale_cents: number
  total_cents: number
  status: MahnungStatus
  pdf_url: string | null
  sent_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Address {
  street?: string
  street2?: string
  zip?: string
  city?: string
  country?: string
}

export interface PdfTheme {
  accentColor?: string
  fontFamily?: string
  footerText?: string
}

export interface Settings {
  user_id: string
  company_name: string
  address: Address
  tax_id: string | null
  ust_id: string | null
  is_kleinunternehmer: boolean
  iban: string | null
  bic: string | null
  bank_name: string | null
  default_vat_rate: number
  default_currency: string
  logo_url: string | null
  signature_url: string | null
  stamp_url: string | null
  pdf_theme: PdfTheme
  fiscal_year_start: string
  locale: string

  // Personal identity
  first_name: string | null
  last_name: string | null
  phone: string | null
  website: string | null
  email_from_invoice: string | null
  email_signature: string | null
  signature_image_url: string | null
  email_template_invoice_subject: string | null
  email_template_invoice_body: string | null
  email_template_mahnung_subject: string | null
  email_template_mahnung_body: string | null

  // Legal
  legal_form: LegalForm | null
  trade_register_number: string | null
  trade_register_court: string | null
  branche_wz_code: string | null
  branche_label: string | null
  is_ksk_mitglied: boolean
  is_ksk_abgabepflichtig: boolean
  ksk_nummer: string | null

  // Tax
  tax_regime: TaxRegime
  vat_scheme: VatScheme
  finanzamt_id: string | null
  finanzamt_name: string | null
  skr_chart: SkrChart

  // Jobcenter
  receives_buergergeld: boolean
  jobcenter_name: string | null
  jobcenter_bg_nummer: string | null
  bewilligungszeitraum_start: string | null
  bewilligungszeitraum_end: string | null
  has_minor_children: boolean
  regelbedarf_stufe: number | null
  buergergeld_bedarf_monatlich_cents: number | null
  /** ISO month → einkommen cents, e.g. { "2026-04-01": 60000 } */
  vorlaeufige_prognose_jsonb: Record<string, number>
  last_eks_submitted_for_month: string | null
  last_steuererklaerung_for_year: number | null
  mehrbedarfe_jsonb: MehrbedarfeJson

  // Steuerberater
  steuerberater_name: string | null
  steuerberater_email: string | null
  steuerberater_datev_id: string | null

  // PDF
  pdf_template: string
  pdf_accent_color: string
  pdf_footer_text: string | null
  invoice_language_default: string

  // Mahnwesen
  enable_auto_mahnung: boolean
  mahnung_1_days_after_due: number
  mahnung_2_days_after_due: number
  mahnung_3_days_after_due: number
  mahngebuehr_1_cents: number
  mahngebuehr_2_cents: number
  mahngebuehr_3_cents: number
  verzugspauschale_cents: number

  // Onboarding / Plan
  onboarding_step: number
  onboarding_completed_at: string | null
  plan: PlanTier
  trial_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null

  created_at: string
  updated_at: string
}

export interface OnboardingProgress {
  user_id: string
  step: number
  data: Record<string, unknown>
  updated_at: string
}

export type ReminderKind =
  | "eks_monthly"
  | "eks_endgueltig"
  | "steuererklaerung"
  | "ust_voranmeldung"
  | "eu_zm"

export interface Reminder {
  id: string
  user_id: string
  kind: ReminderKind
  due_date: string
  payload_jsonb: Record<string, unknown>
  sent_at: string | null
  dismissed_at: string | null
  created_at: string
}

export interface Beleg {
  id: string
  user_id: string
  storage_path: string
  mime_type: string | null
  file_size_bytes: number | null
  ocr_amount_cents: number | null
  ocr_vat_rate: number | null
  ocr_vendor: string | null
  ocr_date: string | null
  ocr_category_hint: string | null
  ocr_description: string | null
  ocr_raw_jsonb: Record<string, unknown> | null
  ocr_confidence: number | null
  ocr_processed_at: string | null
  expense_entry_id: string | null
  created_at: string
}

// ─── Banking (PSD2 / GoCardless Bank Account Data) ─────────────────────────

export type BankConnectionStatus =
  | "created"
  | "pending"
  | "linked"
  | "expired"
  | "revoked"
  | "error"

export type BankProvider = "truelayer"

export interface BankConnection {
  id: string
  user_id: string
  requisition_id: string
  institution_id: string
  institution_name: string | null
  institution_logo_url: string | null
  status: BankConnectionStatus
  agreement_id: string | null
  agreement_max_days: number | null
  reference: string
  expires_at: string | null
  consented_at: string | null
  /** Welcher PSD2-Aggregator wird benutzt */
  provider: BankProvider
  /** OAuth access token (TrueLayer) — short-lived ~1h */
  access_token: string | null
  /** OAuth refresh token (TrueLayer) — long-lived 90 Tage */
  refresh_token: string | null
  /** Wann läuft access_token ab */
  token_expires_at: string | null
  /** TrueLayer connection.id — nicht zu verwechseln mit unserer id */
  tl_connection_id: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  user_id: string
  connection_id: string
  account_id: string
  iban: string | null
  bic: string | null
  currency: string
  owner_name: string | null
  display_name: string | null
  balance_cents: number | null
  balance_at: string | null
  last_synced_at: string | null
  scope: DocScope
  sync_enabled: boolean
  /** Last 4 digits of IBAN — for compact "•••• 1965" card-style display. */
  last_4: string | null
  /** User-chosen accent color for the account card. */
  card_color: string | null
  /** Free-form notes (visible only to the user). */
  notes: string | null
  created_at: string
  updated_at: string
}

export type BankTransactionStatus = "booked" | "pending"

export interface BankTransaction {
  id: string
  user_id: string
  account_id: string
  external_id: string
  status: BankTransactionStatus
  booking_date: string
  value_date: string | null
  amount_cents: number
  currency: string
  remittance_info: string | null
  counterparty_name: string | null
  counterparty_iban: string | null
  counterparty_bic: string | null
  transaction_code: string | null
  category_hint: string | null
  is_business: boolean
  expense_entry_id: string | null
  income_entry_id: string | null
  payment_id: string | null
  dismissed_at: string | null
  /** AI-Klassifikation via Claude Sonnet 4.5 (in /api/banking/import-csv + /sync) */
  ai_scope: "business" | "private" | null
  ai_category: string | null
  ai_skr03: string | null
  ai_vat_rate: number | null
  ai_confidence: number | null
  ai_reasoning: string | null
  ai_classified_at: string | null
  /** Wenn gesetzt → expense_entry wurde automatisch angelegt (siehe expense_entry_id). */
  ai_auto_imported_at: string | null
  /** Wenn gesetzt → diese Tx hat ein Recurring-Muster (Spotify, Miete, Kredit, ...). */
  recurring_suggestion_id: string | null
  /** True wenn Eingang als Bürgergeld (Jobcenter) erkannt wurde. */
  is_buergergeld: boolean
  /** True wenn diese Tx Teil eines Eigentransfers ist (Konto → eigenes Konto). */
  is_transfer: boolean
  /** Andere Seite des Eigentransfers (symmetrische FK). */
  transfer_pair_id: string | null
  /** AI/Rule suggestion (PDF-Import-Pipeline, siehe categorization_rules). */
  suggested_category_id: string | null
  suggested_scope: DocScope | null
  suggestion_source: "rule" | "ai" | "none" | null
  created_at: string
}

// ─── Recurring Expenses (Verträge / Abos / Kredite) ───────────────────────

export type RecurringKind =
  | "subscription"
  | "rent"
  | "utility"
  | "loan"
  | "insurance"
  | "membership"
  | "leasing"
  | "other"

export type RecurringFrequency = "monthly" | "quarterly" | "yearly"

export interface RecurringExpense {
  id: string
  user_id: string
  scope: DocScope
  kind: RecurringKind
  name: string
  vendor: string | null
  category_id: string | null
  frequency: RecurringFrequency
  amount_cents: number
  vat_rate: number
  payment_method: string | null
  start_date: string
  end_date: string | null
  next_due_date: string
  last_posted_date: string | null
  remaining_payments: number | null
  total_amount_cents: number | null
  remaining_amount_cents: number | null
  auto_detected: boolean
  auto_detection_confidence: number | null
  active: boolean
  paused_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CategoryRule {
  id: string
  user_id: string
  pattern: string
  match_field: "counterparty_name" | "remittance_info" | "vendor"
  scope: DocScope
  category_id: string | null
  category_label: string | null
  vat_rate: number
  is_deductible: boolean
  jobcenter_relevant: boolean
  hits: number
  created_at: string
  updated_at: string
}

// ─── §21 SGB II Mehrbedarfe ────────────────────────────────────────────────

export interface MehrbedarfeJson {
  schwanger?: boolean
  behinderung?: boolean
  dezentrale_warmwasser?: boolean
  ernaehrung_cents?: number
  alleinerziehend_kinder?: {
    anzahl: number
    juengstes_kind_alter: number
  } | null
}

export interface NumberSequence {
  user_id: string
  kind: DocNumberKind
  year: number
  prefix: string
  next_value: number
  width: number
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  user_id: string
  type: ClientType
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address: Address
  tax_id: string | null
  ust_id: string | null
  country: string
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  user_id: string
  client_id: string
  number: string | null
  issue_date: string
  valid_until: string | null
  status: QuoteStatus
  subtotal_cents: number
  vat_cents: number
  total_cents: number
  currency: string
  notes: string | null
  internal_notes: string | null
  pdf_url: string | null
  show_signature: boolean
  show_stamp: boolean
  converted_invoice_id: string | null
  is_imported: boolean
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  user_id: string
  client_id: string
  quote_id: string | null
  number: string | null
  issue_date: string
  delivery_date: string | null
  due_date: string | null
  status: InvoiceStatus
  subtotal_cents: number
  vat_cents: number
  total_cents: number
  paid_cents: number
  currency: string
  is_kleinunternehmer_at_issue: boolean
  reverse_charge: boolean
  payment_terms: string | null
  notes: string | null
  internal_notes: string | null
  pdf_url: string | null
  pdf_hash: string | null
  show_signature: boolean
  show_stamp: boolean
  cancelled_by_invoice_id: string | null
  cancels_invoice_id: string | null
  locked_at: string | null
  sent_at: string | null
  is_imported: boolean
  payment_method: string | null
  /** Stripe Payment Link für instant Online-Zahlung der Rechnung. */
  stripe_payment_link_id: string | null
  stripe_payment_link_url: string | null
  stripe_payment_link_created_at: string | null
  created_at: string
  updated_at: string
}

export interface LineItem {
  id: string
  user_id: string
  parent_id: string
  parent_kind: LineParentKind
  position: number
  description: string
  quantity: number
  unit: string
  unit_code: string | null
  unit_price_cents: number
  vat_rate: number
  discount_pct: number
  line_subtotal_cents: number
  line_vat_cents: number
  line_total_cents: number
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string
  invoice_id: string
  paid_at: string
  amount_cents: number
  method: string
  reference: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  scope: DocScope
  kind: EntryKind
  name: string
  skr_code: string | null
  parent_id: string | null
  color: string | null
  sort_order: number
  is_jobcenter_relevant: boolean
  created_at: string
  updated_at: string
}

export interface IncomeEntry {
  id: string
  user_id: string
  scope: DocScope
  occurred_on: string
  amount_cents: number
  currency: string
  category_id: string | null
  invoice_id: string | null
  source: string | null
  description: string | null
  attachment_url: string | null
  jobcenter_relevant: boolean
  created_at: string
  updated_at: string
}

export interface ExpenseEntry {
  id: string
  user_id: string
  scope: DocScope
  occurred_on: string
  amount_cents: number
  currency: string
  category_id: string | null
  vendor: string | null
  description: string | null
  payment_method: string | null
  vat_cents: number
  vat_rate: number
  is_deductible: boolean
  attachment_url: string | null
  mileage_km: number | null
  is_kfz_pauschale: boolean
  recurring_source_id: string | null
  private_share_pct: number
  created_at: string
  updated_at: string
}

export type EksReportKind = "vorlaeufig" | "endgueltig"

/**
 * Per-month estimate for vorläufige Anlage EKS.
 * Persisted inside JobcenterReport.prognose_payload.months[].
 */
export interface EksPrognoseMonth {
  /** ISO first-of-month, e.g. "2026-08-01" */
  month: string
  einnahmenCents: number
  ausgabenCents: number
}

export interface EksPrognosePayload {
  months: EksPrognoseMonth[]
}

export interface JobcenterReport {
  id: string
  user_id: string
  period_start: string
  period_end: string
  submitted_at: string | null
  income_cents: number
  expenses_cents: number
  net_cents: number
  payload: Record<string, unknown>
  pdf_url: string | null
  status: JobcenterStatus
  notes: string | null
  /** Vorläufig (start of BWZ, estimated) vs. endgültig (end of BWZ, actual). */
  kind: EksReportKind
  /** Per-month estimates for vorläufig only. NULL for endgültig. */
  prognose_payload: EksPrognosePayload | null
  created_at: string
  updated_at: string
}

// Shape for Supabase Database type
export interface Database {
  public: {
    Tables: {
      settings: {
        Row: Settings
        Insert: Partial<Settings> & Pick<Settings, "user_id">
        Update: Partial<Settings>
      }
      number_sequences: {
        Row: NumberSequence
        Insert: Partial<NumberSequence> &
          Pick<NumberSequence, "user_id" | "kind" | "year">
        Update: Partial<NumberSequence>
      }
      clients: {
        Row: Client
        Insert: Partial<Client> & Pick<Client, "user_id">
        Update: Partial<Client>
      }
      quotes: {
        Row: Quote
        Insert: Partial<Quote> & Pick<Quote, "user_id" | "client_id">
        Update: Partial<Quote>
      }
      invoices: {
        Row: Invoice
        Insert: Partial<Invoice> & Pick<Invoice, "user_id" | "client_id">
        Update: Partial<Invoice>
      }
      line_items: {
        Row: LineItem
        Insert: Partial<LineItem> &
          Pick<
            LineItem,
            "user_id" | "parent_id" | "parent_kind" | "description"
          >
        Update: Partial<LineItem>
      }
      payments: {
        Row: Payment
        Insert: Partial<Payment> &
          Pick<Payment, "user_id" | "invoice_id" | "amount_cents">
        Update: Partial<Payment>
      }
      categories: {
        Row: Category
        Insert: Partial<Category> &
          Pick<Category, "user_id" | "scope" | "kind" | "name">
        Update: Partial<Category>
      }
      income_entries: {
        Row: IncomeEntry
        Insert: Partial<IncomeEntry> &
          Pick<IncomeEntry, "user_id" | "amount_cents">
        Update: Partial<IncomeEntry>
      }
      expense_entries: {
        Row: ExpenseEntry
        Insert: Partial<ExpenseEntry> &
          Pick<ExpenseEntry, "user_id" | "amount_cents">
        Update: Partial<ExpenseEntry>
      }
      jobcenter_reports: {
        Row: JobcenterReport
        Insert: Partial<JobcenterReport> &
          Pick<JobcenterReport, "user_id" | "period_start" | "period_end">
        Update: Partial<JobcenterReport>
      }
    }
    Functions: {
      allocate_number: {
        Args: { p_kind: DocNumberKind; p_year?: number }
        Returns: string
      }
      finalize_invoice: {
        Args: { p_invoice_id: string }
        Returns: Invoice
      }
      finalize_quote: {
        Args: { p_quote_id: string }
        Returns: Quote
      }
      storno_invoice: {
        Args: { p_invoice_id: string; p_reason?: string }
        Returns: Invoice
      }
    }
    Enums: {
      client_type: ClientType
      doc_scope: DocScope
      doc_number_kind: DocNumberKind
      quote_status: QuoteStatus
      invoice_status: InvoiceStatus
      line_parent_kind: LineParentKind
      entry_kind: EntryKind
      jobcenter_status: JobcenterStatus
    }
  }
}
