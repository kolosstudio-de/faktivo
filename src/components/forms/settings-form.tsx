"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Building2, Landmark, Receipt, Save, Hash } from "lucide-react"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import {
  settingsSchema,
  type SettingsInput,
} from "@/lib/validators/settings"
import type { Settings, NumberSequence } from "@/types/database.types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberSequencesTable } from "./number-sequences-table"

interface Props {
  initial: Settings
  sequences: NumberSequence[]
}

export function SettingsForm({ initial, sequences }: Props) {
  const t = useTranslations("Settings")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      company_name: initial.company_name ?? "",
      address: {
        street: initial.address?.street ?? "",
        street2: initial.address?.street2 ?? "",
        zip: initial.address?.zip ?? "",
        city: initial.address?.city ?? "",
        country: initial.address?.country ?? "DE",
      },
      tax_id: initial.tax_id ?? "",
      ust_id: initial.ust_id ?? "",
      is_kleinunternehmer: initial.is_kleinunternehmer ?? true,
      iban: initial.iban ?? "",
      bic: initial.bic ?? "",
      bank_name: initial.bank_name ?? "",
      default_vat_rate: initial.default_vat_rate ?? 19,
      locale: (initial.locale as "de" | "en" | "ru" | "uk") ?? "de",
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: SettingsInput) => {
      const { error } = await supabase
        .from("settings")
        .update({
          company_name: values.company_name,
          address: values.address,
          tax_id: values.tax_id || null,
          ust_id: values.ust_id || null,
          is_kleinunternehmer: values.is_kleinunternehmer,
          iban: values.iban || null,
          bic: values.bic || null,
          bank_name: values.bank_name || null,
          default_vat_rate: values.default_vat_rate,
          locale: values.locale,
        })
        .eq("user_id", initial.user_id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t("saved"), { description: t("savedDesc") })
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (e: Error) => {
      toast.error(e.message)
    },
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values))

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-6">
        {/* COMPANY */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              {t("company")}
            </CardTitle>
            <CardDescription>
              {t("companyHint")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("companyName")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Vasyl Kolos" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("street")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Musterstraße 1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("zip")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="10115" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("city")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Berlin" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address.country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("country")}</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={2} placeholder="DE" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* TAX */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              {t("taxAndUst")}
            </CardTitle>
            <CardDescription>
              {t("taxAndUstHint")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("taxId")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="12/345/67890" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ust_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ustId")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="DE123456789" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_kleinunternehmer"
              render={({ field }) => (
                <FormItem className="bg-muted/40 flex flex-row items-start gap-3 rounded-xl border p-4">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="grid gap-1 leading-tight">
                    <FormLabel className="text-sm">
                      {t("isKleinunternehmer")}
                    </FormLabel>
                    <FormDescription className="text-xs">
                      {t("isKleinunternehmerHint")}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="default_vat_rate"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>{t("defaultVatRate")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="25"
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
          </CardContent>
        </Card>

        {/* BANK */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-4" />
              {t("banking")}
            </CardTitle>
            <CardDescription>
              {t("bankingHint")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="iban"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("iban")}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="DE89 3704 0044 0532 0130 00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="bic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("bic")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="COBADEFFXXX" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("bankName")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Commerzbank" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* LOCALE */}
        <Card>
          <CardHeader>
            <CardTitle>{t("locale")}</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="locale"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>{t("locale")}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? "de"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {({ de: "Deutsch", en: "English", ru: "Русский", uk: "Українська" } as Record<string, string>)[field.value] ?? field.value}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ru">Русский</SelectItem>
                        <SelectItem value="uk">Українська</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* NUMBER SEQUENCES */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="size-4" />
              {t("numbering")}
            </CardTitle>
            <CardDescription>
              {t("numberingHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NumberSequencesTable sequences={sequences} userId={initial.user_id} />
          </CardContent>
        </Card>

        {/* SAVE */}
        <div className="sticky bottom-4 flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={!form.formState.isDirty || mutation.isPending}
            className="shadow-lg"
          >
            <Save />
            {mutation.isPending ? t("save") + "…" : t("save")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
