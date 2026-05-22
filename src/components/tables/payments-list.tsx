"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { formatMoney } from "@/lib/money"
import type { Payment } from "@/types/database.types"

interface Props {
  invoiceId: string
}

export function PaymentsList({ invoiceId }: Props) {
  const t = useTranslations("Payments")
  const supabase = useSupabase()

  const { data = [] } = useQuery({
    queryKey: ["payments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("paid_at", { ascending: false })
      if (error) throw error
      return data as Payment[]
    },
  })

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("empty")}
      </p>
    )
  }

  const methodLabel = (m: string) => {
    const labels: Record<string, string> = {
      bank_transfer: t("methods.bank_transfer"),
      cash: t("methods.cash"),
      crypto: t("methods.crypto"),
    }
    return labels[m] ?? m
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
          <tr>
            <th className="px-3 py-2 text-left font-medium">{t("date")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("method")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("reference")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{p.paid_at}</td>
              <td className="px-3 py-2">{methodLabel(p.method)}</td>
              <td className="text-muted-foreground px-3 py-2 text-xs">
                {p.reference ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatMoney(p.amount_cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
