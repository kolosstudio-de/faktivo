"use client"

import { HeartHandshake, Info, Baby } from "lucide-react"

import type { OnboardingData } from "@/lib/validators/onboarding"
import { cn } from "@/lib/utils"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

/** Regelbedarfsstufen 1–6 per § 28 SGB XII (Stand 2026). */
const STUFEN: Array<{ value: "1" | "2" | "3" | "4" | "5" | "6"; label: string }> = [
  { value: "1", label: "Stufe 1 — Alleinstehende (563 €)" },
  { value: "2", label: "Stufe 2 — Paare (506 €)" },
  { value: "3", label: "Stufe 3 — Erwachsene in BG (451 €)" },
  { value: "4", label: "Stufe 4 — Jugendliche 14–17 (471 €)" },
  { value: "5", label: "Stufe 5 — Kinder 6–13 (390 €)" },
  { value: "6", label: "Stufe 6 — Kinder unter 6 (357 €)" },
]

export function BuergergeldStep({ data, onChange }: Props) {
  const enabled = Boolean(data.receives_buergergeld)

  const bedarfEuros =
    typeof data.buergergeld_bedarf_monatlich_cents === "number"
      ? (data.buergergeld_bedarf_monatlich_cents / 100).toFixed(2)
      : ""

  return (
    <div className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Bekommst du Bürgergeld?
        </h2>
        <p className="text-muted-foreground text-sm">
          Viele Selbstständige sind Aufstocker. Wenn du regelmäßig eine <b>Anlage EKS</b> an dein Jobcenter abgibst, aktivieren wir dafür ein spezielles Modul.{" "}
          <span className="sr-only">EKS: Erklärung Einkommen Selbständige.</span>
        </p>
      </header>

      <div className="grid gap-4">
        <div
          className={cn(
            "flex items-start gap-4 rounded-2xl border p-5 transition-all",
            enabled
              ? "border-primary bg-primary/5 ring-primary/20 ring-4"
              : "border-border bg-muted/30"
          )}
        >
          <Switch
            id="receives_buergergeld"
            checked={enabled}
            onCheckedChange={(v) => onChange({ receives_buergergeld: v })}
          />
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="receives_buergergeld" className="flex items-center gap-2 text-base">
              <HeartHandshake className="size-4" />
              Ja, ich bin Aufstocker / Bürgergeld-Empfänger
            </Label>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Wir berechnen monatlich deine <b>EKS-Vorschau</b> (Einnahmen − jobcenter-relevante Ausgaben) und generieren den Meldebogen für&apos;s Ende deines Bewilligungszeitraums. Das ist unique — andere Tools können das nicht.
            </p>
          </div>
        </div>

        {enabled ? (
          <div className="grid animate-in fade-in slide-in-from-top-2 gap-4 duration-300">
            <div className="grid gap-2">
              <Label htmlFor="jobcenter_name">Zuständiges Jobcenter</Label>
              <Input
                id="jobcenter_name"
                value={data.jobcenter_name ?? ""}
                onChange={(e) => onChange({ jobcenter_name: e.target.value })}
                placeholder="Jobcenter Berlin Mitte"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="jobcenter_bg_nummer">
                Bedarfsgemeinschafts-Nummer (BG-Nr.)
              </Label>
              <Input
                id="jobcenter_bg_nummer"
                value={data.jobcenter_bg_nummer ?? ""}
                onChange={(e) =>
                  onChange({ jobcenter_bg_nummer: e.target.value })
                }
                placeholder="12345BG0123456"
                className="font-mono"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bwz_start">Bewilligungszeitraum — von</Label>
                <Input
                  id="bwz_start"
                  type="date"
                  value={data.bewilligungszeitraum_start ?? ""}
                  onChange={(e) =>
                    onChange({ bewilligungszeitraum_start: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bwz_end">Bewilligungszeitraum — bis</Label>
                <Input
                  id="bwz_end"
                  type="date"
                  value={data.bewilligungszeitraum_end ?? ""}
                  onChange={(e) =>
                    onChange({ bewilligungszeitraum_end: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bedarf">Monatlicher Bedarf (€)</Label>
                <Input
                  id="bedarf"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={bedarfEuros}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (!v) {
                      onChange({ buergergeld_bedarf_monatlich_cents: undefined })
                      return
                    }
                    const f = Number.parseFloat(v.replace(",", "."))
                    if (!Number.isFinite(f) || f < 0) return
                    onChange({
                      buergergeld_bedarf_monatlich_cents: Math.round(f * 100),
                    })
                  }}
                  placeholder="1063,00"
                />
                <p className="text-muted-foreground text-[10px]">
                  Regelbedarf + KdU + Mehrbedarfe (siehe letzter Bescheid).
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stufe">Regelbedarfsstufe</Label>
                <Select
                  value={data.regelbedarf_stufe ?? ""}
                  onValueChange={(v) =>
                    onChange({
                      regelbedarf_stufe: v as
                        | "1"
                        | "2"
                        | "3"
                        | "4"
                        | "5"
                        | "6",
                    })
                  }
                >
                  <SelectTrigger id="stufe">
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {STUFEN.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className={cn(
                "flex items-start gap-4 rounded-2xl border p-4 transition-all",
                data.has_minor_children
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-muted/20"
              )}
            >
              <Switch
                id="has_minor_children"
                checked={Boolean(data.has_minor_children)}
                onCheckedChange={(v) => onChange({ has_minor_children: v })}
              />
              <div className="grid flex-1 gap-1">
                <Label
                  htmlFor="has_minor_children"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Baby className="size-4" />
                  Minderjähriges Kind in der Bedarfsgemeinschaft
                </Label>
                <p className="text-muted-foreground text-[11px]">
                  Erhöht den anrechnungsfreien Freibetrag bei den
                  Erwerbseinkommen (§ 11b SGB II).
                </p>
              </div>
            </div>

            <div className="bg-blue-500/10 text-blue-800 dark:text-blue-300 flex items-start gap-2.5 rounded-xl border border-blue-500/20 p-3 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Diese Daten findest du auf deinem letzten Bewilligungsbescheid. Sie sind nötig, um die EKS-Vergleichszahlen Prognose vs. Ist auszurechnen.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
