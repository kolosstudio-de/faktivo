"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react"

import { PLANS, annualSavingsPct } from "@/lib/billing/plans"
import { LangSwitcher } from "./lang-switcher"
import { cn } from "@/lib/utils"

interface Props {
  locale: string
}

type I18n = {
  hero_title: string
  hero_subtitle: string
  toggle_monthly: string
  toggle_yearly: string
  toggle_yearly_badge: string
  per_month: string
  yearly_total_label: string
  free_cta: string
  paid_cta: string
  current_cta: string
  no_vat_note: string
  popular: string
  faq_title: string
  faq: { q: string; a: string }[]
  compare_title: string
  compare_feature: string
  feature_invoices: string
  feature_clients: string
  feature_eks: string
  feature_banking: string
  feature_ocr: string
  feature_mahnwesen: string
  feature_datev: string
  feature_elster: string
  feature_team: string
  feature_api: string
  feature_branding: string
  feature_multi_company: string
  feature_zk: string
  unlimited: string
  back_home: string
  legal_impressum: string
  legal_datenschutz: string
  legal_agb: string
  legal_widerruf: string
}

const COPY: Record<string, I18n> = {
  de: {
    hero_title: "Faire Preise. Keine Tricks.",
    hero_subtitle:
      "Free-Plan dauerhaft kostenlos. Pro & Business jederzeit kündbar — Endpreise ohne USt. (§ 19 UStG, Kleinunternehmer).",
    toggle_monthly: "Monatlich",
    toggle_yearly: "Jährlich",
    toggle_yearly_badge: "−20 %",
    per_month: "/ Monat",
    yearly_total_label: "Total pro Jahr",
    free_cta: "Kostenlos starten",
    paid_cta: "Plan wählen",
    current_cta: "Aktueller Plan",
    no_vat_note: "Endpreis · keine USt. (§ 19 UStG, Kleinunternehmer)",
    popular: "Beliebt",
    compare_title: "Detaillierter Vergleich",
    compare_feature: "Funktion",
    feature_invoices: "Rechnungen pro Monat",
    feature_clients: "Kunden",
    feature_eks: "Anlage EKS / Quartal",
    feature_banking: "Banking Auto-Sync",
    feature_ocr: "Beleg-OCR (KI)",
    feature_mahnwesen: "Mahnwesen 3-stufig",
    feature_datev: "DATEV-Export",
    feature_elster: "ELSTER-Bridge (UStVA, EÜR)",
    feature_team: "Team-Zugang",
    feature_api: "API + Webhooks",
    feature_branding: "Eigenes Branding",
    feature_multi_company: "Mehrere Firmen",
    feature_zk: "Zero-Knowledge-Modus",
    unlimited: "Unbegrenzt",
    back_home: "Zurück zur Startseite",
    faq_title: "Häufige Fragen",
    faq: [
      {
        q: "Kann ich jederzeit kündigen?",
        a: "Ja. Pro und Business sind monatlich kündbar (zum Monatsende), das Jahres-Abo läuft 12 Monate und endet automatisch — keine automatische Verlängerung ohne aktive Bestätigung.",
      },
      {
        q: "Was passiert mit meinen Daten nach Kündigung?",
        a: "Du kannst alle Rechnungen, Kunden, Belege und Anlagen jederzeit als ZIP/CSV/DATEV exportieren — auch nach Kündigung. Wir halten deine Daten nicht fest.",
      },
      {
        q: "Bekomme ich eine Rechnung?",
        a: "Ja. Faktivo stellt jeden Monat eine Rechnung als PDF bereit (downloadbar im Account-Bereich). Da der Anbieter Kleinunternehmer nach § 19 UStG ist, wird keine Umsatzsteuer ausgewiesen.",
      },
      {
        q: "Welche Zahlungsmethoden werden unterstützt?",
        a: "SEPA-Lastschrift (empfohlen), Kreditkarte (Visa, Mastercard), Apple Pay, Google Pay. Abwicklung über Mollie / Stripe.",
      },
      {
        q: "Free-Plan: dauerhaft oder Trial?",
        a: "Dauerhaft kostenlos. 3 Rechnungen pro Monat, unbegrenzt Angebote, E-Rechnung inklusive. Keine Kreditkarte nötig.",
      },
      {
        q: "Funktioniert Faktivo, wenn ich Bürgergeld beziehe?",
        a: "Ja — die Anlage EKS für das Jobcenter ist im Free-Plan (1× pro Quartal) und Pro/Business unbegrenzt enthalten. Mit allen Freibeträgen nach § 11b SGB II.",
      },
    ],
    legal_impressum: "Impressum",
    legal_datenschutz: "Datenschutz",
    legal_agb: "AGB",
    legal_widerruf: "Widerruf",
  },
  en: {
    hero_title: "Fair pricing. No tricks.",
    hero_subtitle:
      "Free plan stays free forever. Pro & Business cancellable any time — final prices without VAT (§ 19 UStG, small-business scheme).",
    toggle_monthly: "Monthly",
    toggle_yearly: "Yearly",
    toggle_yearly_badge: "−20 %",
    per_month: "/ month",
    yearly_total_label: "Annual total",
    free_cta: "Start free",
    paid_cta: "Choose plan",
    current_cta: "Current plan",
    no_vat_note: "Final price · no VAT (§ 19 UStG, small-business scheme)",
    popular: "Popular",
    compare_title: "Detailed comparison",
    compare_feature: "Feature",
    feature_invoices: "Invoices per month",
    feature_clients: "Clients",
    feature_eks: "Anlage EKS per quarter",
    feature_banking: "Banking auto-sync",
    feature_ocr: "Receipt OCR (AI)",
    feature_mahnwesen: "Reminder 3 stages",
    feature_datev: "DATEV export",
    feature_elster: "ELSTER bridge (UStVA, EÜR)",
    feature_team: "Team access",
    feature_api: "API + webhooks",
    feature_branding: "Custom branding",
    feature_multi_company: "Multiple companies",
    feature_zk: "Zero-knowledge mode",
    unlimited: "Unlimited",
    back_home: "Back to home",
    faq_title: "Frequently asked",
    faq: [
      {
        q: "Can I cancel any time?",
        a: "Yes. Pro and Business can be cancelled monthly (end of month). The annual plan runs 12 months and ends automatically — no auto-renewal without active confirmation.",
      },
      {
        q: "What happens to my data if I cancel?",
        a: "You can export all invoices, clients, receipts and documents as ZIP/CSV/DATEV any time — also after cancellation. We don't hold your data hostage.",
      },
      {
        q: "Do I get a receipt?",
        a: "Yes. Faktivo provides a monthly invoice as PDF (downloadable in the account area). The provider is a small-business owner under § 19 UStG, so no VAT is shown.",
      },
      {
        q: "Which payment methods are supported?",
        a: "SEPA Direct Debit (recommended), credit card (Visa, Mastercard), Apple Pay, Google Pay. Processed via Mollie / Stripe.",
      },
      {
        q: "Free plan: forever or trial?",
        a: "Free forever. 3 invoices per month, unlimited quotes, e-invoice included. No credit card required.",
      },
      {
        q: "Does Faktivo work if I receive Bürgergeld?",
        a: "Yes — the Anlage EKS for the Jobcenter is included in Free (1× per quarter) and Pro/Business unlimited. With all § 11b SGB II allowances.",
      },
    ],
    legal_impressum: "Imprint",
    legal_datenschutz: "Privacy",
    legal_agb: "Terms",
    legal_widerruf: "Right of withdrawal",
  },
  ru: {
    hero_title: "Честные цены. Без подвохов.",
    hero_subtitle:
      "Free-план бесплатен навсегда. Pro и Business можно отменить в любой момент — конечные цены без НДС (§ 19 UStG, Kleinunternehmer).",
    toggle_monthly: "Месячная",
    toggle_yearly: "Годовая",
    toggle_yearly_badge: "−20 %",
    per_month: "/ месяц",
    yearly_total_label: "Всего за год",
    free_cta: "Начать бесплатно",
    paid_cta: "Выбрать план",
    current_cta: "Текущий план",
    no_vat_note: "Конечная цена · без НДС (§ 19 UStG, Kleinunternehmer)",
    popular: "Популярный",
    compare_title: "Детальное сравнение",
    compare_feature: "Функция",
    feature_invoices: "Счета в месяц",
    feature_clients: "Клиенты",
    feature_eks: "Anlage EKS / квартал",
    feature_banking: "Банковский авто-sync",
    feature_ocr: "OCR чеков (AI)",
    feature_mahnwesen: "Mahnwesen 3 ступени",
    feature_datev: "DATEV-экспорт",
    feature_elster: "ELSTER-Bridge (UStVA, EÜR)",
    feature_team: "Команда",
    feature_api: "API + webhooks",
    feature_branding: "Свой брендинг",
    feature_multi_company: "Несколько фирм",
    feature_zk: "Zero-Knowledge режим",
    unlimited: "Безлимит",
    back_home: "На главную",
    faq_title: "Частые вопросы",
    faq: [
      {
        q: "Можно отменить в любой момент?",
        a: "Да. Pro и Business можно отменить помесячно (на конец месяца). Годовой план идёт 12 месяцев и заканчивается автоматически — без автопродления без активного подтверждения.",
      },
      {
        q: "Что с моими данными после отмены?",
        a: "Ты можешь в любой момент выгрузить все счета, клиентов, чеки и документы в ZIP/CSV/DATEV — и после отмены тоже. Мы не удерживаем твои данные.",
      },
      {
        q: "Получу ли я счёт за подписку?",
        a: "Да. Faktivo каждый месяц предоставляет счёт PDF (скачать в кабинете). Поставщик — Kleinunternehmer § 19 UStG, поэтому НДС не выделяется.",
      },
      {
        q: "Какие способы оплаты?",
        a: "SEPA-Lastschrift (рекомендуется), кредитная карта (Visa, Mastercard), Apple Pay, Google Pay. Обработка через Mollie / Stripe.",
      },
      {
        q: "Free-план: навсегда или trial?",
        a: "Бесплатно навсегда. 3 счёта в месяц, безлимит на Angebote, E-Rechnung включён. Без привязки карты.",
      },
      {
        q: "Работает ли Faktivo, если я на Bürgergeld?",
        a: "Да — Anlage EKS для Jobcenter включён во Free (1× в квартал) и Pro/Business безлимит. Со всеми Freibeträge § 11b SGB II.",
      },
    ],
    legal_impressum: "Impressum",
    legal_datenschutz: "Защита данных",
    legal_agb: "Условия",
    legal_widerruf: "Отзыв",
  },
  uk: {
    hero_title: "Чесні ціни. Без хитрощів.",
    hero_subtitle:
      "Free-план безкоштовний назавжди. Pro і Business можна скасувати в будь-який момент — кінцеві ціни без ПДВ (§ 19 UStG, Kleinunternehmer).",
    toggle_monthly: "Місячна",
    toggle_yearly: "Річна",
    toggle_yearly_badge: "−20 %",
    per_month: "/ місяць",
    yearly_total_label: "Всього за рік",
    free_cta: "Почати безкоштовно",
    paid_cta: "Обрати план",
    current_cta: "Поточний план",
    no_vat_note: "Кінцева ціна · без ПДВ (§ 19 UStG, Kleinunternehmer)",
    popular: "Популярний",
    compare_title: "Детальне порівняння",
    compare_feature: "Функція",
    feature_invoices: "Рахунки на місяць",
    feature_clients: "Клієнти",
    feature_eks: "Anlage EKS / квартал",
    feature_banking: "Банківський авто-sync",
    feature_ocr: "OCR чеків (AI)",
    feature_mahnwesen: "Mahnwesen 3 ступені",
    feature_datev: "DATEV-експорт",
    feature_elster: "ELSTER-Bridge (UStVA, EÜR)",
    feature_team: "Команда",
    feature_api: "API + webhooks",
    feature_branding: "Власний брендинг",
    feature_multi_company: "Кілька фірм",
    feature_zk: "Zero-Knowledge режим",
    unlimited: "Безліміт",
    back_home: "На головну",
    faq_title: "Часті питання",
    faq: [
      {
        q: "Чи можу я скасувати в будь-який момент?",
        a: "Так. Pro і Business можна скасувати помісячно (на кінець місяця). Річний план триває 12 місяців і закінчується автоматично — без автопродовження без активного підтвердження.",
      },
      {
        q: "Що з моїми даними після скасування?",
        a: "Ти можеш у будь-який момент вивантажити всі рахунки, клієнтів, чеки та документи у ZIP/CSV/DATEV — також після скасування. Ми не утримуємо твоїх даних.",
      },
      {
        q: "Чи отримаю я рахунок за підписку?",
        a: "Так. Faktivo щомісяця надає рахунок PDF (скачати в кабінеті). Постачальник — Kleinunternehmer § 19 UStG, тому ПДВ не виділяється.",
      },
      {
        q: "Які способи оплати?",
        a: "SEPA-Lastschrift (рекомендовано), кредитна картка (Visa, Mastercard), Apple Pay, Google Pay. Обробка через Mollie / Stripe.",
      },
      {
        q: "Free-план: назавжди чи trial?",
        a: "Безкоштовно назавжди. 3 рахунки на місяць, безліміт на Angebote, E-Rechnung включений. Без прив'язки картки.",
      },
      {
        q: "Чи працює Faktivo, якщо я на Bürgergeld?",
        a: "Так — Anlage EKS для Jobcenter включено у Free (1× на квартал) і Pro/Business безліміт. З усіма Freibeträge § 11b SGB II.",
      },
    ],
    legal_impressum: "Impressum",
    legal_datenschutz: "Захист даних",
    legal_agb: "Умови",
    legal_widerruf: "Відкликання",
  },
}

