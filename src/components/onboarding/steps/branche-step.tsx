"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Info } from "lucide-react"

import { branchen, isKskRelevant } from "@/lib/data/branchen"
import type { OnboardingData } from "@/lib/validators/onboarding"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Props {
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
}

export function BrancheStep({ data, onChange }: Props) {
  const [open, setOpen] = React.useState(false)

  const selected = branchen.find((b) => b.wz === data.branche_wz_code)
  const kskRelevant = isKskRelevant(data.branche_wz_code)

  return (
    <div className="grid gap-5">
      <header className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Was machst du?
        </h2>
        <p className="text-muted-foreground text-sm">
          Wir nutzen den WZ-2008-Code für deine Kategorien (SKR03 / EÜR / KSK-Einstufung).
        </p>
      </header>

      <div className="grid gap-2">
        <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
          Branche
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-12 w-full justify-between text-left font-normal"
            >
              <span
                className={cn(
                  "truncate",
                  !selected && "text-muted-foreground"
                )}
              >
                {selected ? (
                  <>
                    <span className="font-medium">{selected.label}</span>
                    <span className="text-muted-foreground ml-2 font-mono text-xs">
                      WZ {selected.wz}
                    </span>
                  </>
                ) : (
                  "Branche wählen oder suchen …"
                )}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0"
            align="start"
            style={{ width: "var(--radix-popover-trigger-width)" }}
          >
            <Command>
              <CommandInput placeholder="Branche suchen …" />
              <CommandList>
                <CommandEmpty>Nichts gefunden.</CommandEmpty>
                <CommandGroup>
                  {branchen.map((b) => (
                    <CommandItem
                      key={b.wz}
                      value={`${b.label} ${b.labelRu ?? ""} ${b.labelUa ?? ""} ${b.wz}`}
                      onSelect={() => {
                        onChange({
                          branche_wz_code: b.wz,
                          branche_label: b.label,
                          is_ksk_abgabepflichtig: Boolean(b.kskRelevant),
                        })
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          data.branche_wz_code === b.wz
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="grid flex-1 leading-tight">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{b.label}</span>
                          {b.kskRelevant ? (
                            <span className="rounded-full bg-amber-500/15 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              KSK
                            </span>
                          ) : null}
                        </div>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          WZ {b.wz}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {kskRelevant ? (
        <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 grid gap-2 rounded-xl border border-amber-500/20 p-4 text-xs">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="size-4" />
            Achtung: Künstlersozialkasse (KSK) relevant
          </div>
          <p>
            Deine Branche fällt unter die Abgabepflicht der KSK (§ 24 KSVG). Wenn du Leistungen von Künstler:innen/Publizist:innen einkaufst, musst du **5 % KSK-Abgabe** abführen (Bagatellgrenze €450/Jahr). Wir aktivieren automatisch die KSK-Markierung auf deinen Ausgaben und erzeugen dir jährlich bis 31.03. den Meldebogen.
          </p>
        </div>
      ) : null}
    </div>
  )
}
