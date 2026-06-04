"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"
import type { OnboardingData, OnboardingStep } from "@/lib/validators/onboarding"
import { STEPS, TOTAL_STEPS } from "@/lib/validators/onboarding"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

import { WelcomeStep } from "./steps/welcome-step"
import { LegalFormStep } from "./steps/legal-form-step"
import { BrancheStep } from "./steps/branche-step"
import { TaxRegimeStep } from "./steps/tax-regime-step"
import { AddressStep } from "./steps/address-step"
import { BankingStep } from "./steps/banking-step"
import { BuergergeldStep } from "./steps/buergergeld-step"
import { DoneStep } from "./steps/done-step"

// Skip-Confirm-Token wird per Locale aus `messages/*.json::Onboarding.skipConfirmToken`
// gezogen — de: "VERSTANDEN", en: "UNDERSTOOD", ru: "ПОНИМАЮ", uk: "РОЗУМІЮ".
// Der frühere globale Konstante `SKIP_CONFIRM_TOKEN = "VERSTANDEN"` zwang
// alle Nicht-DE-Nutzer ein deutsches Wort einzutippen — siehe Regression
// 2026-06-03, Issue #4.

/**
 * Minimum-required fields before the wizard can be skipped.
 * Order matches the steps so the missing-field list deep-links cleanly.
 */
interface SkipValidation {
  missing: string[]
  buergergeldMissing: string[]
}

function validateSkipReadiness(data: OnboardingData): SkipValidation {
  const missing: string[] = []
  if (!data.first_name?.trim()) missing.push("first_name")
  if (!data.last_name?.trim()) missing.push("last_name")
  if (!data.iban?.trim()) missing.push("iban")
  if (!data.street?.trim()) missing.push("street")
  if (!data.zip?.trim()) missing.push("zip")
  if (!data.city?.trim()) missing.push("city")

  const buergergeldMissing: string[] = []
  if (data.receives_buergergeld) {
    if (!data.bewilligungszeitraum_start?.trim())
      buergergeldMissing.push("bewilligungszeitraum_start")
    if (!data.bewilligungszeitraum_end?.trim())
      buergergeldMissing.push("bewilligungszeitraum_end")
    if (
      !data.buergergeld_bedarf_monatlich_cents ||
      data.buergergeld_bedarf_monatlich_cents <= 0
    )
      buergergeldMissing.push("buergergeld_bedarf_monatlich_cents")
    if (!data.regelbedarf_stufe)
      buergergeldMissing.push("regelbedarf_stufe")
  }
  return { missing, buergergeldMissing }
}

/**
 * Per-step validation. Returns list of missing-field keys (or IBAN error).
 * Empty array = step is complete.
 */
function validateStep(
  step: OnboardingStep,
  data: OnboardingData
): string[] {
  const missing: string[] = []

  const isCompany =
    data.legal_form &&
    ["ug", "gmbh", "gbr", "kg", "ohg"].includes(data.legal_form)

  switch (step) {
    case "welcome":
    case "done":
      return []
    case "legal_form":
      if (!data.legal_form) missing.push("legal_form")
      break
    case "branche":
      if (!data.branche_wz_code) missing.push("branche")
      break
    case "tax_regime":
      if (!data.tax_regime) missing.push("tax_regime")
      // tax_id is technically optional at this stage — we allow proceed, it can be added later in Settings.
      break
    case "address":
      if (!data.first_name?.trim()) missing.push("first_name")
      if (!data.last_name?.trim()) missing.push("last_name")
      if (isCompany && !data.company_name?.trim()) missing.push("company_name")
      if (!data.street?.trim()) missing.push("street")
      if (!data.zip?.trim() || (data.zip ?? "").replace(/\s/g, "").length < 4)
        missing.push("zip")
      if (!data.city?.trim()) missing.push("city")
      break
    case "banking":
      if (!data.iban?.trim()) missing.push("iban")
      else if (!isValidIbanCheck(data.iban)) missing.push("iban_invalid")
      break
    case "buergergeld":
      // Toggle can be off — nothing required then.
      if (data.receives_buergergeld) {
        if (!data.jobcenter_name?.trim()) missing.push("jobcenter_name")
        if (!data.bewilligungszeitraum_start?.trim())
          missing.push("bewilligungszeitraum_start")
        if (!data.bewilligungszeitraum_end?.trim())
          missing.push("bewilligungszeitraum_end")
        // _end must be > _start when both provided
        if (
          data.bewilligungszeitraum_start &&
          data.bewilligungszeitraum_end &&
          data.bewilligungszeitraum_end <= data.bewilligungszeitraum_start
        ) {
          missing.push("bwz_range_invalid")
        }
        if (
          !data.buergergeld_bedarf_monatlich_cents ||
          data.buergergeld_bedarf_monatlich_cents <= 0
        )
          missing.push("buergergeld_bedarf_monatlich_cents")
        if (!data.regelbedarf_stufe) missing.push("regelbedarf_stufe")
      }
      break
  }
  return missing
}

