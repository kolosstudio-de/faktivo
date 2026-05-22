import { z } from "zod"

export const addressSchema = z.object({
  street: z.string().trim().min(1, "required"),
  street2: z.string().trim().optional().or(z.literal("")),
  zip: z.string().trim().min(3, "required").max(10),
  city: z.string().trim().min(1, "required"),
  country: z.string().trim().min(2, "required").max(2),
})

export const settingsSchema = z.object({
  company_name: z.string().trim().min(1, "required").max(120),
  address: addressSchema,
  tax_id: z.string().trim().max(40).optional().or(z.literal("")),
  ust_id: z.string().trim().max(40).optional().or(z.literal("")),
  is_kleinunternehmer: z.boolean(),
  iban: z.string().trim().max(34).optional().or(z.literal("")),
  bic: z.string().trim().max(11).optional().or(z.literal("")),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  default_vat_rate: z.coerce.number().min(0).max(25),
  locale: z.enum(["de", "en", "ru", "uk"]),
})

export type SettingsInput = z.input<typeof settingsSchema>

export const numberSequenceSchema = z.object({
  kind: z.enum(["invoice", "quote", "credit_note"]),
  year: z.coerce.number().int().min(2000).max(2100),
  prefix: z.string().trim().min(1).max(10),
  next_value: z.coerce.number().int().min(1),
  width: z.coerce.number().int().min(3).max(8),
})

export type NumberSequenceInput = z.input<typeof numberSequenceSchema>
