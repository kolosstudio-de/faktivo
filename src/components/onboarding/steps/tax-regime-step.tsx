"use client"

import { Info, Percent, Sparkles } from "lucide-react"

import type { OnboardingData } from "@/lib/validators/onboarding"
import { cn } from "@/lib/utils"
import {
  KLEINUNTERNEHMER_THRESHOLD_CURRENT_YEAR_EUR,
  KLEINUNTERNEHMER_THRESHOLD_PRIOR_YEAR_EUR,
} from "@/lib/vat"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

export function TaxRegimeStep({ data, onChange }: Props) {
  const regime = data.tax_regime ?? "kleinunternehmer"

  return (
    <div className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Wie wirst du besteuert?
        </h2>
        <p className="text-muted-foreground text-sm">
          Wenn du dir unsicher bist — Kleinunternehmer ist der typische Start. Du kannst später wechseln.
        </p>
      </header>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => onChange({ tax_regime: "kleinunternehmer" })}
          className={cn(
            "grid gap-2 rounded-2xl border p-5 text-left transition-all",
            "hover:border-primary/40 hover:bg-primary/5",
            regime === "kleinunternehmer"
              ? "border-primary bg-primary/5 ring-primary/20 ring-4"
              : "border-border"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="text-primary size-5" />
            <span className="text-base font-medium">
              § 19 Kleinunternehmer
            </span>
            <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              Empfohlen für den Start
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Keine Umsatzsteuer auf Rechnungen, keine UStVA, einfachere Buchhaltung. Bedingungen (Jahressteuergesetz 2024):
          </p>
          <ul className="text-muted-foreground grid gap-1 pl-1 text-xs">
            <li>
              · Vorjahresumsatz ≤{" "}
              <span className="text-foreground font-mono">
                {KLEINUNTERNEHMER_THRESHOLD_PRIOR_YEAR_EUR.toLocaleString("de-DE")} €
              </span>
            </li>
            <li>
              · Laufendes Jahr ≤{" "}
              <span className="text-foreground font-mono">
                {KLEINUNTERNEHMER_THRESHOLD_CURRENT_YEAR_EUR.toLocaleString("de-DE")} €
              </span>{" "}
              (harter Deckel seit 2025 — darüber sofort Regelbesteuerung)
            </li>
            <li>
              · Einnahmen sind <b>steuerfrei</b> (§ 4 UStG), kein Vorsteuerabzug
            </li>
          </ul>
        </button>

        <button
          type="button"
          onClick={() => onChange({ tax_regime: "regelbesteuerung" })}
          className={cn(
            "grid gap-2 rounded-2xl border p-5 text-left transition-all",
            "hover:border-primary/40 hover:bg-primary/5",
            regime === "regelbesteuerung"
              ? "border-primary bg-primary/5 ring-primary/20 ring-4"
              : "border-border"
          )}
        >
          <div className="flex items-center gap-2.5">
            <Percent className="size-5 text-sky-600 dark:text-sky-400" />
            <span className="text-base font-medium">Regelbesteuerung</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Standardfall: 19% USt auf Rechnungen, monatliche/quartalsweise UStVA, dafür Vorsteuerabzug möglich.
          </p>
        </button>
      </div>

      <div className="grid gap-4 border-t pt-5">
        <div className="grid gap-2">
          <Label htmlFor="tax_id" className="text-sm">
            Steuernummer{" "}
            <span className="text-muted-foreground text-xs">
              (von deinem Finanzamt)
            </span>
          </Label>
          <Input
            id="tax_id"
            value={data.tax_id ?? ""}
            onChange={(e) => onChange({ tax_id: e.target.value })}
            placeholder="12/345/67890"
          />
        </div>

        {regime === "regelbesteuerung" ? (
          <div className="grid gap-2">
            <Label htmlFor="ust_id" className="text-sm">
              USt-IdNr.{" "}
              <span className="text-muted-foreground text-xs">
                (optional, bei EU-B2B-Geschäft empfohlen)
              </span>
            </Label>
            <Input
              id="ust_id"
              value={data.ust_id ?? ""}
              onChange={(e) => onChange({ ust_id: e.target.value })}
              placeholder="DE123456789"
            />
          </div>
        ) : null}

        <div className="bg-muted/50 flex items-start gap-2.5 rounded-xl border p-3 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0 opacity-60" />
          <p className="text-muted-foreground">
            §14 UStG verlangt entweder Steuernummer <b>oder</b> USt-IdNr. auf jeder Rechnung. Du kannst das auch später in den Einstellungen eintragen.
          </p>
        </div>
      </div>
    </div>
  )
}
