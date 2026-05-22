"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { useSupabase } from "@/lib/hooks/use-supabase"
import type { Client } from "@/types/database.types"
import { clientDisplayName } from "@/lib/utils/client-display"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ClientForm } from "./client-form"

interface Props {
  value?: string
  onChange: (clientId: string, client: Client) => void
  placeholder?: string
}

export function ClientCombobox({ value, onChange, placeholder = "Kunde wählen …" }: Props) {
  const supabase = useSupabase()
  const [open, setOpen] = React.useState(false)
  const [newOpen, setNewOpen] = React.useState(false)

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", "for-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as Client[]
    },
  })

  const selected = React.useMemo(
    () => clients.find((c) => c.id === value) ?? null,
    [clients, value]
  )

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? clientDisplayName(selected) : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
          <Command>
            <CommandInput placeholder="Suchen …" />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Lädt …" : "Keine Kunden gefunden."}
              </CommandEmpty>
              <CommandGroup>
                {clients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${clientDisplayName(c)} ${c.email ?? ""} ${c.ust_id ?? ""}`}
                    onSelect={() => {
                      onChange(c.id, c)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === c.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="grid flex-1 leading-tight">
                      <span className="truncate text-sm">
                        {clientDisplayName(c)}
                      </span>
                      {c.email ? (
                        <span className="text-muted-foreground truncate text-xs">
                          {c.email}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setNewOpen(true)
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Neuen Kunden anlegen
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neuer Kunde</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSuccess={(c) => {
              onChange(c.id, c)
              setNewOpen(false)
            }}
            onCancel={() => setNewOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
