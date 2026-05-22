"use client"

import { legalForms } from "@/lib/data/legal-forms"
import type { OnboardingData } from "@/lib/validators/onboarding"
import { cn } from "@/lib/utils"
import { CheckCircle2 } from "lucide-react"

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

export function LegalFormStep({ data, onChange }: Props) {
  return (
    <div className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Was bist du rechtlich?
        </h2>
        <p className="text-muted-foreground text-sm">
          Davon hängt ab, welche Felder wir dir zeigen und welche Reports sinnvoll sind. Du kannst es später ändern.
        </p>
      </header>

      <div className="grid gap-2.5">
        {legalForms.map((form) => {
          const selected = data.legal_form === form.value
          return (
            <button
              key={form.value}
              type="button"
              onClick={() => onChange({ legal_form: form.value })}
              className={cn(
                "group flex items-start gap-4 rounded-2xl border p-4 text-left transition-all",
                "hover:border-primary/40 hover:bg-primary/5",
                selected
                  ? "border-primary bg-primary/5 ring-primary/20 ring-4"
                  : "border-border"
              )}
            >
              <span className="text-2xl">{form.emoji}</span>
              <div className="grid flex-1 gap-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {form.label}
                  {form.requiresHandelsregister ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                      HR-pflichtig
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {form.description}
                </p>
              </div>
              {selected ? (
                <CheckCircle2 className="text-primary size-5 shrink-0" />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
