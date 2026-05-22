"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { Loader2, Upload } from "lucide-react"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useRouter } from "@/i18n/navigation"
import { parseCents } from "@/lib/money"

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
import { ClientCombobox } from "./client-combobox"

const schema = z.object({
  kind: z.enum(["invoice", "quote"]),
  client_id: z.string().uuid(),
  number: z.string().min(1).max(40),
  issue_date: z.string().min(1),
  delivery_date: z.string().optional().or(z.literal("")),
  due_date: z.string().optional().or(z.literal("")),
  net_total: z.string().min(1),
  vat_total: z.string().default("0"),
  status: z.enum(["sent", "paid", "cancelled", "accepted", "rejected"]),
  payment_method: z.enum(["bank_transfer", "cash", "crypto"]).optional(),
  is_kleinunternehmer: z.boolean().default(true),
  pdf_file: z.any().optional(),
})

type FormValues = z.input<typeof schema>

interface Props {
  kind: "invoice" | "quote"
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportInvoiceDialog({ kind, open, onOpenChange }: Props) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind,
      client_id: "",
      number: "",
      issue_date: format(new Date(), "yyyy-MM-dd"),
      delivery_date: format(new Date(), "yyyy-MM-dd"),
      due_date: "",
      net_total: "",
      vat_total: "0",
      status: kind === "invoice" ? "paid" : "accepted",
      payment_method: "bank_transfer",
      is_kleinunternehmer: true,
    },
  })

  React.useEffect(() => {
    if (open) {
      form.setValue("kind", kind)
    }
  }, [open, kind, form])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const subtotal_cents = parseCents(values.net_total as string)
      const vat_cents = parseCents((values.vat_total as string) || "0")
      const total_cents = subtotal_cents + vat_cents

      const now = new Date().toISOString()
      const isInvoice = kind === "invoice"

      // Optional PDF upload
      let pdfUrl: string | null = null
      const fileList = (values.pdf_file as FileList | undefined) ?? null
      if (fileList && fileList.length > 0) {
        const file = fileList[0]
        const path = `${user.id}/imports/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: "application/pdf" })
        if (upErr) throw upErr
        pdfUrl = path
      }

      if (isInvoice) {
        const { data: invoice, error } = await supabase
          .from("invoices")
          .insert({
            user_id: user.id,
            client_id: values.client_id,
            number: values.number,
            issue_date: values.issue_date,
            delivery_date: values.delivery_date || values.issue_date,
            due_date: values.due_date || null,
            status: values.status,
            subtotal_cents,
            vat_cents,
            total_cents,
            paid_cents: values.status === "paid" ? total_cents : 0,
            currency: "EUR",
            is_kleinunternehmer_at_issue: values.is_kleinunternehmer as boolean,
            locked_at: now,
            sent_at: now,
            pdf_url: pdfUrl,
            is_imported: true,
            notes: "Importiert — historische Rechnung.",
          })
          .select()
          .single()
        if (error) throw error

        await supabase.from("line_items").insert({
          user_id: user.id,
          parent_id: invoice!.id,
          parent_kind: "invoice",
          position: 1,
          description: "Importierter Beleg — siehe PDF",
          quantity: 1,
          unit: "Pauschale",
          unit_price_cents: subtotal_cents,
          vat_rate:
            subtotal_cents > 0
              ? Math.round((vat_cents / subtotal_cents) * 100)
              : 0,
          discount_pct: 0,
          line_subtotal_cents: subtotal_cents,
          line_vat_cents: vat_cents,
          line_total_cents: total_cents,
        })

        // If paid, create a corresponding payment record
        if (values.status === "paid" && total_cents > 0) {
          await supabase.from("payments").insert({
            user_id: user.id,
            invoice_id: invoice!.id,
            paid_at: values.issue_date,
            amount_cents: total_cents,
            method: values.payment_method ?? "bank_transfer",
            reference: values.number,
            notes: "Auto-created via import",
          })
        } else if (values.payment_method) {
          // No payment but method was chosen — store on invoice directly
          await supabase
            .from("invoices")
            .update({ payment_method: values.payment_method })
            .eq("id", invoice!.id)
        }

        return invoice!.id
      } else {
        const { data: quote, error } = await supabase
          .from("quotes")
          .insert({
            user_id: user.id,
            client_id: values.client_id,
            number: values.number,
            issue_date: values.issue_date,
            status: values.status === "paid" ? "accepted" : values.status,
            subtotal_cents,
            vat_cents,
            total_cents,
            currency: "EUR",
            pdf_url: pdfUrl,
            is_imported: true,
            notes: "Importiert — historisches Angebot.",
          })
          .select()
          .single()
        if (error) throw error

        await supabase.from("line_items").insert({
          user_id: user.id,
          parent_id: quote!.id,
          parent_kind: "quote",
          position: 1,
          description: "Importierter Beleg — siehe PDF",
          quantity: 1,
          unit: "Pauschale",
          unit_price_cents: subtotal_cents,
          vat_rate:
            subtotal_cents > 0
              ? Math.round((vat_cents / subtotal_cents) * 100)
              : 0,
          discount_pct: 0,
          line_subtotal_cents: subtotal_cents,
          line_vat_cents: vat_cents,
          line_total_cents: total_cents,
        })

        return quote!.id
      }
    },
    onSuccess: async (id) => {
      toast.success("Importiert — erscheint jetzt in der Liste")
      queryClient.invalidateQueries({
        queryKey: [kind === "invoice" ? "invoices" : "quotes"],
      })
      onOpenChange(false)
      form.reset()

      // Nudge: hint user to sync number sequences if new number is higher
      const values = form.getValues()
      const match = (values.number as string).match(/-(\d{4})-(\d+)$/)
      if (match) {
        const year = Number(match[1])
        const seqValue = Number(match[2])
        // If current year matches, and seqValue >= next_value, update
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            const { data: seq } = await supabase
              .from("number_sequences")
              .select("next_value")
              .eq("user_id", user.id)
              .eq("kind", kind === "invoice" ? "invoice" : "quote")
              .eq("year", year)
              .maybeSingle()
            if (seq && (seq as { next_value: number }).next_value <= seqValue) {
              await supabase
                .from("number_sequences")
                .update({ next_value: seqValue + 1 })
                .eq("user_id", user.id)
                .eq("kind", kind === "invoice" ? "invoice" : "quote")
                .eq("year", year)
              toast.info(
                `Nummernkreis aktualisiert — nächste ${kind === "invoice" ? "Rechnung" : "Angebot"} bekommt #${seqValue + 1}`
              )
            }
          }
        } catch {
          // non-critical
        }
      }

      router.push(kind === "invoice" ? `/invoices/${id}` : `/quotes/${id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = form.handleSubmit((v) => mutation.mutate(v))

  const title = kind === "invoice" ? "Alte Rechnung importieren" : "Altes Angebot importieren"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Erfasse einen bestehenden Beleg. Die Nummer wird übernommen wie sie ist — der Nummernkreis wird danach automatisch auf den nächsten freien Wert gesetzt.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4">
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kunde</FormLabel>
                  <FormControl>
                    <ClientCombobox
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nummer (wie auf dem Original)</FormLabel>
                    <FormControl>
                      <Input placeholder="KD-2024-0015" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {kind === "invoice" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="delivery_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leistungsdatum</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fällig am (optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="net_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Netto (€)</FormLabel>
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
              <FormField
                control={form.control}
                name="vat_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>USt (€)</FormLabel>
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
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {kind === "invoice" ? (
                            <>
                              <SelectItem value="paid">Bezahlt</SelectItem>
                              <SelectItem value="sent">Offen</SelectItem>
                              <SelectItem value="cancelled">Storniert</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="accepted">Angenommen</SelectItem>
                              <SelectItem value="sent">Gesendet</SelectItem>
                              <SelectItem value="rejected">Abgelehnt</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {kind === "invoice" ? (
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zahlungsmethode</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="— wählen —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">
                            🏦 Überweisung
                          </SelectItem>
                          <SelectItem value="cash">💵 Bar</SelectItem>
                          <SelectItem value="crypto">🪙 Krypto</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="pdf_file"
              render={({ field: { onChange, ref } }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Upload className="size-3.5" />
                    Original-PDF hochladen (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="application/pdf"
                      ref={ref}
                      onChange={(e) => onChange(e.target.files)}
                    />
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
                Importieren
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
