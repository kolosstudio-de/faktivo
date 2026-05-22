"use client"

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Check, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  locale: string
  ctaLabel: string
}

export function WaitlistForm({ locale, ctaLabel }: Props) {
  const [email, setEmail] = React.useState("")
  const [done, setDone] = React.useState(false)

  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          referrer:
            typeof document !== "undefined" ? document.referrer : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Konnte nicht speichern")
      }
    },
    onSuccess: () => {
      setDone(true)
      toast.success("Wir benachrichtigen dich beim Launch!")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (done) {
    return (
      <div className="bg-primary/10 text-primary flex items-center justify-center gap-2 rounded-xl border border-primary/20 px-4 py-3 text-sm">
        <Check className="size-4" />
        Du stehst auf der Liste. Wir sind bald am Start.
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (email.trim()) mut.mutate()
      }}
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
    >
      <div className="relative">
        <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="email"
          required
          placeholder="du@kolos.digital"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 pl-9"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={mut.isPending || !email.trim()}
      >
        {mut.isPending ? <Loader2 className="animate-spin" /> : null}
        {ctaLabel}
      </Button>
    </form>
  )
}
