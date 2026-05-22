"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bell,
  Briefcase,
  HeartHandshake,
  Loader2,
  Mail,
  Palette,
  Save,
  User as UserIcon,
  UserCog,
} from "lucide-react"

import { useSupabase } from "@/lib/hooks/use-supabase"
import { useShowGermanCategoryLabels } from "@/lib/hooks/use-display-prefs"
import type { Settings, LegalForm } from "@/types/database.types"
import { branchen } from "@/lib/data/branchen"
import { legalForms } from "@/lib/data/legal-forms"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

interface Props {
  initial: Settings
}

/**
 * Extended-profile sections. Each card is an independent form with its own Save.
 */
export function SettingsSections({ initial }: Props) {
  return (
    <div className="grid gap-6">
      <IdentitySection initial={initial} />
      <LegalBrancheSection initial={initial} />
      <JobcenterSection initial={initial} />
      <SteuerberaterSection initial={initial} />
      <MahnwesenSection initial={initial} />
      <EmailTemplateSection initial={initial} />
      <PdfDesignSection initial={initial} />
      <DisplayPrefsSection />
    </div>
  )
}

function useSaveSection(initial: Settings) {
  const t = useTranslations("Settings")
  const supabase = useSupabase()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await supabase
        .from("settings")
        .update(patch)
        .eq("user_id", initial.user_id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(t("saveToast"))
      queryClient.invalidateQueries({ queryKey: ["settings"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/* --- Section: Identity (personal) --- */
function IdentitySection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)
  const [data, setData] = React.useState({
    first_name: initial.first_name ?? "",
    last_name: initial.last_name ?? "",
    phone: initial.phone ?? "",
    website: initial.website ?? "",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="size-4" /> {t("personalData")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("firstName")}>
            <Input
              value={data.first_name}
              onChange={(e) => setData({ ...data, first_name: e.target.value })}
            />
          </Field>
          <Field label={t("lastName")}>
            <Input
              value={data.last_name}
              onChange={(e) => setData({ ...data, last_name: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("phone")}>
            <Input
              type="tel"
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
            />
          </Field>
          <Field label={t("website")}>
            <Input
              type="url"
              value={data.website}
              onChange={(e) => setData({ ...data, website: e.target.value })}
              placeholder="https://kolos.digital"
            />
          </Field>
        </div>
        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              first_name: data.first_name || null,
              last_name: data.last_name || null,
              phone: data.phone || null,
              website: data.website || null,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

/* --- Section: Legal form & Branche & KSK --- */
function LegalBrancheSection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)
  const [legalForm, setLegalForm] = React.useState<LegalForm | "">(
    initial.legal_form ?? ""
  )
  const [branche, setBranche] = React.useState(initial.branche_wz_code ?? "")
  const [kskPflichtig, setKskPflichtig] = React.useState(
    initial.is_ksk_abgabepflichtig
  )
  const [kskMitglied, setKskMitglied] = React.useState(initial.is_ksk_mitglied)
  const [kskNummer, setKskNummer] = React.useState(initial.ksk_nummer ?? "")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="size-4" /> {t("legalAndBranche")}
        </CardTitle>
        <CardDescription>{t("legalAndBrancheHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label={t("legalForm")}>
          <Select
            value={legalForm}
            onValueChange={(v) => setLegalForm((v ?? "") as LegalForm | "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectPlaceholder")}>
                {legalForm
                  ? (() => {
                      const f = legalForms.find((lf) => lf.value === legalForm)
                      return f ? `${f.emoji} ${f.label}` : legalForm
                    })()
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {legalForms.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.emoji} {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t("branche")}>
          <Select value={branche} onValueChange={(v) => setBranche(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("selectPlaceholder")}>
                {branche
                  ? (() => {
                      const b = branchen.find((br) => br.wz === branche)
                      return b ? `${b.label}${b.kskRelevant ? " · KSK" : ""}` : branche
                    })()
                  : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {branchen.map((b) => (
                <SelectItem key={b.wz} value={b.wz}>
                  {b.label}
                  {b.kskRelevant ? " · KSK" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <ToggleRow
          label={t("kskAbgabe")}
          hint={t("kskAbgabeHint")}
          checked={kskPflichtig}
          onCheck={setKskPflichtig}
        />
        <ToggleRow
          label={t("kskMember")}
          checked={kskMitglied}
          onCheck={setKskMitglied}
        />
        {kskMitglied ? (
          <Field label={t("kskNumber")}>
            <Input
              value={kskNummer}
              onChange={(e) => setKskNummer(e.target.value)}
            />
          </Field>
        ) : null}

        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              legal_form: (legalForm || null) as LegalForm | null,
              branche_wz_code: branche || null,
              branche_label:
                branchen.find((b) => b.wz === branche)?.label ?? null,
              is_ksk_abgabepflichtig: kskPflichtig,
              is_ksk_mitglied: kskMitglied,
              ksk_nummer: kskNummer || null,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

/* --- Section: Jobcenter --- */
function JobcenterSection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)
  const [enabled, setEnabled] = React.useState(initial.receives_buergergeld)
  const [jc, setJc] = React.useState({
    jobcenter_name: initial.jobcenter_name ?? "",
    jobcenter_bg_nummer: initial.jobcenter_bg_nummer ?? "",
    bewilligungszeitraum_start: initial.bewilligungszeitraum_start ?? "",
    bewilligungszeitraum_end: initial.bewilligungszeitraum_end ?? "",
  })
  const [stufe, setStufe] = React.useState<number | null>(
    initial.regelbedarf_stufe ?? null
  )
  const [bedarf, setBedarf] = React.useState<number>(
    initial.buergergeld_bedarf_monatlich_cents ?? 0
  )
  const [hasChild, setHasChild] = React.useState<boolean>(
    initial.has_minor_children ?? false
  )
  // §21 SGB II Mehrbedarfe
  const initialMehr = initial.mehrbedarfe_jsonb ?? {}
  const [schwanger, setSchwanger] = React.useState<boolean>(
    Boolean(initialMehr.schwanger)
  )
  const [behinderung, setBehinderung] = React.useState<boolean>(
    Boolean(initialMehr.behinderung)
  )
  const [warmwasser, setWarmwasser] = React.useState<boolean>(
    Boolean(initialMehr.dezentrale_warmwasser)
  )
  const [ernaehrung, setErnaehrung] = React.useState<number>(
    initialMehr.ernaehrung_cents ?? 0
  )
  const [aeKinder, setAeKinder] = React.useState<number>(
    initialMehr.alleinerziehend_kinder?.anzahl ?? 0
  )
  const [aeJuengstes, setAeJuengstes] = React.useState<number>(
    initialMehr.alleinerziehend_kinder?.juengstes_kind_alter ?? 0
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartHandshake className="size-4" /> {t("jobcenterTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleRow
          label={t("jobcenterAufstocker")}
          hint={t("jobcenterAufstockerHint")}
          checked={enabled}
          onCheck={setEnabled}
        />
        {enabled ? (
          <>
            <Field label={t("jobcenterName")}>
              <Input
                value={jc.jobcenter_name}
                onChange={(e) =>
                  setJc({ ...jc, jobcenter_name: e.target.value })
                }
                placeholder="Jobcenter Berlin Mitte"
              />
            </Field>
            <Field label={t("jobcenterBgNummer")}>
              <Input
                value={jc.jobcenter_bg_nummer}
                onChange={(e) =>
                  setJc({ ...jc, jobcenter_bg_nummer: e.target.value })
                }
                className="font-mono"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("bwzVon")}>
                <Input
                  type="date"
                  value={jc.bewilligungszeitraum_start}
                  onChange={(e) =>
                    setJc({
                      ...jc,
                      bewilligungszeitraum_start: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label={t("bwzBis")}>
                <Input
                  type="date"
                  value={jc.bewilligungszeitraum_end}
                  onChange={(e) =>
                    setJc({ ...jc, bewilligungszeitraum_end: e.target.value })
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("regelbedarfStufe")}>
                <Select
                  value={stufe ? String(stufe) : ""}
                  onValueChange={(v) => setStufe(v ? Number(v) : null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("selectPlaceholder")}>
                      {stufe ? t("stufeLabel", { n: stufe }) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t("stufeOpt1")}</SelectItem>
                    <SelectItem value="2">{t("stufeOpt2")}</SelectItem>
                    <SelectItem value="3">{t("stufeOpt3")}</SelectItem>
                    <SelectItem value="4">{t("stufeOpt4")}</SelectItem>
                    <SelectItem value="5">{t("stufeOpt5")}</SelectItem>
                    <SelectItem value="6">{t("stufeOpt6")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("monthlyBedarf")}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bedarf ? (bedarf / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    setBedarf(
                      Math.round((Number(e.target.value) || 0) * 100)
                    )
                  }
                  placeholder="1063.00"
                />
              </Field>
            </div>

            <ToggleRow
              label={t("minorChild")}
              hint={t("minorChildHint")}
              checked={hasChild}
              onCheck={setHasChild}
            />

            <div className="grid gap-2 rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                {t("mehrbedarfeTitle")}
              </p>
              <ToggleRow
                label={t("schwanger")}
                hint={t("schwangerHint")}
                checked={schwanger}
                onCheck={setSchwanger}
              />
              <ToggleRow
                label={t("behinderung")}
                hint={t("behinderungHint")}
                checked={behinderung}
                onCheck={setBehinderung}
              />
              <ToggleRow
                label={t("warmwasser")}
                hint={t("warmwasserHint")}
                checked={warmwasser}
                onCheck={setWarmwasser}
              />
              <Field label={t("ernaehrung")}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ernaehrung ? (ernaehrung / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    setErnaehrung(Math.round((Number(e.target.value) || 0) * 100))
                  }
                  placeholder="0.00"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("alleinerziehendKinder")}>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={aeKinder || ""}
                    onChange={(e) => setAeKinder(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </Field>
                <Field label={t("alleinerziehendJuengstes")}>
                  <Input
                    type="number"
                    min="0"
                    max="17"
                    value={aeJuengstes || ""}
                    onChange={(e) =>
                      setAeJuengstes(Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    disabled={aeKinder === 0}
                  />
                </Field>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {t("alleinerziehendNote")}
              </p>
            </div>
          </>
        ) : null}
        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              receives_buergergeld: enabled,
              jobcenter_name: enabled ? jc.jobcenter_name || null : null,
              jobcenter_bg_nummer: enabled ? jc.jobcenter_bg_nummer || null : null,
              bewilligungszeitraum_start: enabled
                ? jc.bewilligungszeitraum_start || null
                : null,
              bewilligungszeitraum_end: enabled
                ? jc.bewilligungszeitraum_end || null
                : null,
              regelbedarf_stufe: enabled ? stufe : null,
              buergergeld_bedarf_monatlich_cents: enabled ? bedarf || null : null,
              has_minor_children: enabled ? hasChild : false,
              mehrbedarfe_jsonb: enabled
                ? {
                    schwanger,
                    behinderung,
                    dezentrale_warmwasser: warmwasser,
                    ernaehrung_cents: ernaehrung,
                    alleinerziehend_kinder:
                      aeKinder > 0
                        ? { anzahl: aeKinder, juengstes_kind_alter: aeJuengstes }
                        : null,
                  }
                : {},
            })
          }
        />
      </CardContent>
    </Card>
  )
}

/* --- Section: Steuerberater --- */
function SteuerberaterSection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)
  const [stb, setStb] = React.useState({
    name: initial.steuerberater_name ?? "",
    email: initial.steuerberater_email ?? "",
    datev_id: initial.steuerberater_datev_id ?? "",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="size-4" /> {t("stbTitle")}
        </CardTitle>
        <CardDescription>{t("stbHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label={t("stbName")}>
          <Input
            value={stb.name}
            onChange={(e) => setStb({ ...stb, name: e.target.value })}
          />
        </Field>
        <Field label={t("stbEmail")}>
          <Input
            type="email"
            value={stb.email}
            onChange={(e) => setStb({ ...stb, email: e.target.value })}
          />
        </Field>
        <Field label={t("stbDatevId")}>
          <Input
            value={stb.datev_id}
            onChange={(e) => setStb({ ...stb, datev_id: e.target.value })}
            className="font-mono"
          />
        </Field>
        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              steuerberater_name: stb.name || null,
              steuerberater_email: stb.email || null,
              steuerberater_datev_id: stb.datev_id || null,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

/* --- Section: Mahnwesen --- */
function MahnwesenSection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)
  const [m, setM] = React.useState({
    enable: initial.enable_auto_mahnung,
    d1: initial.mahnung_1_days_after_due,
    d2: initial.mahnung_2_days_after_due,
    d3: initial.mahnung_3_days_after_due,
    g1: initial.mahngebuehr_1_cents / 100,
    g2: initial.mahngebuehr_2_cents / 100,
    g3: initial.mahngebuehr_3_cents / 100,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" /> {t("mahnwesenTitle")}
        </CardTitle>
        <CardDescription>{t("mahnwesenHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ToggleRow
          label={t("mahnwesenEnable")}
          checked={m.enable}
          onCheck={(v) => setM({ ...m, enable: v })}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("stufe1Days")}>
            <Input
              type="number"
              value={m.d1}
              onChange={(e) =>
                setM({ ...m, d1: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label={t("stufe2Days")}>
            <Input
              type="number"
              value={m.d2}
              onChange={(e) =>
                setM({ ...m, d2: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label={t("stufe3Days")}>
            <Input
              type="number"
              value={m.d3}
              onChange={(e) =>
                setM({ ...m, d3: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("fee1")}>
            <Input
              type="number"
              step="0.50"
              value={m.g1}
              onChange={(e) =>
                setM({ ...m, g1: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label={t("fee2")}>
            <Input
              type="number"
              step="0.50"
              value={m.g2}
              onChange={(e) =>
                setM({ ...m, g2: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label={t("fee3")}>
            <Input
              type="number"
              step="0.50"
              value={m.g3}
              onChange={(e) =>
                setM({ ...m, g3: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              enable_auto_mahnung: m.enable,
              mahnung_1_days_after_due: m.d1,
              mahnung_2_days_after_due: m.d2,
              mahnung_3_days_after_due: m.d3,
              mahngebuehr_1_cents: Math.round(m.g1 * 100),
              mahngebuehr_2_cents: Math.round(m.g2 * 100),
              mahngebuehr_3_cents: Math.round(m.g3 * 100),
            })
          }
        />
      </CardContent>
    </Card>
  )
}

/* --- Section: PDF Design --- */
function PdfDesignSection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)
  const [template, setTemplate] = React.useState(initial.pdf_template)
  const [accent, setAccent] = React.useState(initial.pdf_accent_color)
  const [footer, setFooter] = React.useState(initial.pdf_footer_text ?? "")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4" /> {t("pdfDesignTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label={t("pdfTemplate")}>
          <div className="grid grid-cols-3 gap-2">
            {(["minimal", "elegant", "studio"] as const).map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setTemplate(tpl)}
                className={cn(
                  "rounded-xl border p-3 text-center text-sm capitalize transition-all",
                  template === tpl
                    ? "border-primary bg-primary/5 ring-primary/20 ring-4"
                    : "border-border hover:border-primary/40"
                )}
              >
                {tpl}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("pdfAccent")}>
            <Input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-10"
            />
          </Field>
          <Field label={t("pdfFooter")}>
            <Textarea
              rows={2}
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder={t("pdfFooterPlaceholder")}
            />
          </Field>
        </div>
        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              pdf_template: template,
              pdf_accent_color: accent,
              pdf_footer_text: footer || null,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

/* --- Shared --- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheck,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheck: (v: boolean) => void
}) {
  return (
    <div className="bg-muted/40 flex items-start gap-3 rounded-xl border p-3">
      <Switch checked={checked} onCheckedChange={onCheck} />
      <div className="grid gap-0.5 leading-tight">
        <div className="text-sm font-medium">{label}</div>
        {hint ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SaveBar({
  pending,
  onSave,
}: {
  pending: boolean
  onSave: () => void
}) {
  const t = useTranslations("Settings")
  return (
    <div className="flex justify-end pt-2">
      <Button size="sm" onClick={onSave} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {t("save")}
      </Button>
    </div>
  )
}

/* --- Section: Email Templates für Rechnungs- und Mahnungs-Versand --- */

const DEFAULT_INVOICE_SUBJECT =
  "Rechnung {{invoice_number}} · {{sender_name}}"

const DEFAULT_INVOICE_BODY = `Sehr geehrte/r {{client_name}},

anbei erhalten Sie unsere Rechnung {{invoice_number}}
über {{amount}}.

Bitte überweisen Sie den Betrag bis spätestens {{due_date}} auf das Konto {{iban}}.
Verwendungszweck: {{invoice_number}}

Bei Rückfragen melden Sie sich gerne per Antwort auf diese E-Mail.

Mit freundlichen Grüßen
{{sender_name}}`

function EmailTemplateSection({ initial }: { initial: Settings }) {
  const t = useTranslations("Settings")
  const save = useSaveSection(initial)

  const [invSubject, setInvSubject] = React.useState(
    initial.email_template_invoice_subject ?? ""
  )
  const [invBody, setInvBody] = React.useState(
    initial.email_template_invoice_body ?? ""
  )
  const [mahnSubject, setMahnSubject] = React.useState(
    initial.email_template_mahnung_subject ?? ""
  )
  const [mahnBody, setMahnBody] = React.useState(
    initial.email_template_mahnung_body ?? ""
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" /> {t("emailTemplatesTitle")}
        </CardTitle>
        <CardDescription>
          {t("emailTemplatesHintPrefix")}{" "}
          <code className="text-[10px] font-mono">{"{{invoice_number}}"}</code>{" "}
          <code className="text-[10px] font-mono">{"{{client_name}}"}</code>{" "}
          <code className="text-[10px] font-mono">{"{{amount}}"}</code>{" "}
          <code className="text-[10px] font-mono">{"{{due_date}}"}</code>{" "}
          <code className="text-[10px] font-mono">{"{{iban}}"}</code>{" "}
          <code className="text-[10px] font-mono">{"{{sender_name}}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3">
          <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            {t("invoiceEmailLabel")}
          </p>
          <Field label={t("subjectLabel")}>
            <Input
              value={invSubject}
              onChange={(e) => setInvSubject(e.target.value)}
              placeholder={DEFAULT_INVOICE_SUBJECT}
            />
          </Field>
          <Field label={t("bodyLabel")}>
            <Textarea
              value={invBody}
              onChange={(e) => setInvBody(e.target.value)}
              placeholder={DEFAULT_INVOICE_BODY}
              rows={8}
              className="font-mono text-xs"
            />
          </Field>
          <p className="text-muted-foreground text-[11px]">
            {t("emptyTemplateNote")}
          </p>
        </div>

        <div className="grid gap-3 border-t pt-5">
          <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
            {t("mahnungEmailLabel")}
          </p>
          <Field label={t("subjectLabel")}>
            <Input
              value={mahnSubject}
              onChange={(e) => setMahnSubject(e.target.value)}
              placeholder={t("mahnungSubjectPlaceholder")}
            />
          </Field>
          <Field label={t("bodyLabel")}>
            <Textarea
              value={mahnBody}
              onChange={(e) => setMahnBody(e.target.value)}
              placeholder={`Sehr geehrte/r {{client_name}},\n\nleider konnten wir bis heute keinen Zahlungseingang für Rechnung {{invoice_number}} ({{amount}}) feststellen ...`}
              rows={6}
              className="font-mono text-xs"
            />
          </Field>
        </div>

        <SaveBar
          pending={save.isPending}
          onSave={() =>
            save.mutate({
              email_template_invoice_subject: invSubject || null,
              email_template_invoice_body: invBody || null,
              email_template_mahnung_subject: mahnSubject || null,
              email_template_mahnung_body: mahnBody || null,
            })
          }
        />
      </CardContent>
    </Card>
  )
}

// ─── Display preferences ────────────────────────────────────────────────
// Client-side only; persisted to localStorage by the hook.

function DisplayPrefsSection() {
  const t = useTranslations("Settings")
  const [showGermanLabels, setShowGermanLabels] = useShowGermanCategoryLabels()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("displayPrefsTitle")}</CardTitle>
        <CardDescription>{t("displayPrefsHint")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ToggleRow
          label={t("showGermanCategoryLabels")}
          hint={t("showGermanCategoryLabelsHint")}
          checked={showGermanLabels}
          onCheck={setShowGermanLabels}
        />
      </CardContent>
    </Card>
  )
}
