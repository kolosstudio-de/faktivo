"use client"

import type { OnboardingData } from "@/lib/validators/onboarding"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
  showErrors?: boolean
  errors?: string[]
}

export function AddressStep({ data, onChange, showErrors, errors = [] }: Props) {
  const isCompany = data.legal_form
    ? ["ug", "gmbh", "gbr", "kg", "ohg"].includes(data.legal_form)
    : false
  const invalid = (key: string) => showErrors && errors.includes(key)

  return (
    <div className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Deine Anschrift & Kontakt
        </h2>
        <p className="text-muted-foreground text-sm">
          Diese Daten erscheinen im Briefkopf jeder Rechnung und jedes Angebots (§14 UStG).
        </p>
      </header>

      <div className="grid gap-4">
        {isCompany ? (
          <div className="grid gap-2">
            <Label htmlFor="company_name">Firmenname *</Label>
            <Input
              id="company_name"
              value={data.company_name ?? ""}
              onChange={(e) => onChange({ company_name: e.target.value })}
              placeholder="Mustermann GmbH"
              aria-invalid={invalid("company_name")}
            />
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="first_name">Vorname *</Label>
            <Input
              id="first_name"
              value={data.first_name ?? ""}
              onChange={(e) => onChange({ first_name: e.target.value })}
              aria-invalid={invalid("first_name")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last_name">Nachname *</Label>
            <Input
              id="last_name"
              value={data.last_name ?? ""}
              onChange={(e) => onChange({ last_name: e.target.value })}
              aria-invalid={invalid("last_name")}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="street">Straße & Nr. *</Label>
          <Input
            id="street"
            value={data.street ?? ""}
            onChange={(e) => onChange({ street: e.target.value })}
            placeholder="Musterstraße 1"
            aria-invalid={invalid("street")}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_2fr_1fr]">
          <div className="grid gap-2">
            <Label htmlFor="zip">PLZ *</Label>
            <Input
              id="zip"
              value={data.zip ?? ""}
              onChange={(e) => onChange({ zip: e.target.value })}
              maxLength={5}
              placeholder="10115"
              aria-invalid={invalid("zip")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="city">Stadt *</Label>
            <Input
              id="city"
              value={data.city ?? ""}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="Berlin"
              aria-invalid={invalid("city")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">Land</Label>
            <Input
              id="country"
              value={data.country ?? "DE"}
              onChange={(e) => onChange({ country: e.target.value.toUpperCase() })}
              maxLength={2}
              placeholder="DE"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="phone">
              Telefon{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              value={data.phone ?? ""}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="+49 30 12345678"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="website">
              Website{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="website"
              type="url"
              value={data.website ?? ""}
              onChange={(e) => onChange({ website: e.target.value })}
              placeholder="https://example.de"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
