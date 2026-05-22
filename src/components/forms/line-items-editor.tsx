"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form"
import { GripVertical, Plus, Trash2 } from "lucide-react"

import {
  computeLineTotals,
  formatMoney,
  parseCents,
  sumDocumentTotals,
  vatBreakdown,
  type LineTotals,
} from "@/lib/money"
import type { DocumentInput } from "@/lib/validators/document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const VAT_OPTIONS = ["0", "7", "19"] as const
const UNIT_OPTIONS = ["Stk", "Std", "h", "Tag", "Pauschale", "km"] as const

interface Props {
  isKleinunternehmer: boolean
}

export function LineItemsEditor({ isKleinunternehmer }: Props) {
  const tItems = useTranslations("LineItems")
  const tInvoice = useTranslations("Invoices")
  const { control, register, setValue } = useFormContext<DocumentInput>()
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  })

  const handleAdd = () => {
    append({
      position: fields.length + 1,
      description: "",
      quantity: 1,
      unit: "Stk",
      unit_code: "",
      unit_price_cents: 0,
      vat_rate: isKleinunternehmer ? 0 : 19,
      discount_pct: 0,
    })
  }

  const handleRemove = (index: number) => {
    remove(index)
    // Re-number positions
    setTimeout(() => {
      fields.forEach((_, i) => {
        setValue(`lines.${i}.position`, i + 1, { shouldDirty: true })
      })
    }, 0)
  }

  return (
    <div className="grid gap-3">
      {fields.map((field, index) => (
        <LineRow
          key={field.id}
          index={index}
          control={control}
          register={register}
          isKleinunternehmer={isKleinunternehmer}
          onRemove={() => handleRemove(index)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="justify-self-start"
      >
        <Plus />
        {tItems("add")}
      </Button>

      <Separator className="mt-2" />

      <DocumentTotals isKleinunternehmer={isKleinunternehmer} />

      {isKleinunternehmer ? (
        <Badge variant="secondary" className="bg-muted gap-2 self-start text-xs">
          §19 UStG — {tInvoice("isKleinunternehmer")}
        </Badge>
      ) : null}
    </div>
  )
}

function LineRow({
  index,
  control,
  register,
  isKleinunternehmer,
  onRemove,
}: {
  index: number
  control: Control<DocumentInput>
  register: UseFormRegister<DocumentInput>
  isKleinunternehmer: boolean
  onRemove: () => void
}) {
  const line = useWatch({ control, name: `lines.${index}` })

  const totals: LineTotals = React.useMemo(() => {
    const effectiveVat = isKleinunternehmer ? 0 : Number(line?.vat_rate ?? 0)
    return computeLineTotals({
      quantity: Number(line?.quantity ?? 0),
      unitPriceCents: Number(line?.unit_price_cents ?? 0),
      vatRatePct: effectiveVat,
      discountPct: Number(line?.discount_pct ?? 0),
    })
  }, [
    line?.quantity,
    line?.unit_price_cents,
    line?.vat_rate,
    line?.discount_pct,
    isKleinunternehmer,
  ])

  const { setValue } = useFormContext<DocumentInput>()

  const tItems = useTranslations("LineItems")

  return (
    <div className="bg-card grid gap-3 rounded-xl border p-3">
      {/* Row 1: drag handle + description + delete */}
      <div className="flex items-start gap-2">
        <GripVertical className="text-muted-foreground mt-2 size-4 shrink-0" />
        <Textarea
          rows={1}
          placeholder={tItems("description")}
          {...register(`lines.${index}.description`)}
          className="min-h-9 flex-1 resize-y"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
          aria-label={tItems("remove") ?? "Entfernen"}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Row 2: numeric controls — 2-col on mobile, 3-col on sm, 6-col on lg+ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-[90px_90px_minmax(0,1fr)_90px_90px_minmax(0,1fr)] lg:items-end">
        <NumField
          label={tItems("quantity")}
          inputClassName="text-right"
          {...register(`lines.${index}.quantity`)}
          step="0.01"
          min="0"
        />

        <FieldWrap label={tItems("unit")}>
          <Select
            defaultValue={line?.unit ?? "Stk"}
            onValueChange={(v) =>
              setValue(`lines.${index}.unit`, v ?? "Stk", { shouldDirty: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldWrap>

        <FieldWrap label={tItems("unitPrice")}>
          <MoneyInput
            value={Number(line?.unit_price_cents ?? 0)}
            onChange={(cents) =>
              setValue(`lines.${index}.unit_price_cents`, cents, { shouldDirty: true })
            }
          />
        </FieldWrap>

        <FieldWrap label={tItems("vatRate")}>
          <Select
            disabled={isKleinunternehmer}
            value={String(isKleinunternehmer ? 0 : line?.vat_rate ?? 0)}
            onValueChange={(v) =>
              setValue(`lines.${index}.vat_rate`, Number(v), { shouldDirty: true })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {String(isKleinunternehmer ? 0 : line?.vat_rate ?? 0)}%
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VAT_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldWrap>

        <NumField
          label={tItems("discount")}
          inputClassName="text-right"
          {...register(`lines.${index}.discount_pct`)}
          step="0.01"
          min="0"
          max="100"
        />

        <FieldWrap label={tItems("lineTotal")}>
          <div className="bg-muted/40 flex h-9 items-center justify-end rounded-md border border-dashed px-3 text-right font-mono text-sm font-medium tabular-nums">
            {formatMoney(totals.lineTotalCents)}
          </div>
        </FieldWrap>
      </div>
    </div>
  )
}

function FieldWrap({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

const NumField = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string
    inputClassName?: string
  }
>(function NumField({ label, inputClassName, ...rest }, ref) {
  return (
    <FieldWrap label={label}>
      <Input ref={ref} type="number" className={inputClassName} {...rest} />
    </FieldWrap>
  )
})

/** Money-editing input that tracks cents but displays formatted DE amount. */
function MoneyInput({
  value,
  onChange,
}: {
  value: number
  onChange: (cents: number) => void
}) {
  const formatCents = (v: number) =>
    v ? new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(v / 100) : ""

  const [raw, setRaw] = React.useState(() => formatCents(value))
  const [prevValue, setPrevValue] = React.useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setRaw((cur) => (parseCents(cur) === value ? cur : formatCents(value)))
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value)
        onChange(parseCents(e.target.value))
      }}
      onBlur={() => {
        const c = parseCents(raw)
        setRaw(
          c
            ? new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2 }).format(c / 100)
            : ""
        )
      }}
      placeholder="0,00"
      className="text-right"
    />
  )
}

function DocumentTotals({
  isKleinunternehmer,
}: {
  isKleinunternehmer: boolean
}) {
  const t = useTranslations("Invoices")
  const { control } = useFormContext<DocumentInput>()
  const lines = useWatch({ control, name: "lines" }) ?? []

  const perLine: LineTotals[] = lines.map((l) =>
    computeLineTotals({
      quantity: Number(l?.quantity ?? 0),
      unitPriceCents: Number(l?.unit_price_cents ?? 0),
      vatRatePct: isKleinunternehmer ? 0 : Number(l?.vat_rate ?? 0),
      discountPct: Number(l?.discount_pct ?? 0),
    })
  )

  const totals = sumDocumentTotals(perLine, { isKleinunternehmer })

  const breakdown = vatBreakdown(
    lines.map((l, i) => ({
      vat_rate: isKleinunternehmer ? 0 : Number(l?.vat_rate ?? 0),
      line_subtotal_cents: perLine[i].lineSubtotalCents,
      line_vat_cents: perLine[i].lineVatCents,
    }))
  )

  return (
    <div className="bg-muted/30 ml-auto w-full max-w-sm rounded-xl border p-4 text-sm">
      <div className="flex items-center justify-between py-1">
        <span className="text-muted-foreground">{t("subtotal")}</span>
        <span className="font-medium tabular-nums">
          {formatMoney(totals.subtotalCents)}
        </span>
      </div>
      {!isKleinunternehmer &&
        breakdown.map((b) => (
          <div
            key={b.rate}
            className="text-muted-foreground flex items-center justify-between py-0.5 text-xs"
          >
            <span>
              {t("vat")} {b.rate}%
            </span>
            <span className="tabular-nums">{formatMoney(b.vatCents)}</span>
          </div>
        ))}
      <Separator className="my-2" />
      <div className="flex items-center justify-between py-1 text-base font-semibold">
        <span>{t("total")}</span>
        <span className="tabular-nums">{formatMoney(totals.totalCents)}</span>
      </div>
    </div>
  )
}