function fmtEuro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function PricingPage({ locale }: Props) {
  const [billing, setBilling] = React.useState<"monthly" | "yearly">("yearly")
  const t = COPY[locale] ?? COPY.de

  return (
    <div className="bg-background text-foreground min-h-dvh">
      {/* Nav */}
      <header className="bg-background/70 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 backdrop-blur-md md:px-10">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/faktivo-logo.svg"
            alt="Faktivo"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg shadow-sm"
          />
          <div className="grid leading-tight">
            <span className="text-sm font-semibold">Faktivo</span>
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">
              Buchhaltung
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-2 text-sm md:gap-3">
          <LangSwitcher locale={locale} />
          <Link
            href={`/${locale}/login`}
            className="hover:bg-muted rounded-lg px-3 py-1.5 font-medium transition"
          >
            {locale === "de"
              ? "Anmelden"
              : locale === "en"
                ? "Sign in"
                : locale === "uk"
                  ? "Увійти"
                  : "Войти"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-3xl gap-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {t.hero_title}
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-base md:text-lg">
            {t.hero_subtitle}
          </p>

          {/* Toggle */}
          <div className="mx-auto inline-flex items-center gap-1 rounded-full border p-1 text-sm">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium transition",
                billing === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.toggle_monthly}
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition",
                billing === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.toggle_yearly}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  billing === "yearly"
                    ? "bg-primary-foreground/20"
                    : "bg-primary/10 text-primary",
                )}
              >
                {t.toggle_yearly_badge}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isFree = plan.id === "free"
            const monthly =
              billing === "yearly"
                ? plan.price_yearly_per_month_cents
                : plan.price_monthly_cents
            const yearlyTotal = plan.price_yearly_total_cents
            const savingsPct = annualSavingsPct(plan)
            return (
              <div
                key={plan.id}
                className={cn(
                  "bg-card relative grid gap-4 rounded-2xl border p-6 md:p-7",
                  plan.popular
                    ? "border-primary/50 shadow-lg ring-4 ring-primary/10"
                    : "border-border",
                )}
              >
                {plan.popular ? (
                  <div className="bg-primary text-primary-foreground absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    <Sparkles className="size-3" />
                    {t.popular}
                  </div>
                ) : null}

                <div className="grid gap-1">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <p className="text-muted-foreground text-xs leading-snug">
                    {plan.tagline}
                  </p>
                </div>

                <div className="grid gap-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tabular-nums">
                      {monthly === 0 ? "0 €" : `${fmtEuro(monthly)} €`}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {t.per_month}
                    </span>
                  </div>
                  {!isFree && billing === "yearly" ? (
                    <p className="text-muted-foreground text-[11px]">
                      {t.yearly_total_label}: {fmtEuro(yearlyTotal)} € ·{" "}
                      <span className="text-primary">−{savingsPct} %</span>
                    </p>
                  ) : null}
                  {!isFree ? (
                    <p className="text-muted-foreground text-[11px]">
                      {t.no_vat_note}
                    </p>
                  ) : null}
                </div>

                <Link
                  href={isFree ? `/${locale}/sign-up` : `/${locale}/sign-up?plan=${plan.id}&billing=${billing}`}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "hover:bg-muted border",
                  )}
                >
                  {isFree ? t.free_cta : t.paid_cta}
                  <ArrowRight className="size-4" />
                </Link>

                <ul className="text-muted-foreground grid gap-2 border-t pt-4 text-sm">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="text-primary mt-0.5 size-4 shrink-0" />
                      <span className="text-foreground">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Compare table */}
      <section className="bg-muted/30 border-t px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">
            {t.compare_title}
          </h2>
          <div className="bg-card overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-left font-medium">
                    {t.compare_feature}
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      className="px-4 py-3 text-center font-medium"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <FeatureRow
                  label={t.feature_invoices}
                  values={PLANS.map((p) =>
                    p.limits.rechnungen_per_month === "unlimited"
                      ? t.unlimited
                      : String(p.limits.rechnungen_per_month),
                  )}
                />
                <FeatureRow
                  label={t.feature_clients}
                  values={PLANS.map((p) =>
                    p.limits.clients === "unlimited"
                      ? t.unlimited
                      : String(p.limits.clients),
                  )}
                />
                <FeatureRow
                  label={t.feature_eks}
                  values={PLANS.map((p) =>
                    p.limits.eks_per_quarter === "unlimited"
                      ? t.unlimited
                      : String(p.limits.eks_per_quarter),
                  )}
                />
                <FeatureRow
                  label={t.feature_banking}
                  values={PLANS.map((p) => p.limits.banking_sync)}
                />
                <FeatureRow
                  label={t.feature_mahnwesen}
                  values={PLANS.map((p) => p.limits.mahnwesen)}
                />
                <FeatureRow
                  label={t.feature_datev}
                  values={PLANS.map((p) => p.limits.datev_export)}
                />
                <FeatureRow
                  label={t.feature_branding}
                  values={PLANS.map((p) => p.limits.custom_branding)}
                />
                <FeatureRow
                  label={t.feature_ocr}
                  values={PLANS.map((p) => p.limits.ocr)}
                />
                <FeatureRow
                  label={t.feature_elster}
                  values={PLANS.map((p) => p.limits.elster_export)}
                />
                <FeatureRow
                  label={t.feature_multi_company}
                  values={PLANS.map((p) =>
                    typeof p.limits.multi_company === "number"
                      ? String(p.limits.multi_company)
                      : p.limits.multi_company,
                  )}
                />
                <FeatureRow
                  label={t.feature_team}
                  values={PLANS.map((p) => p.limits.team_access)}
                />
                <FeatureRow
                  label={t.feature_api}
                  values={PLANS.map((p) => p.limits.api_access)}
                />
                <FeatureRow
                  label={t.feature_zk}
                  values={PLANS.map((p) => p.limits.zero_knowledge)}
                />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight md:text-3xl">
            {t.faq_title}
          </h2>
          <div className="grid gap-3">
            {t.faq.map((item) => (
              <details
                key={item.q}
                className="bg-card group rounded-xl border p-5"
              >
                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
                  {item.q}
                  <span className="text-muted-foreground text-lg leading-none transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">
            ← {t.back_home}
          </Link>
          <nav className="flex flex-wrap gap-4">
            <Link href={`/${locale}/impressum`} className="hover:text-foreground">
              {t.legal_impressum}
            </Link>
            <Link
              href={`/${locale}/datenschutz`}
              className="hover:text-foreground"
            >
              {t.legal_datenschutz}
            </Link>
            <Link href={`/${locale}/agb`} className="hover:text-foreground">
              {t.legal_agb}
            </Link>
            <Link
              href={`/${locale}/widerruf`}
              className="hover:text-foreground"
            >
              {t.legal_widerruf}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function FeatureRow({
  label,
  values,
}: {
  label: string
  values: (string | boolean)[]
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-4 py-3 text-center">
          {typeof v === "boolean" ? (
            v ? (
              <Check className="text-primary mx-auto size-4" />
            ) : (
              <Minus className="text-muted-foreground/40 mx-auto size-4" />
            )
          ) : (
            <span className="text-sm">{v}</span>
          )}
        </td>
      ))}
    </tr>
  )
}