// Shared IBAN validator (mirrors banking-step.tsx)
function isValidIbanCheck(rawInput: string): boolean {
  const s = rawInput.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false
  const rearranged = s.slice(4) + s.slice(0, 4)
  const numeric = rearranged
    .split("")
    .map((c) => (/\d/.test(c) ? c : (c.charCodeAt(0) - 55).toString()))
    .join("")
  let mod = 0
  for (const d of numeric) mod = (mod * 10 + Number(d)) % 97
  return mod === 1
}

const ERROR_LABEL: Record<string, string> = {
  legal_form: "Wähle deine Rechtsform",
  branche: "Wähle deine Branche",
  tax_regime: "Wähle dein Steuer-Regime",
  first_name: "Vorname fehlt",
  last_name: "Nachname fehlt",
  company_name: "Firmenname fehlt (bei UG/GmbH/GbR)",
  street: "Straße fehlt",
  zip: "PLZ fehlt",
  city: "Stadt fehlt",
  iban: "IBAN fehlt",
  iban_invalid: "IBAN-Prüfziffer ungültig",
  jobcenter_name: "Jobcenter-Name fehlt",
  bewilligungszeitraum_start: "Bewilligungszeitraum-Start fehlt",
  bewilligungszeitraum_end: "Bewilligungszeitraum-Ende fehlt",
  bwz_range_invalid: "Ende muss nach Start liegen",
  buergergeld_bedarf_monatlich_cents: "Monatlicher Bedarf fehlt",
  regelbedarf_stufe: "Regelbedarfsstufe fehlt",
}

interface Props {
  userId: string
  initialStep: number
  initialData: OnboardingData
}

