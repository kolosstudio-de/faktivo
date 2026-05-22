"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { formatAmount, parseCents } from "@/lib/money"
import type { Invoice } from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  paid_at: z.string().min(1),
  amount: z.string().min(1),
  method: z.enum(["bank_transfer", "cash", "crypto"]),
  reference: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
})

type FormValues = z.infer<typeof schema>

interface Props {
  invoice: Invoice
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentDialog({ invoice, open, onOpenChange }: Props) {
  const t = useTranslations("Payments")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const outstanding = invoice.total_cents - invoice.paid_cents

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      paid_at: format(new Date(), "yyyy-MM-dd"),
      amount: formatAmount(outstanding > 0 ? outstanding : invoice.total_cents),
      method: "bank_transfer",
      reference: invoice.number ?? "",
      notes: "",
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        paid_at: format(new Date(), "yyyy-MM-dd"),
        amount: formatAmount(outstanding > 0 ? outstanding : invoice.total_cents),
        method: "bank_transfer",
        reference: invoice.number ?? "",
        notes: "",
      })
    }
  }, [open, invoice, outstanding, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const amount_cents = parseCents(values.amount)
      if (amount_cents <= 0) throw new Error("Betrag muss > 0 sein")

      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        invoice_id: invoice.id,
        paid_at: values.paid_at,
        amount_cents,
        method: values.method,
        reference: values.reference || null,
        notes: values.notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Zahlung erfasst")
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["payments", invoice.id] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = form.handleSubmit((v) => mutation.mutate(v))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("add")}</DialogTitle>
          <DialogDescription>
            Für Rechnung {invoice.number ?? "—"}. Status wird automatisch aktualisiert.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paid_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("date")}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("amount")}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        className="text-right font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("method")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">
                          🏦 {t("methods.bank_transfer")}
                        </SelectItem>
                        <SelectItem value="cash">
                          💵 {t("methods.cash")}
                        </SelectItem>
                        <SelectItem value="crypto">
                          🪙 {t("methods.crypto")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("reference")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notiz</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
