"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { KeyRound, Loader2 } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
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

const schema = z
  .object({
    password: z.string().min(6, "Mindestens 6 Zeichen"),
    confirm: z.string().min(6),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirm"],
  })

type Values = z.infer<typeof schema>

export function ResetPasswordForm({ locale }: { locale: string }) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  })

  const onSubmit = form.handleSubmit(async ({ password }) => {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error("Fehler", { description: error.message })
      return
    }
    toast.success("Passwort aktualisiert")
    setTimeout(() => {
      window.location.href = `/${locale}/dashboard`
    }, 600)
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-3">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Neues Passwort</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bestätigen</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          Passwort speichern
        </Button>
      </form>
    </Form>
  )
}
