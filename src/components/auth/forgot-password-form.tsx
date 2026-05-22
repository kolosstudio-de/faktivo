"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { CheckCircle2, Loader2, Mail } from "lucide-react"

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

const schema = z.object({
  email: z.string().email("Ungültige E-Mail"),
})

type Values = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/de/reset-password`,
    })
    if (error) {
      toast.error("Fehler", { description: error.message })
      return
    }
    setSent(true)
    toast.success("Reset-Link versendet")
  })

  if (sent) {
    return (
      <div className="grid gap-3 text-center">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-full">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="text-sm font-medium">E-Mail versendet</p>
        <p className="text-muted-foreground text-xs">
          Prüfe deine E-Mail (lokal:{" "}
          <a
            href="http://127.0.0.1:54324"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Mailpit
          </a>
          ) und klicke auf den Link, um ein neues Passwort zu setzen.
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-3">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="du@kolos.digital"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          Reset-Link senden
        </Button>
      </form>
    </Form>
  )
}
