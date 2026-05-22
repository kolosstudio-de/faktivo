"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useSupabase } from "@/lib/hooks/use-supabase"
import type { NumberSequence } from "@/types/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatSequenceNumber } from "@/lib/numbering"

interface Props {
  sequences: NumberSequence[]
  userId: string
}

const LABELS: Record<string, string> = {
  invoice: "Rechnung",
  quote: "Angebot",
  credit_note: "Storno",
}

export function NumberSequencesTable({ sequences, userId }: Props) {
  const t = useTranslations("Settings")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (s: NumberSequence) => {
      const { error } = await supabase
        .from("number_sequences")
        .update({
          prefix: s.prefix,
          width: s.width,
          next_value: s.next_value,
        })
        .eq("user_id", userId)
        .eq("kind", s.kind)
        .eq("year", s.year)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t("saved"))
      queryClient.invalidateQueries({ queryKey: ["number_sequences"] })
    },
    onError: (e: Error) => {
      toast.error(e.message)
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
          <tr>
            <th className="p-3 text-left font-medium">Typ</th>
            <th className="p-3 text-left font-medium">{t("numberYear")}</th>
            <th className="p-3 text-left font-medium">Präfix</th>
            <th className="p-3 text-left font-medium">Breite</th>
            <th className="p-3 text-left font-medium">{t("nextValue")}</th>
            <th className="p-3 text-left font-medium">Vorschau</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {sequences.map((s) => (
            <SequenceRow
              key={`${s.kind}-${s.year}`}
              seq={s}
              onSave={(updated) => mutation.mutate(updated)}
              saving={mutation.isPending}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SequenceRow({
  seq,
  onSave,
  saving,
}: {
  seq: NumberSequence
  onSave: (s: NumberSequence) => void
  saving: boolean
}) {
  const [draft, setDraft] = React.useState(seq)
  const dirty =
    draft.prefix !== seq.prefix ||
    draft.width !== seq.width ||
    draft.next_value !== seq.next_value

  return (
    <tr className="border-t">
      <td className="p-3">
        <Badge variant="outline">{LABELS[seq.kind] ?? seq.kind}</Badge>
      </td>
      <td className="p-3 font-mono text-xs">{seq.year}</td>
      <td className="p-3">
        <Input
          value={draft.prefix}
          onChange={(e) => setDraft({ ...draft, prefix: e.target.value })}
          className="h-8 w-24"
          maxLength={10}
        />
      </td>
      <td className="p-3">
        <Input
          type="number"
          min={3}
          max={8}
          value={draft.width}
          onChange={(e) => setDraft({ ...draft, width: Number(e.target.value) })}
          className="h-8 w-20"
        />
      </td>
      <td className="p-3">
        <Input
          type="number"
          min={1}
          value={draft.next_value}
          onChange={(e) =>
            setDraft({ ...draft, next_value: Number(e.target.value) })
          }
          className="h-8 w-24"
        />
      </td>
      <td className="text-muted-foreground p-3 font-mono text-xs">
        {formatSequenceNumber(draft.prefix, draft.year, draft.next_value, draft.width)}
      </td>
      <td className="p-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!dirty || saving}
          onClick={() => onSave(draft)}
        >
          Speichern
        </Button>
      </td>
    </tr>
  )
}
