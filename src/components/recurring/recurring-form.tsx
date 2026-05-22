"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type {
  RecurringExpense,
  RecurringFrequency,
  RecurringKind,
} from "@/types/database.types"

const KIND_EMOJI: Record<RecurringKind, string> = {
  subscription: "🎵",
  rent: "🏠",
  utility: "⚡",
  loan: "💳",
  insurance: "🛡️",
  membership: "🤝",
  leasing: "🚗",
  other: "📋",
}

const KIND_LABEL_KEY: Record<RecurringKind, string> = {
  subscription: "kindSubscription",
  rent: "kindRent",
  utility: "kindUtility",
  loan: "kindLoan",
  insurance: "kindInsurance",
  membership: "kindMembership",
  leasing: "kindLeasing",
  other: "kindOther",
}

const PM_LABELS: Record<string, string> = {
  bar: "💵 Bar",
  ec_karte: "💳 EC / Girocard",
  kreditkarte: "💳 Kreditkarte",
  ueberweisung: "🏦 Überweisung",
  lastschrift: "🏦 Lastschrift",
  paypal: "🅿️ PayPal",
  apple_pay: "🍎 Apple Pay",
  google_pay: "🅖 Google Pay",
  klarna: "🅺 Klarna",
  andere: "⚙️ Andere",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: RecurringExpense | null
  prefilledFromDetection?: {
    name: string
    vendor: string
    amountCents: number
    frequency: RecurringFrequency
    scope: "business" | "personal"
    kind: RecurringKind
    nextDue: string
  } | null
}

