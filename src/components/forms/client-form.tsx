"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Building2, User as UserIcon } from "lucide-react"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { clientSchema, type ClientInput } from "@/lib/validators/client"
import type { Client } from "@/types/database.types"
import { Button } from "@/components/ui/button"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  initial?: Client | null
  onSuccess?: (client: Client) => void
  onCancel?: () => void
}

export function ClientForm({ initial, onSuccess, onCancel }: Props) {
  const t = useTranslations("Clients")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: initial?.type ?? "company",
      company_name: initial?.company_name ?? "",
      first_name: initial?.first_name ?? "",
      last_name: initial?.last_name ?? "",
      email: initial?.email ?? "",
      phone: initial?.phone ?? "",
      address: {
        street: initial?.address?.street ?? "",
        street2: initial?.address?.street2 ?? "",
        zip: initial?.address?.zip ?? "",
        city: initial?.address?.city ?? "",
        country: initial?.address?.country ?? "DE",
      },
      tax_id: initial?.tax_id ?? "",
      ust_id: initial?.ust_id ?? "",
      country: initial?.country ?? "DE",
      notes: initial?.notes ?? "",
    },
  })

  const type = form.watch("type")

  const mutation = useMutation({
    mutationFn: async (values: ClientInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const payload = {
        type: values.type,
        company_name: values.company_name || null,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        email: values.email || null,
        phone: values.phone || null,
        address: values.address,
        tax_id: values.tax_id || null,
        ust_id: values.ust_id || null,
        country: values.country || "DE",
        notes: values.notes || null,
      }

      if (initial) {
        const { data, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", initial.id)
          .select()
          .single()
        if (error) throw error
        return data as Client
      } else {
        const { data, error } = await supabase
          .from("clients")
          .insert({ ...payload, user_id: user.id })
          .select()
          .single()
        if (error) throw error
        return data as Client
      }
    },
    onSuccess: (client) => {
      toast.success(initial ? "Gespeichert" : "Kunde angelegt")
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      onSuccess?.(client)
    },
    onError: (e: Error) => {
      toast.error(e.message)
    },
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values))

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-5">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("type")}</FormLabel>
              <FormControl>
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="company">
                      <Building2 className="mr-2 size-3.5" />
                      {t("typeCompany")}
                    </TabsTrigger>
                    <TabsTrigger value="person">
                      <UserIcon className="mr-2 size-3.5" />
                      {t("typePerson")}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {type === "company" ? (
          <FormField
            control={form.control}
            name="company_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("companyName")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ACME GmbH" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("firstName")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("lastName")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("email")}</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("phone")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="address.street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("street")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 md:grid-cols-[1fr_2fr_1fr]">
            <FormField
              control={form.control}
              name="address.zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("zip")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("city")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input {...field} maxLength={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="tax_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("taxId")}</FormLabel>
                <FormControl>
                  <Input {...field} />
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("notes")}</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("cancel")}
            </Button>
          ) : null}
          <Button type="submit" disabled={mutation.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Form>
  )
}
