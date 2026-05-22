"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { FormProvider, useForm, Controller } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { addDays, format } from "date-fns"
import { FileText, Loader2, Receipt } from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useRouter } from "@/i18n/navigation"
import {
  documentSchema,
  type DocumentInput,
} from "@/lib/validators/document"
import {
  computeLineTotals,
  sumDocumentTotals,
} from "@/lib/money"
import type {
  Invoice,
  LineItem,
  Quote,
  Settings,
} from "@/types/database.types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ClientCombobox } from "./client-combobox"
import { LineItemsEditor } from "./line-items-editor"

interface Props {
  kind: "quote" | "invoice"
  settings: Settings
  existing?: {
    doc: Quote | Invoice
    lines: LineItem[]
  }
  defaultClientId?: string
  onCreated?: (id: string) => void
}

function todayIso() {
  return format(new Date(), "yyyy-MM-dd")
}

export function DocumentForm({
  kind,
  settings,
  existing,
  defaultClientId,
}: Props) {
  const tInvoice = useTranslations("Invoices")
  const tQuote = useTranslations("Quotes")
  const tItems = useTranslations("LineItems")
  const tCommon = useTranslations("Common")
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()

  const isInvoice = kind === "invoice"

  const defaultsFromExisting = React.useMemo((): DocumentInput | null => {
    if (!existing) return null
    const doc = existing.doc
    const isQuote = "valid_until" in doc
    return {
      client_id: doc.client_id,
      manual_number: doc.number ?? "",
      issue_date: doc.issue_date,
      delivery_date: "delivery_date" in doc ? doc.delivery_date ?? "" : "",
      due_date: "due_date" in doc ? doc.due_date ?? "" : "",
      valid_until: isQuote ? (doc as Quote).valid_until ?? "" : "",
      currency: doc.currency,
      reverse_charge: "reverse_charge" in doc ? doc.reverse_charge : false,
      payment_terms:
        "payment_terms" in doc ? doc.payment_terms ?? "" : "",
      notes: doc.notes ?? "",
      internal_notes: doc.internal_notes ?? "",
      show_signature:
        "show_signature" in doc ? Boolean(doc.show_signature) : false,
      show_stamp: "show_stamp" in doc ? Boolean(doc.show_stamp) : false,
      lines: existing.lines.map((l) => ({
        id: l.id,
        position: l.position,
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        unit_code: l.unit_code ?? "",
        unit_price_cents: l.unit_price_cents,
        vat_rate: Number(l.vat_rate),
        discount_pct: Number(l.discount_pct),
      })),
    }
  }, [existing])

  const form = useForm<DocumentInput>({
    resolver: zodResolver(documentSchema),
    defaultValues:
      defaultsFromExisting ?? {
        client_id: defaultClientId ?? "",
        manual_number: "",
        issue_date: todayIso(),
        delivery_date: todayIso(),
        due_date: format(addDays(new Date(), 14), "yyyy-MM-dd"),
        valid_until: format(addDays(new Date(), 30), "yyyy-MM-dd"),
        currency: "EUR",
        reverse_charge: false,
        payment_terms: isInvoice
          ? tInvoice("paymentTermsDefault")
          : "",
        notes: "",
        internal_notes: "",
        show_signature: false,
        show_stamp: false,
        lines: [
          {
            position: 1,
            description: "",
            quantity: 1,
            unit: "Stk",
            unit_code: "",
            unit_price_cents: 0,
            vat_rate: settings.is_kleinunternehmer
              ? 0
              : Number(settings.default_vat_rate ?? 19),
            discount_pct: 0,
          },
        ],
      },
  })

  const mutation = useMutation({
    mutationFn: async (values: DocumentInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Compute totals server-side style for persistence
      const perLine = values.lines.map((l) =>
        computeLineTotals({
          quantity: Number(l.quantity),
          unitPriceCents: Number(l.unit_price_cents),
          vatRatePct: settings.is_kleinunternehmer ? 0 : Number(l.vat_rate),
          discountPct: Number(l.discount_pct),
        })
      )
      const totals = sumDocumentTotals(perLine, {
        isKleinunternehmer: settings.is_kleinunternehmer,
      })

      const base = {
        user_id: user.id,
        client_id: values.client_id,
        issue_date: values.issue_date,
        currency: values.currency,
        subtotal_cents: totals.subtotalCents,
        vat_cents: totals.vatCents,
        total_cents: totals.totalCents,
        notes: values.notes || null,
        internal_notes: values.internal_notes || null,
        // Manueller Nummern-Override (nur für Entwürfe — finalisierte
        // Rechnungen sind durch Lock-Trigger geschützt). Leer = auto-allocate.
        ...(values.manual_number && values.manual_number.trim()
          ? { number: values.manual_number.trim() }
          : {}),
      }

      let parentId: string

      if (isInvoice) {
        const payload = {
          ...base,
          delivery_date: values.delivery_date || null,
          due_date: values.due_date || null,
          is_kleinunternehmer_at_issue: settings.is_kleinunternehmer,
          reverse_charge: values.reverse_charge,
          payment_terms: values.payment_terms || null,
          show_signature: values.show_signature ?? false,
          show_stamp: values.show_stamp ?? false,
        }
        if (existing) {
          const { data, error } = await supabase
            .from("invoices")
            .update(payload)
            .eq("id", existing.doc.id)
            .select()
            .single()
          if (error) throw error
          parentId = data!.id
        } else {
          const { data, error } = await supabase
            .from("invoices")
            .insert(payload)
            .select()
            .single()
          if (error) throw error
          parentId = data!.id
        }
      } else {
        const payload = {
          ...base,
          valid_until: values.valid_until || null,
          show_signature: values.show_signature ?? false,
          show_stamp: values.show_stamp ?? false,
        }
        if (existing) {
          const { data, error } = await supabase
            .from("quotes")
            .update(payload)
            .eq("id", existing.doc.id)
            .select()
            .single()
          if (error) throw error
          parentId = data!.id
        } else {
          const { data, error } = await supabase
            .from("quotes")
            .insert(payload)
            .select()
            .single()
          if (error) throw error
          parentId = data!.id
        }
      }

      // Replace line items: delete + insert (fine for drafts; locked invoices prevent this via trigger)
      if (existing) {
        const { error: delErr } = await supabase
          .from("line_items")
          .delete()
          .eq("parent_id", parentId)
          .eq("parent_kind", isInvoice ? "invoice" : "quote")
        if (delErr) throw delErr
      }

      const liInserts = values.lines.map((l, i) => {
        const t = perLine[i]
        return {
          user_id: user.id,
          parent_id: parentId,
          parent_kind: isInvoice ? ("invoice" as const) : ("quote" as const),
          position: i + 1,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unit_code: l.unit_code || null,
          unit_price_cents: l.unit_price_cents,
          vat_rate: settings.is_kleinunternehmer ? 0 : l.vat_rate,
          discount_pct: l.discount_pct,
          line_subtotal_cents: t.lineSubtotalCents,
          line_vat_cents: t.lineVatCents,
          line_total_cents: t.lineTotalCents,
        }
      })
      const { error: liErr } = await supabase
        .from("line_items")
        .insert(liInserts)
      if (liErr) throw liErr

      return parentId
    },
    onSuccess: (id) => {
      toast.success(existing ? "Aktualisiert" : "Als Entwurf gespeichert")
      queryClient.invalidateQueries({
        queryKey: [isInvoice ? "invoices" : "quotes"],
      })
      router.push(isInvoice ? `/invoices/${id}` : `/quotes/${id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values))

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isInvoice ? (
                <Receipt className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
              {isInvoice ? tInvoice("new") : tQuote("new")}
            </CardTitle>
            <CardDescription>
              {isInvoice
                ? "Entwurf — erst nach Finalisierung wird eine Nummer vergeben."
                : "Angebot an deinen Kunden. Kann später in eine Rechnung umgewandelt werden."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Controller
              control={form.control}
              name="client_id"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{tInvoice("client")}</FormLabel>
                  <FormControl>
                    <ClientCombobox
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                    />
                  </FormControl>
                  {fieldState.error ? (
                    <FormMessage>Bitte Kunde wählen</FormMessage>
                  ) : null}
                </FormItem>
              )}
            />

            {/* Manueller Nummer-Override (optional) — leer = automatisch generiert.
                Wir nutzen `register()` (uncontrolled) statt `Controller`, weil
                Controller-Inputs in Next 16 + React 19 + Turbopack nicht
                zuverlässig auf Tastatureingaben reagieren. */}
            <div className="grid gap-1.5">
              <label
                htmlFor="manual_number"
                className="text-sm font-medium"
              >
                {isInvoice ? tInvoice("manualNumber") : tQuote("manualNumber")}
              </label>
              <Input
                id="manual_number"
                type="text"
                placeholder={isInvoice ? "RE-2026-001" : "AN-2026-001"}
                {...form.register("manual_number")}
              />
              <p className="text-muted-foreground text-[11px]">
                {isInvoice
                  ? tInvoice("manualNumberHint")
                  : tQuote("manualNumberHint")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-1.5">
                <label htmlFor="issue_date" className="text-sm font-medium">
                  {tInvoice("issueDate")}
                </label>
                <Input
                  id="issue_date"
                  type="date"
                  {...form.register("issue_date")}
                />
              </div>
              {isInvoice ? (
                <>
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="delivery_date"
                      className="text-sm font-medium"
                    >
                      {tInvoice("deliveryDate")}
                    </label>
                    <Input
                      id="delivery_date"
                      type="date"
                      {...form.register("delivery_date")}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="due_date" className="text-sm font-medium">
                      {tInvoice("dueDate")}
                    </label>
                    <Input
                      id="due_date"
                      type="date"
                      {...form.register("due_date")}
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-1.5">
                  <label htmlFor="valid_until" className="text-sm font-medium">
                    {tQuote("validUntil")}
                  </label>
                  <Input
                    id="valid_until"
                    type="date"
                    {...form.register("valid_until")}
                  />
                </div>
              )}
            </div>

            {isInvoice && !settings.is_kleinunternehmer ? (
              <Controller
                control={form.control}
                name="reverse_charge"
                render={({ field }) => (
                  <FormItem className="bg-muted/40 flex items-start gap-3 rounded-xl border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="grid gap-0.5 leading-tight">
                      <FormLabel className="text-sm">
                        {tInvoice("reverseCharge")}
                      </FormLabel>
                      <p className="text-muted-foreground text-xs">
                        EU-B2B-Leistungen / §13b — keine USt, Hinweis erscheint auf der Rechnung.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tItems("description")}</CardTitle>
            <CardDescription>
              {settings.is_kleinunternehmer
                ? "Als Kleinunternehmer (§ 19) werden keine USt-Sätze ausgewiesen."
                : "USt-Satz pro Position wählbar — §14 UStG verlangt die Aufgliederung."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineItemsEditor
              isKleinunternehmer={settings.is_kleinunternehmer}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weitere Angaben</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {isInvoice ? (
              <div className="grid gap-1.5">
                <label htmlFor="payment_terms" className="text-sm font-medium">
                  {tInvoice("paymentTerms")}
                </label>
                <Textarea
                  id="payment_terms"
                  rows={4}
                  placeholder={tInvoice("paymentTermsDefault")}
                  {...form.register("payment_terms")}
                />
                <p className="text-muted-foreground text-[11px]">
                  {tInvoice("paymentTermsHint")}
                </p>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <label htmlFor="notes" className="text-sm font-medium">
                Notiz (auf PDF sichtbar)
              </label>
              <Textarea
                id="notes"
                rows={3}
                {...form.register("notes")}
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="internal_notes"
                className="text-sm font-medium"
              >
                Interne Notiz (nur für dich)
              </label>
              <Textarea
                id="internal_notes"
                rows={2}
                {...form.register("internal_notes")}
              />
            </div>

            <Controller
              control={form.control}
              name="show_signature"
              render={({ field }) => (
                <FormItem className="bg-muted/40 flex items-start gap-3 rounded-xl border p-3">
                  <FormControl>
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="grid gap-0.5 leading-tight">
                    <FormLabel className="text-sm">
                      {tInvoice("showSignature")}
                    </FormLabel>
                    <p className="text-muted-foreground text-xs">
                      {tInvoice("showSignatureHint")}
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <Controller
              control={form.control}
              name="show_stamp"
              render={({ field }) => (
                <FormItem className="bg-muted/40 flex items-start gap-3 rounded-xl border p-3">
                  <FormControl>
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="grid gap-0.5 leading-tight">
                    <FormLabel className="text-sm">
                      {tInvoice("showStamp")}
                    </FormLabel>
                    <p className="text-muted-foreground text-xs">
                      {tInvoice("showStampHint")}
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {tCommon("save")}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}
