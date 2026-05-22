import { z } from "zod"

import { isVatFormatValid } from "@/lib/validators/vies-format"

export const clientSchema = z
  .object({
    type: z.enum(["person", "company"]),
    company_name: z.string().trim().max(200).optional().or(z.literal("")),
    first_name: z.string().trim().max(100).optional().or(z.literal("")),
    last_name: z.string().trim().max(100).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("invalid-email")
      .optional()
      .or(z.literal("")),
    phone: z.string().trim().max(40).optional().or(z.literal("")),
    address: z.object({
      street: z.string().trim().max(200).optional().or(z.literal("")),
      street2: z.string().trim().max(200).optional().or(z.literal("")),
      zip: z.string().trim().max(10).optional().or(z.literal("")),
      city: z.string().trim().max(120).optional().or(z.literal("")),
      country: z.string().trim().max(2).optional().or(z.literal("")),
    }),
    tax_id: z.string().trim().max(40).optional().or(z.literal("")),
    ust_id: z.string().trim().max(40).optional().or(z.literal("")),
    country: z.string().trim().max(2),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (val.type === "company" && !val.company_name?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["company_name"],
        message: "required",
      })
    }
    if (val.type === "person" && !val.last_name?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["last_name"],
        message: "required",
      })
    }
    // USt-IdNr.-Format-Check (lokal). VIES-Live-Check passiert separat
    // async im Formular über /api/clients/validate-vat — wir blockieren
    // hier nur grob ungültige Eingaben.
    if (val.ust_id && val.ust_id.trim() && !isVatFormatValid(val.ust_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["ust_id"],
        message: "invalid-vat-format",
      })
    }
  })

export type ClientInput = z.input<typeof clientSchema>
