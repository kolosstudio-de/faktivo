"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useShowGermanCategoryLabels } from "@/lib/hooks/use-display-prefs"
import { parseCents } from "@/lib/money"
import { entrySchema, type EntryInput } from "@/lib/validators/entry"
import { translateCategoryName } from "@/lib/banking/category-translations"
import { BelegUpload } from "./beleg-upload"
import type {
  Category,
  DocScope,
  EntryKind,
  ExpenseEntry,
  IncomeEntry,
} from "@/types/database.types"

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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  kind: EntryKind
  scope: DocScope
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: IncomeEntry | ExpenseEntry | null
}

const PAYMENT_METHOD_LABELS = {
  bar: "💵 Bar",
  ec_karte: "💳 EC / Girocard",
  kreditkarte: "💳 Kreditkarte",
  ueberweisung: "🏦 Überweisung (SEPA)",
  lastschrift: "🏦 Lastschrift / SEPA-DD",
  paypal: "🅿️ PayPal",
  apple_pay: "🍎 Apple Pay",
  google_pay: "🅖 Google Pay",
  klarna: "🅺 Klarna / Sofort",
  andere: "⚙️ Andere",
} as const

export function EntryDialog({
  kind,
  scope,
  open,
  onOpenChange,
  initial,
}: Props) {
  const t = useTranslations("Finances")
  const tBanking = useTranslations("Banking")
  const [showGermanLabels] = useShowGermanCategoryLabels()
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const table = kind === "income" ? "income_entries" : "expense_entries"

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", { scope, kind }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("scope", scope)
        .eq("kind", kind)
        .order("sort_order")
      if (error) throw error
      return data as Category[]
    },
    enabled: open,
  })

  const form = useForm<EntryInput>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      occurred_on: initial?.occurred_on ?? format(new Date(), "yyyy-MM-dd"),
      amount: initial
        ? (initial.amount_cents / 100).toFixed(2).replace(".", ",")
        : "",
      category_id: initial?.category_id ?? "",
      description: initial?.description ?? "",
      vendor: (initial as ExpenseEntry | undefined)?.vendor ?? "",
      payment_method: (initial as ExpenseEntry | undefined)?.payment_method ?? "",
      vat_rate: Number((initial as ExpenseEntry | undefined)?.vat_rate ?? 0),
      is_deductible:
        (initial as ExpenseEntry | undefined)?.is_deductible ?? true,
      jobcenter_relevant:
        (initial as IncomeEntry | undefined)?.jobcenter_relevant ?? scope === "business",
      private_share_pct:
        Number((initial as ExpenseEntry | undefined)?.private_share_pct ?? 0),
      attachment_url: initial?.attachment_url ?? "",
      is_kfz_pauschale:
        (initial as ExpenseEntry | undefined)?.is_kfz_pauschale ?? false,
      mileage_km: Number(
        (initial as ExpenseEntry | undefined)?.mileage_km ?? 0
      ),
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        occurred_on: initial?.occurred_on ?? format(new Date(), "yyyy-MM-dd"),
        amount: initial
          ? (initial.amount_cents / 100).toFixed(2).replace(".", ",")
          : "",
        category_id: initial?.category_id ?? "",
        description: initial?.description ?? "",
        vendor: (initial as ExpenseEntry | undefined)?.vendor ?? "",
        payment_method:
          (initial as ExpenseEntry | undefined)?.payment_method ?? "",
        vat_rate: Number((initial as ExpenseEntry | undefined)?.vat_rate ?? 0),
        is_deductible:
          (initial as ExpenseEntry | undefined)?.is_deductible ?? true,
        jobcenter_relevant:
          (initial as IncomeEntry | undefined)?.jobcenter_relevant ?? scope === "business",
        private_share_pct: Number(
          (initial as ExpenseEntry | undefined)?.private_share_pct ?? 0
        ),
        attachment_url: initial?.attachment_url ?? "",
      })
    }
  }, [open, initial, form, scope])

  const mutation = useMutation({
    mutationFn: async (values: EntryInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Kfz-Pauschale §9 EStG: 0,30 €/km (max 30 €/Tag) → amount_cents überschreiben
      const isKfz = values.is_kfz_pauschale && Number(values.mileage_km) > 0
      const amount_cents = isKfz
        ? Math.round(Number(values.mileage_km) * 30) // 30 cents per km
        : parseCents(values.amount)
      if (amount_cents <= 0) throw new Error("Betrag muss > 0 sein")

      const base = {
        user_id: user.id,
        scope,
        occurred_on: values.occurred_on,
        amount_cents,
        currency: "EUR",
        category_id: values.category_id || null,
        description: values.description || null,
        attachment_url: values.attachment_url || null,
      }

      if (kind === "income") {
        const payload = {
          ...base,
          source: values.vendor || null,
          jobcenter_relevant: values.jobcenter_relevant,
        }
        if (initial) {
          const { error } = await supabase
            .from("income_entries")
            .update(payload)
            .eq("id", initial.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("income_entries")
            .insert(payload)
          if (error) throw error
        }
      } else {
        const vatCents = Math.round(
          (amount_cents * Number(values.vat_rate)) / (100 + Number(values.vat_rate))
        )
        const payload = {
          ...base,
          vendor: values.vendor || null,
          payment_method: values.payment_method || null,
          vat_rate: values.vat_rate,
          vat_cents: vatCents,
          is_deductible: values.is_deductible,
          private_share_pct: values.private_share_pct,
          is_kfz_pauschale: values.is_kfz_pauschale ?? false,
          mileage_km: values.is_kfz_pauschale ? values.mileage_km : null,
        }
        if (initial) {
          const { error } = await supabase
            .from("expense_entries")
            .update(payload)
            .eq("id", initial.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from("expense_entries")
            .insert(payload)
          if (error) throw error
        }
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Aktualisiert" : "Gespeichert")
      queryClient.invalidateQueries({ queryKey: [table] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = form.handleSubmit((v) => mutation.mutate(v))
  const title = kind === "income" ? t("addIncome") : t("addExpense")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Bearbeiten" : title}</DialogTitle>
          <DialogDescription>
            {scope === "business" ? t("scopeBusiness") : t("scopePersonal")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="occurred_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("occurredOn")}</FormLabel>
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
                    <FormLabel>{t("amount")} (€)</FormLabel>
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
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category")}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="— ohne —" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => {
                          const translated = translateCategoryName(c.name, tBanking)
                          const showGerman = showGermanLabels && translated !== c.name
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex flex-col items-start leading-tight">
                                <span className="flex items-center gap-2">
                                  <span>{translated}</span>
                                  {c.skr_code ? (
                                    <span className="text-muted-foreground font-mono text-[10px]">
                                      {c.skr_code}
                                    </span>
                                  ) : null}
                                </span>
                                {showGerman ? (
                                  <span className="text-muted-foreground/70 text-[9px] italic">
                                    {c.name}
                                  </span>
                                ) : null}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {kind === "income" ? "Quelle" : t("vendor")}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {kind === "expense" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="vat_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enthaltene USt %</FormLabel>
                      <FormControl>
                        <Select
                          value={String(field.value)}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 %</SelectItem>
                            <SelectItem value="7">7 %</SelectItem>
                            <SelectItem value="19">19 %</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="private_share_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Privat-Anteil %</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          onChange={field.onChange}
                          value={field.value as number | string}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {kind === "expense" && scope === "business" ? (
              <KfzPauschaleSection form={form} />
            ) : null}

            {kind === "expense" ? (
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zahlungsart</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="— wählen —">
                            {field.value
                              ? PAYMENT_METHOD_LABELS[
                                  field.value as keyof typeof PAYMENT_METHOD_LABELS
                                ] ?? field.value
                              : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bar">💵 Bar</SelectItem>
                          <SelectItem value="ec_karte">💳 EC / Girocard</SelectItem>
                          <SelectItem value="kreditkarte">💳 Kreditkarte</SelectItem>
                          <SelectItem value="ueberweisung">🏦 Überweisung (SEPA)</SelectItem>
                          <SelectItem value="lastschrift">🏦 Lastschrift / SEPA-DD</SelectItem>
                          <SelectItem value="paypal">🅿️ PayPal</SelectItem>
                          <SelectItem value="apple_pay">🍎 Apple Pay</SelectItem>
                          <SelectItem value="google_pay">🅖 Google Pay</SelectItem>
                          <SelectItem value="klarna">🅺 Klarna / Sofort</SelectItem>
                          <SelectItem value="andere">⚙️ Andere</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {kind === "expense" ? (
              <FormField
                control={form.control}
                name="is_deductible"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-xl border p-3">
                    <div className="grid gap-0.5">
                      <FormLabel>{t("deductible")}</FormLabel>
                      <p className="text-muted-foreground text-xs">
                        Als Betriebsausgabe absetzbar (EÜR-relevant).
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}

            {scope === "business" ? (
              <FormField
                control={form.control}
                name="jobcenter_relevant"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-xl border p-3">
                    <div className="grid gap-0.5">
                      <FormLabel>{t("jobcenterRelevant")}</FormLabel>
                      <p className="text-muted-foreground text-xs">
                        Fliesst in die Anlage EKS / Monatsmeldung ein.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="attachment_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beleg (PDF, JPG, PNG) — optional</FormLabel>
                  <FormControl>
                    <BelegUpload
                      currentPath={field.value ?? ""}
                      onChange={(path) => field.onChange(path)}
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
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Kfz-Pauschale Block ────────────────────────────────────────────────────

import type { UseFormReturn } from "react-hook-form"
import { Input as InputUi } from "@/components/ui/input"

function KfzPauschaleSection({ form }: { form: UseFormReturn<EntryInput> }) {
  return (
    <div className="bg-blue-500/10 border-blue-500/20 grid gap-3 rounded-xl border p-4">
      <FormField
        control={form.control}
        name="is_kfz_pauschale"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between gap-4">
            <div className="grid gap-0.5">
              <FormLabel>🚗 Geschäftliche Fahrt (Kfz-Pauschale §9 EStG)</FormLabel>
              <p className="text-muted-foreground text-xs">
                0,30 €/km — Betrag wird automatisch aus Kilometern berechnet.
              </p>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="mileage_km"
        render={({ field }) => {
          const km = Number(field.value) || 0
          const enabled = form.watch("is_kfz_pauschale")
          return (
            <FormItem className={enabled ? "" : "opacity-40 pointer-events-none"}>
              <FormLabel>Kilometer</FormLabel>
              <FormControl>
                <InputUi
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="z.B. 47,2"
                  value={field.value as number}
                  onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  name={field.name}
                />
              </FormControl>
              {km > 0 && enabled ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Berechnet: {km.toFixed(1)} km × 0,30 € ={" "}
                  <strong>
                    {(km * 0.3).toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    €
                  </strong>
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )
        }}
      />
    </div>
  )
}