export function WizardShell({ userId, initialStep, initialData }: Props) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [step, setStep] = React.useState(initialStep)
  const [data, setData] = React.useState<OnboardingData>(initialData)
  const [showErrors, setShowErrors] = React.useState(false)

  const stepName: OnboardingStep = STEPS[step] ?? STEPS[0]
  const isLast = step === TOTAL_STEPS - 1
  const isFirst = step === 0

  const errors = React.useMemo(() => validateStep(stepName, data), [stepName, data])
  const canProceed = errors.length === 0

  // Persist progress to DB (debounced)
  const saveProgress = React.useCallback(
    async (s: number, d: OnboardingData) => {
      await supabase
        .from("onboarding_progress")
        .upsert({ user_id: userId, step: s, data: d }, { onConflict: "user_id" })
    },
    [supabase, userId]
  )

  const handleNext = async () => {
    if (isLast) return
    if (!canProceed) {
      setShowErrors(true)
      toast.error("Bitte fülle die markierten Felder aus")
      return
    }
    const next = Math.min(step + 1, TOTAL_STEPS - 1)
    setStep(next)
    setShowErrors(false)
    await saveProgress(next, data)
  }

  const handleBack = () => {
    if (isFirst) return
    setStep((s) => Math.max(s - 1, 0))
    setShowErrors(false)
  }

  const handleChange = (patch: Partial<OnboardingData>) => {
    setData((prev) => {
      const merged = { ...prev, ...patch }
      void saveProgress(step, merged)
      return merged
    })
  }

  const finishMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        // Personal
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        phone: data.phone || null,
        website: data.website || null,
        email_from_invoice: null,

        // Company / Legal
        company_name: data.company_name || null,
        legal_form: data.legal_form ?? null,
        address: {
          street: data.street || "",
          zip: data.zip || "",
          city: data.city || "",
          country: data.country || "DE",
        },
        branche_wz_code: data.branche_wz_code || null,
        branche_label: data.branche_label || null,
        is_ksk_abgabepflichtig: Boolean(data.is_ksk_abgabepflichtig),

        // Tax
        tax_regime: data.tax_regime ?? "kleinunternehmer",
        is_kleinunternehmer: data.tax_regime !== "regelbesteuerung",
        vat_scheme: data.vat_scheme ?? "ist",
        tax_id: data.tax_id || null,
        ust_id: data.ust_id || null,

        // Banking
        iban: data.iban || null,
        bic: data.bic || null,
        bank_name: data.bank_name || null,

        // Jobcenter
        receives_buergergeld: Boolean(data.receives_buergergeld),
        jobcenter_name: data.jobcenter_name || null,
        jobcenter_bg_nummer: data.jobcenter_bg_nummer || null,
        bewilligungszeitraum_start: data.bewilligungszeitraum_start || null,
        bewilligungszeitraum_end: data.bewilligungszeitraum_end || null,
        buergergeld_bedarf_monatlich_cents:
          typeof data.buergergeld_bedarf_monatlich_cents === "number"
            ? data.buergergeld_bedarf_monatlich_cents
            : null,
        regelbedarf_stufe: data.regelbedarf_stufe
          ? Number.parseInt(data.regelbedarf_stufe, 10)
          : null,
        has_minor_children: Boolean(data.has_minor_children),

        onboarding_step: TOTAL_STEPS - 1,
        onboarding_completed_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from("settings")
        .update(payload)
        .eq("user_id", userId)
      if (error) throw error

      // Mark progress table done (we keep it for analytics)
      await supabase
        .from("onboarding_progress")
        .upsert(
          { user_id: userId, step: TOTAL_STEPS - 1, data },
          { onConflict: "user_id" }
        )
    },
    onSuccess: () => {
      toast.success("Dein Profil ist eingerichtet.")
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      router.replace("/dashboard")
      router.refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Skip-onboarding: just mark completed_at and go — user can fill rest in Settings later.
  const skipMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          onboarding_step: TOTAL_STEPS - 1,
          onboarding_completed_at: new Date().toISOString(),
          // Save whatever the user already typed
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          company_name: data.company_name || null,
          legal_form: data.legal_form ?? null,
          tax_regime: data.tax_regime ?? "kleinunternehmer",
          is_kleinunternehmer: data.tax_regime !== "regelbesteuerung",
          tax_id: data.tax_id || null,
          ust_id: data.ust_id || null,
          iban: data.iban || null,
          bic: data.bic || null,
          bank_name: data.bank_name || null,
          address: {
            street: data.street || "",
            zip: data.zip || "",
            city: data.city || "",
            country: data.country || "DE",
          },
          branche_wz_code: data.branche_wz_code || null,
          branche_label: data.branche_label || null,
          is_ksk_abgabepflichtig: Boolean(data.is_ksk_abgabepflichtig),
          receives_buergergeld: Boolean(data.receives_buergergeld),
          jobcenter_name: data.jobcenter_name || null,
          jobcenter_bg_nummer: data.jobcenter_bg_nummer || null,
          bewilligungszeitraum_start: data.bewilligungszeitraum_start || null,
          bewilligungszeitraum_end: data.bewilligungszeitraum_end || null,
          buergergeld_bedarf_monatlich_cents:
            typeof data.buergergeld_bedarf_monatlich_cents === "number"
              ? data.buergergeld_bedarf_monatlich_cents
              : null,
          regelbedarf_stufe: data.regelbedarf_stufe
            ? Number.parseInt(data.regelbedarf_stufe, 10)
            : null,
          has_minor_children: Boolean(data.has_minor_children),
        })
        .eq("user_id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.info("Onboarding übersprungen — du kannst es später in den Einstellungen vervollständigen.")
      queryClient.invalidateQueries({ queryKey: ["settings"] })
      router.replace("/dashboard")
      router.refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="bg-muted/20 relative min-h-dvh overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="bg-primary/10 absolute -top-40 -right-20 size-[32rem] rounded-full blur-3xl" />
        <div className="bg-chart-2/10 absolute top-1/3 -left-40 size-[32rem] rounded-full blur-3xl" />
        <div className="bg-chart-4/10 absolute -bottom-40 right-1/3 size-[32rem] rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-2xl gap-6 px-4 py-8 md:py-12">
        {/* Progress */}
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Card */}
        <div className="bg-card/80 rounded-3xl border p-6 shadow-xl backdrop-blur-sm md:p-10">
          <StepContent
            step={stepName}
            data={data}
            onChange={handleChange}
            showErrors={showErrors}
            errors={errors}
          />

          {showErrors && errors.length > 0 ? (
            <div className="bg-destructive/10 text-destructive mt-5 grid gap-1 rounded-xl border border-destructive/20 p-3 text-xs">
              <p className="font-medium">Bitte vervollständige:</p>
              <ul className="list-disc pl-4">
                {errors.map((e) => (
                  <li key={e}>{ERROR_LABEL[e] ?? e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isFirst}
            className={cn(isFirst && "invisible")}
          >
            <ArrowLeft /> Zurück
          </Button>

          {isLast ? (
            <Button
              size="lg"
              onClick={() => finishMut.mutate()}
              disabled={finishMut.isPending}
            >
              {finishMut.isPending ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Jetzt starten
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleNext}
              disabled={!canProceed && showErrors}
              variant={canProceed ? "default" : "outline"}
            >
              Weiter
              <ArrowRight />
            </Button>
          )}
        </div>

        <div className="grid gap-2 text-center">
          <p className="text-muted-foreground text-xs">
            Deine Antworten werden automatisch gespeichert. Du kannst jederzeit schließen und später fortsetzen.
          </p>
          {!isLast ? (
            <SkipDialog
              data={data}
              onConfirm={() => skipMut.mutate()}
              pending={skipMut.isPending}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Skip dialog ────────────────────────────────────────────────────────────

// Feld-Labels werden zur Laufzeit per `t("skipField_<key>")` aufgelöst, weil
// `useTranslations` nur in Komponenten erlaubt ist. Die `SKIP_FIELD_KEYS`-
// Liste hier ist Single-Source-of-Truth — wenn ein Feld neu reinkommt,
// auch in alle 4 `messages/*.json` als `skipField_<key>` ergänzen
// (i18n-parity wird in CI über key-count enforced).
const SKIP_FIELD_KEYS = [
  "first_name",
  "last_name",
  "iban",
  "street",
  "zip",
  "city",
  "bewilligungszeitraum_start",
  "bewilligungszeitraum_end",
  "buergergeld_bedarf_monatlich_cents",
  "regelbedarf_stufe",
] as const
type SkipFieldKey = (typeof SKIP_FIELD_KEYS)[number]

function SkipDialog({
  data,
  onConfirm,
  pending,
}: {
  data: OnboardingData
  onConfirm: () => void
  pending: boolean
}) {
  const t = useTranslations("Onboarding")
  const tCommon = useTranslations("Common")
  const [open, setOpen] = React.useState(false)
  const [token, setToken] = React.useState("")
  const { missing, buergergeldMissing } = React.useMemo(
    () => validateSkipReadiness(data),
    [data]
  )

  // Locale-spezifisches Bestätigungs-Token. Vergleich case-insensitive, damit
  // "verstanden" / "VERSTANDEN" / "Verstanden" alle akzeptiert werden.
  const expectedToken = t("skipConfirmToken")
  const blocked = missing.length > 0 || buergergeldMissing.length > 0
  const allMissing = [...missing, ...buergergeldMissing]
  const tokenMatches =
    token.trim().toUpperCase() === expectedToken.toUpperCase()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setToken("")
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? t("skipButtonPending") : t("skipButtonSoft")}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("skipDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("skipDialogHint")}</AlertDialogDescription>
        </AlertDialogHeader>

        {blocked ? (
          <div className="grid gap-2 text-left">
            <p className="text-foreground text-xs font-medium">
              {t("skipDialogMissingHeader")}
            </p>
            <ul className="text-muted-foreground list-disc pl-5 text-xs">
              {allMissing.map((field) => (
                <li key={field}>
                  {/* Locale-aware label lookup. Wenn der Feldname kein bekannter
                      Skip-Field-Key ist (z. B. ein Custom-Eintrag), fällt das
                      Default-Label = raw-field-name zurück. */}
                  {SKIP_FIELD_KEYS.includes(field as SkipFieldKey)
                    ? t(`skipField_${field}` as Parameters<typeof t>[0])
                    : field}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">
              {t("skipDialogConfirmHint", { token: expectedToken })}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-left text-xs">
            {t("skipDialogReady", { token: expectedToken })}
          </p>
        )}

        <div className="grid gap-1.5 text-left">
          <label
            htmlFor="skip-confirm-token"
            className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          >
            {t("skipDialogConfirmLabel")}
          </label>
          <Input
            id="skip-confirm-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={expectedToken}
            className="font-mono"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!tokenMatches || pending}
            onClick={() => {
              if (!tokenMatches) return
              setOpen(false)
              onConfirm()
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {t("skipConfirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Schritt {step + 1} von {total}
        </span>
        <span className="text-muted-foreground font-mono">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StepContent({
  step,
  data,
  onChange,
  showErrors,
  errors,
}: {
  step: OnboardingStep
  data: OnboardingData
  onChange: (patch: Partial<OnboardingData>) => void
  showErrors: boolean
  errors: string[]
}) {
  switch (step) {
    case "welcome":
      return <WelcomeStep />
    case "legal_form":
      return <LegalFormStep data={data} onChange={onChange} />
    case "branche":
      return <BrancheStep data={data} onChange={onChange} />
    case "tax_regime":
      return <TaxRegimeStep data={data} onChange={onChange} />
    case "address":
      return (
        <AddressStep
          data={data}
          onChange={onChange}
          showErrors={showErrors}
          errors={errors}
        />
      )
    case "banking":
      return <BankingStep data={data} onChange={onChange} />
    case "buergergeld":
      return <BuergergeldStep data={data} onChange={onChange} />

    case "done":
      return <DoneStep data={data} />
  }
}
