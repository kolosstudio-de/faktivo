import { z } from "zod"

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
  })

export type ClientInput = z.input<typeof clientSchema>