export function RecurringForm({
  open,
  onOpenChange,
  initial,
  prefilledFromDetection,
}: Props) {
  const t = useTranslations("Abos")
  const queryClient = useQueryClient()

  const today = new Date().toISOString().slice(0, 10)

  const [scope, setScope] = React.useState<"business" | "personal">(
    initial?.scope ?? prefilledFromDetection?.scope ?? "personal"
  )
  const [kind, setKind] = React.useState<RecurringKind>(
    initial?.kind ?? prefilledFromDetection?.kind ?? "subscription"
  )
  const [name, setName] = React.useState(
    initial?.name ?? prefilledFromDetection?.name ?? ""
  )
  const [vendor, setVendor] = React.useState(
    initial?.vendor ?? prefilledFromDetection?.vendor ?? ""
  )
  const [amount, setAmount] = React.useState<string>(
    initial
      ? (initial.amount_cents / 100).toFixed(2).replace(".", ",")
      : prefilledFromDetection
        ? (prefilledFromDetection.amountCents / 100).toFixed(2).replace(".", ",")
        : ""
  )
  const [frequency, setFrequency] = React.useState<RecurringFrequency>(
    initial?.frequency ?? prefilledFromDetection?.frequency ?? "monthly"
  )
  const [vatRate, setVatRate] = React.useState<number>(initial?.vat_rate ?? 19)
  const [paymentMethod, setPaymentMethod] = React.useState<string>(
    initial?.payment_method ?? "lastschrift"
  )
  const [startDate, setStartDate] = React.useState(
    initial?.start_date ?? today
  )
  const [endDate, setEndDate] = React.useState(initial?.end_date ?? "")
  const [nextDueDate, setNextDueDate] = React.useState(
    initial?.next_due_date ?? prefilledFromDetection?.nextDue ?? today
  )
  const [remainingPayments, setRemainingPayments] = React.useState<string>(
    initial?.remaining_payments != null ? String(initial.remaining_payments) : ""
  )
  const [totalAmount, setTotalAmount] = React.useState<string>(
    initial?.total_amount_cents != null
      ? (initial.total_amount_cents / 100).toFixed(2).replace(".", ",")
      : ""
  )
  const [active, setActive] = React.useState(initial?.active ?? true)
  const [notes, setNotes] = React.useState(initial?.notes ?? "")

  const parseAmt = (s: string) => {
    const cleaned = s.replace(/\./g, "").replace(",", ".").trim()
    const n = Number(cleaned)
    return Number.isFinite(n) ? Math.round(n * 100) : 0
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        scope,
        kind,
        name: name.trim(),
        vendor: vendor.trim() || null,
        amount_cents: parseAmt(amount),
        frequency,
        vat_rate: vatRate,
        payment_method: paymentMethod,
        start_date: startDate,
        end_date: endDate || null,
        next_due_date: nextDueDate,
        remaining_payments: remainingPayments
          ? Number(remainingPayments)
          : null,
        total_amount_cents: totalAmount ? parseAmt(totalAmount) : null,
        active,
        notes: notes.trim() || null,
      }

      const url = initial ? `/api/recurring/${initial.id}` : "/api/recurring"
      const method = initial ? "PATCH" : "POST"
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "save failed")
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success(initial ? t("updated") : t("created"))
      queryClient.invalidateQueries({ queryKey: ["recurring"] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!initial) return
      const r = await fetch(`/api/recurring/${initial.id}`, {
        method: "DELETE",
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.error ?? "delete failed")
      }
    },
    onSuccess: () => {
      toast.success(t("deleted"))
      queryClient.invalidateQueries({ queryKey: ["recurring"] })
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("formEditTitle") : t("formNewTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("formDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>{t("fieldScope")}</Label>
              <Select value={scope} onValueChange={(v) => v && setScope(v as "business" | "personal")}>
                <SelectTrigger>
                  <SelectValue>
                    {scope === "business" ? t("scopeBusiness") : t("scopePersonal")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">{t("scopePersonal")}</SelectItem>
                  <SelectItem value="business">{t("scopeBusiness")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>{t("fieldType")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as RecurringKind)}>
                <SelectTrigger>
                  <SelectValue>
                    {KIND_EMOJI[kind]} {t(KIND_LABEL_KEY[kind])}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL_KEY) as RecurringKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_EMOJI[k]} {t(KIND_LABEL_KEY[k])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("fieldName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("fieldNamePlaceholder")}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("fieldVendor")}</Label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder={t("fieldVendorPlaceholder")}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>{t("fieldAmount")}</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="9,99"
                className="text-right font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("fieldFrequency")}</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as RecurringFrequency)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {frequency === "monthly"
                      ? t("freqMonthlyLabel")
                      : frequency === "quarterly"
                        ? t("freqQuarterlyLabel")
                        : t("freqYearlyLabel")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t("freqMonthlyLabel")}</SelectItem>
                  <SelectItem value="quarterly">{t("freqQuarterlyLabel")}</SelectItem>
                  <SelectItem value="yearly">{t("freqYearlyLabel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("fieldVat")}</Label>
              <Select
                value={String(vatRate)}
                onValueChange={(v) => setVatRate(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue>{vatRate} %</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 %</SelectItem>
                  <SelectItem value="7">7 %</SelectItem>
                  <SelectItem value="19">19 %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>{t("fieldStart")}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("fieldNextDue")}</Label>
              <Input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("fieldEnd")}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {kind === "loan" || kind === "leasing" ? (
            <div className="bg-muted/40 grid gap-3 rounded-xl border p-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{t("fieldRemaining")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={remainingPayments}
                  onChange={(e) => setRemainingPayments(e.target.value)}
                  placeholder={t("fieldRemainingPlaceholder")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("fieldTotalLoan")}</Label>
                <Input
                  inputMode="decimal"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder={t("fieldTotalLoanPlaceholder")}
                  className="text-right font-mono"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label>{t("fieldPaymentMethod")}</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => v && setPaymentMethod(v)}
            >
              <SelectTrigger>
                <SelectValue>
                  {PM_LABELS[paymentMethod] ?? paymentMethod}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PM_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("fieldNotes")}</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("fieldNotesPlaceholder")}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <Label>{t("fieldActive")}</Label>
              <p className="text-muted-foreground text-xs">
                {t("fieldActiveHint")}
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter>
          {initial ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="text-destructive mr-auto"
            >
              <Trash2 />
              {t("delete")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !name.trim() || !amount.trim()}
          >
            {saveMut.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
