"use client"

import * as React from "react"
import { Landmark } from "lucide-react"

import type { OnboardingData } from "@/lib/validators/onboarding"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

// Lightweight IBAN mod-97 check (RFC 13616). Returns true only for well-formed, valid-checksum IBAN.
function isValidIban(raw: string): boolean {
  const s = raw.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const rearranged = s.slice(4) + s.slice(0, 4)
  const numeric = rearranged
    .split("")
    .map((c) => (/\d/.test(c) ? c : (c.charCodeAt(0) - 55).toString()))
    .join("")
  // mod 97 with big-int emulation via chunks
  let mod = 0
  for (const digit of numeric) mod = (mod * 10 + Number(digit)) % 97
  return mod === 1
}

function prettyIban(s: string) {
  return s
    .replace(/\s+/g, "")
    .toUpperCase()
    .match(/.{1,4}/g)
    ?.join(" ") ?? s
}

export function BankingStep({ data, onChange }: Props) {
  const [raw, setRaw] = React.useState(() => prettyIban(data.iban ?? ""))
  const [prevIban, setPrevIban] = React.useState(data.iban)
  if (prevIban !== data.iban) {
    setPrevIban(data.iban)
    setRaw(prettyIban(data.iban ?? ""))
  }

  const trimmed = raw.replace(/\s+/g, "")
  const valid = trimmed.length === 0 || isValidIban(trimmed)

  return (
    <div className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Deine Bankverbindung
        </h2>
        <p className="text-muted-foreground text-sm">
          IBAN und BIC erscheinen im Rechnungs-Footer — deine Kunden brauchen sie für die Überweisung.
        </p>
      </header>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="iban">IBAN *</Label>
          <div className="relative">
            <Landmark className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="iban"
              value={raw}
              onChange={(e) => {
                const v = e.target.value
                setRaw(v)
                onChange({ iban: v.replace(/\s+/g, "").toUpperCase() })
              }}
              onBlur={() => setRaw(prettyIban(raw))}
              placeholder="DE89 3704 0044 0532 0130 00"
              className="pl-9 font-mono uppercase"
              aria-invalid={!valid}
            />
          </div>
          {!valid ? (
            <p className="text-destructive text-xs">
              IBAN-Prüfziffer passt nicht. Bitte kontrollieren.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="bic">BIC (optional)</Label>
            <Input
              id="bic"
              value={data.bic ?? ""}
              onChange={(e) => onChange({ bic: e.target.value.toUpperCase() })}
              maxLength={11}
              placeholder="COBADEFFXXX"
              className="font-mono uppercase"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bank_name">Bank-Name (optional)</Label>
            <Input
              id="bank_name"
              value={data.bank_name ?? ""}
              onChange={(e) => onChange({ bank_name: e.target.value })}
              placeholder="Commerzbank"
            />
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          Du kannst die Bankverbindung später in den Einstellungen ändern. Wir speichern sie verschlüsselt und niemals außerhalb der EU.
        </p>
      </div>
    </div>
  )
}
