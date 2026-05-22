import { z } from "zod"

/** ISO yyyy-mm-dd. Used everywhere a date is persisted as text. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date_format")

/** Regelbedarfsstufe per § 28 SGB XII / RBEG (1–6, plus 7 for Übergangsregelung). */
const REGELBEDARF_STUFEN = ["1", "2", "3", "4", "5", "6"] as const
export const REGELBEDARF_STUFE_ENUM = REGELBEDARF_STUFEN
export type RegelbedarfStufe = (typeof REGELBEDARF_STUFEN)[number]

export const onboardingDataSchema = z
  .object({
    // Step 2: Legal form
    legal_form: z
      .enum([
        "freiberufler",
        "einzelunternehmen",
        "gbr",
        "ug",
        "gmbh",
        "ohg",
        "kg",
        "kuenstler",
        "andere",
      ])
      .optional(),

    // Step 3: Branche
    branche_wz_code: z.string().optional(),
    branche_label: z.string().optional(),
    is_ksk_abgabepflichtig: z.boolean().optional(),

    // Step 4: Tax regime
    tax_regime: z.enum(["kleinunternehmer", "regelbesteuerung"]).optional(),
    vat_scheme: z.enum(["ist", "soll"]).optional(),
    tax_id: z.string().optional(),
    ust_id: z.string().optional(),

    // Step 5: Personal + company address
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    company_name: z.string().optional(),
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default("DE").optional(),
    phone: z.string().optional(),
    website: z.string().optional(),

    // Step 6: Banking
    iban: z.string().optional(),
    bic: z.string().optional(),
    bank_name: z.string().optional(),

    // Step 7: Bürgergeld
    receives_buergergeld: z.boolean().optional(),
    jobcenter_name: z.string().optional(),
    jobcenter_bg_nummer: z.string().optional(),
    /**
     * Bewilligungszeitraum start (Datum des Bescheids).
     * Strict ISO format so EKS-Reports nicht stillschweigend crashen.
     */
    bewilligungszeitraum_start: isoDate.optional().or(z.literal("")),
    bewilligungszeitraum_end: isoDate.optional().or(z.literal("")),
    /**
     * Monatlicher Bedarf in Cents (Bürgergeld-Regelbedarf + KdU + Mehrbedarfe).
     * Wird beim Submit erzwungen, wenn receives_buergergeld=true.
     */
    buergergeld_bedarf_monatlich_cents: z
      .number()
      .int()
      .min(1, "must_be_positive")
      .optional(),
    /**
     * Regelbedarfsstufe per § 28 SGB XII / RBEG (1–6).
     * Wird beim Submit erzwungen, wenn receives_buergergeld=true.
     */
    regelbedarf_stufe: z.enum(REGELBEDARF_STUFEN).optional(),
    has_minor_children: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // (a) Wenn beide BWZ-Daten gesetzt sind, muss _end > _start sein.
    if (
      data.bewilligungszeitraum_start &&
      data.bewilligungszeitraum_end &&
      data.bewilligungszeitraum_start.length > 0 &&
      data.bewilligungszeitraum_end.length > 0
    ) {
      const start = new Date(data.bewilligungszeitraum_start)
      const end = new Date(data.bewilligungszeitraum_end)
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        if (end <= start) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bewilligungszeitraum_end"],
            message: "bwz_end_must_be_after_start",
          })
        }
      }
    }

    // (b) Wenn der User Bürgergeld bezieht, sind BWZ-Daten + Bedarf + Stufe
    //     beim finalen Submit Pflicht. Während des Wizards (vor Submit) gilt
    //     das nicht — der UI-Flow soll das schrittweise erlauben.
    //
    //     Diese strikte Validierung erfolgt im finalize-Pfad
    //     (`onboardingFinalSchema` unten), damit die zwischengespeicherten
    //     Daten nicht zu früh als fehlerhaft markiert werden.
  })

export type OnboardingData = z.infer<typeof onboardingDataSchema>

/**
 * Final-submit schema: erzwingt Bürgergeld-Pflichtfelder, wenn der User
 * receives_buergergeld=true angegeben hat. Wird im wizard-shell vor
 * dem finalize-Mutation aufgerufen.
 */
export const onboardingFinalSchema = onboardingDataSchema.superRefine(
  (data, ctx) => {
    if (data.receives_buergergeld) {
      if (
        !data.bewilligungszeitraum_start ||
        !data.bewilligungszeitraum_start.trim()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bewilligungszeitraum_start"],
          message: "required_for_buergergeld",
        })
      }
      if (
        !data.bewilligungszeitraum_end ||
        !data.bewilligungszeitraum_end.trim()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bewilligungszeitraum_end"],
          message: "required_for_buergergeld",
        })
      }
      if (
        !data.buergergeld_bedarf_monatlich_cents ||
        data.buergergeld_bedarf_monatlich_cents <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buergergeld_bedarf_monatlich_cents"],
          message: "required_for_buergergeld",
        })
      }
      if (!data.regelbedarf_stufe) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regelbedarf_stufe"],
          message: "required_for_buergergeld",
        })
      }
    }
  }
)

export type OnboardingFinalData = z.infer<typeof onboardingFinalSchema>

export const STEPS = [
  "welcome",
  "legal_form",
  "branche",
  "tax_regime",
  "address",
  "banking",
  "buergergeld",
  "done",
] as const

export type OnboardingStep = (typeof STEPS)[number]
export const TOTAL_STEPS = STEPS.length
