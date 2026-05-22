"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Building2, Pencil, ArrowRight, Wallet } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { formatMoney } from "@/lib/money"
import { Link } from "@/i18n/navigation"

const COLOR_PRESETS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // rose
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#64748b", // slate
]

export interface BankAccountStats {
  monthIncomeCents: number
  monthExpenseCents: number
  monthNetCents: number
  yearIncomeCents: number
  yearExpenseCents: number
  yearNetCents: number
  txCount: number
  lastTxDate: string | null
  uniqueCounterparties: number
}

export interface BankAccountCardData {
  id: string
  iban: string | null
  last_4: string | null
  display_name: string | null
  card_color: string | null
  notes: string | null
  currency: string
  balance_cents: number | null
  owner_name: string | null
}

export function BankAccountCard({
  account,
  stats,
}: {
  account: BankAccountCardData
  stats: BankAccountStats
}) {
  const t = useTranslations("Banking")
  const router = useRouter()
  const [editOpen, setEditOpen] = React.useState(false)
  const [displayName, setDisplayName] = React.useState(
    account.display_name ?? "",
  )
  const [color, setColor] = React.useState(account.card_color ?? "#10b981")
  const [notes, setNotes] = React.useState(account.notes ?? "")
  const [saving, setSaving] = React.useState(false)

  const last4 = account.last_4 ?? account.iban?.replace(/\s+/g, "").slice(-4) ?? ""
  const accentColor = account.card_color ?? "#10b981"

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("bank_accounts")
      .update({
        display_name: displayName.trim() || null,
        card_color: color,
        notes: notes.trim() || null,
      })
      .eq("id", account.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(t("editCardSaved"))
    setEditOpen(false)
    router.refresh()
  }

  return (
    <Card className="relative overflow-hidden transition hover:shadow-md">
      {/* Color stripe */}
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      />
      <CardContent className="grid gap-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="grid size-10 place-items-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: accentColor }}
            >
              <Building2 className="size-5" />
            </div>
            <div className="grid leading-tight">
              <span className="text-sm font-semibold">
                {account.display_name ?? t("accountFallback")}
              </span>
              {last4 ? (
                <span className="text-muted-foreground font-mono text-[11px] tracking-wider">
                  •••• {last4}
                </span>
              ) : (
                <span className="text-muted-foreground text-[11px]">
                  {t("manualCsvImport")}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setEditOpen(true)}
            aria-label={t("cardEdit")}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>

        {/* Balance */}
        {typeof account.balance_cents === "number" ? (
          <div className="bg-muted/40 grid gap-0.5 rounded-lg border px-3 py-2">
            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
              {t("balanceLabel")}
            </span>
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatMoney(account.balance_cents)}
            </span>
          </div>
        ) : null}

        {/* Month stats */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <Stat
            label={t("cardMonthIncome")}
            value={formatMoney(stats.monthIncomeCents)}
            tone="positive"
          />
          <Stat
            label={t("cardMonthExpense")}
            value={formatMoney(-Math.abs(stats.monthExpenseCents))}
            tone="negative"
          />
          <Stat
            label={t("cardMonthNet")}
            value={formatMoney(stats.monthNetCents)}
            tone={stats.monthNetCents < 0 ? "negative" : "neutral"}
          />
        </div>

        {/* Year stats */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <Stat
            label={t("cardYearIncome")}
            value={formatMoney(stats.yearIncomeCents)}
            tone="positive"
            small
          />
          <Stat
            label={t("cardYearExpense")}
            value={formatMoney(-Math.abs(stats.yearExpenseCents))}
            tone="negative"
            small
          />
          <Stat
            label={t("cardYearNet")}
            value={formatMoney(stats.yearNetCents)}
            tone={stats.yearNetCents < 0 ? "negative" : "neutral"}
            small
          />
        </div>

        {/* Footer meta */}
        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px]">
          <span>
            {t("cardTxCount", { count: stats.txCount })}
            {stats.uniqueCounterparties > 0
              ? ` · ${t("cardCounterparties", { count: stats.uniqueCounterparties })}`
              : ""}
          </span>
          <span>
            {stats.lastTxDate
              ? `${t("cardLastTx")}: ${stats.lastTxDate}`
              : ""}
          </span>
        </div>

        {/* Notes */}
        {account.notes ? (
          <p className="text-muted-foreground bg-muted/30 rounded-md border px-2 py-1.5 text-[11px] italic">
            {account.notes}
          </p>
        ) : null}

        {/* CTA */}
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href={`/banking?account_id=${account.id}`}>
            <Wallet className="size-3.5" />
            {t("cardViewTx")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>

      {/* ─── Edit dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editCardTitle")}</DialogTitle>
            <DialogDescription>{t("editCardDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bank-acc-name">{t("editCardName")}</Label>
              <Input
                id="bank-acc-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("accountFallback")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("editCardColor")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-7 rounded-full border-2 transition ${
                      color === c
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                    aria-pressed={color === c}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-7 cursor-pointer p-0.5"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bank-acc-notes">{t("editCardNotes")}</Label>
              <Textarea
                id="bank-acc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "…" : t("editCardSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string
  value: string
  tone: "positive" | "negative" | "neutral"
  small?: boolean
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground"
  return (
    <div className="bg-muted/30 grid gap-0.5 rounded-md border px-1.5 py-1.5">
      <span className="text-muted-foreground text-[9px] uppercase tracking-wide leading-tight">
        {label}
      </span>
      <span
        className={`font-mono ${small ? "text-[11px]" : "text-xs"} font-semibold tabular-nums leading-tight ${toneClass}`}
      >
        {value}
      </span>
    </div>
  )
}
