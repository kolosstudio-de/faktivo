"use client"

import Link from "next/link"
import {
  ArrowRight,
  Check,
  Cpu,
  Download,
  FileText,
  Globe2,
  KeyRound,
  Languages,
  Lock,
  Receipt,
  Server,
  Shield,
  Smartphone,
  Wallet,
} from "lucide-react"
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"
import * as React from "react"

import { PLANS } from "@/lib/billing/plans"
import { LangSwitcher } from "./lang-switcher"
import { MeshGradient } from "./effects/mesh-gradient"
import { Magnetic } from "./effects/magnetic"
import { Reveal, RevealStagger, RevealItem } from "./effects/reveal"

interface Props {
  locale: string
}

type FeatureItem = string

type I18nBlock = {
  hero_badge: string
  hero_title_main: string
  hero_subtitle: string
  hero_disclaimer: string
  cta_primary: string
  cta_secondary: string
  cta_view_pricing: string
  already_user: string
  sign_in: string
  why_title: string
  why_subtitle: string
  why_1_title: string
  why_1_text: string
  why_2_title: string
  why_2_text: string
  why_3_title: string
  why_3_text: string
  why_4_title: string
  why_4_text: string
  features_title: string
  features: FeatureItem[]
  audience_title: string
  audience_subtitle: string
  audience_1_title: string
  audience_1_text: string
  audience_2_title: string
  audience_2_text: string
  audience_3_title: string
  audience_3_text: string
  trust_title: string
  trust_subtitle: string
  trust_1_title: string
  trust_1_text: string
  trust_2_title: string
  trust_2_text: string
  trust_3_title: string
  trust_3_text: string
  trust_disclaimer: string
  roadmap_title: string
  roadmap_subtitle: string
  roadmap_1_badge: string
  roadmap_1_title: string
  roadmap_1_text: string
  roadmap_2_badge: string
  roadmap_2_title: string
  roadmap_2_text: string
  roadmap_3_badge: string
  roadmap_3_title: string
  roadmap_3_text: string
  pricing_title: string
  pricing_subtitle: string
  pricing_per_month: string
  pricing_inkl_mwst: string
  pricing_view_full: string
  legal_impressum: string
  legal_datenschutz: string
  legal_agb: string
  legal_widerruf: string
  footer_company: string
  footer_anbieter_label: string
}

const COPY: Record<string, I18nBlock> = {
  de: {
    hero_badge: "Buchhaltung für Selbstständige in Deutschland",
    hero_title_main: "Rechnungen, EÜR und Anlage EKS — auf Deutsch, rechtskonform, EU-gehostet.",
    hero_subtitle: "Eine Buchhaltungs-Software für Freiberufler, Bürgergeld-Aufstocker und kleine Agenturen. Konform mit § 14 UStG, § 19 UStG (Kleinunternehmer), GoBD und DSGVO. Daten auf EU-Servern in Frankfurt.",
    hero_disclaimer: "Free-Plan dauerhaft kostenlos · keine Kreditkarte · jederzeit kündbar.",
    cta_primary: "Kostenlos starten",
    cta_secondary: "Anmelden",
    cta_view_pricing: "Preise ansehen",
    already_user: "Schon Kunde?",
    sign_in: "Anmelden",
    why_title: "Was Faktivo besonders macht",
    why_subtitle: "Vier Punkte, die wir bewusst anders bauen als der Standard-SaaS-Markt.",
    why_1_title: "Vier-sprachige Oberfläche",
    why_1_text: "Bedienung auf Deutsch, Englisch, Ukrainisch und Russisch. Generierte PDFs und ELSTER-Exporte bleiben immer auf Deutsch — so wie das Finanzamt es erwartet.",
    why_2_title: "Anlage EKS für Bürgergeld-Aufstocker",
    why_2_text: "Selbstständig und gleichzeitig Bürgergeld-Empfänger? Wir berechnen die Anlage EKS automatisch mit Freibeträgen nach § 11b SGB II. Vorläufige und endgültige Festsetzung als PDF.",
    why_3_title: "100 % EU-Server",
    why_3_text: "Datenbank in Frankfurt (Supabase eu-central-1), Email-Versand über EU-Anbieter. Keine Übermittlung in Drittstaaten ohne Angemessenheitsbeschluss. AVV nach Art. 28 DSGVO auf Anfrage.",
    why_4_title: "GoBD-konformes Archiv",
    why_4_text: "Finalisierte Rechnungen werden gemäß § 147 AO unveränderlich archiviert. 8-Jahre-Aufbewahrungsfrist nach BEG IV (gilt seit 2025). Audit-Log für alle Buchungen.",
    features_title: "Funktionsumfang",
    features: [
      "Angebote · Rechnungen · Stornorechnungen",
      "Belege per Foto/PDF — automatische OCR-Erkennung",
      "Einnahmen & Ausgaben (geschäftlich + privat) getrennt",
      "E-Rechnung XRechnung 3.0 und ZUGFeRD",
      "§ 19 UStG Kleinunternehmer mit 2025-Schwellen",
      "Mahnwesen Stufen 1–3 nach § 288 BGB",
      "Banking-CSV-Import (alle deutschen Banken)",
      "DATEV-Export EXTF 700 für Steuerberater",
      "Anlage EKS für Jobcenter (monatlich + endgültig)",
      "Anlage EÜR nach § 4 Abs. 3 EStG",
      "Kundendatenbank — Excel/PDF-Export jederzeit",
      "Daten-Export aller Stammdaten ohne Lock-In",
    ],
    audience_title: "Für wen Faktivo gedacht ist",
    audience_subtitle: "Drei Gruppen, deren Anforderungen nicht im Standard-Tool abgedeckt sind.",
    audience_1_title: "Bürgergeld-Aufstocker",
    audience_1_text: "Du bist selbstständig und beziehst gleichzeitig Bürgergeld? Wir berechnen deine monatliche Anlage EKS mit allen Freibeträgen nach § 11b SGB II — kein Excel mehr nötig.",
    audience_2_title: "Mehrsprachige Selbstständige",
    audience_2_text: "Du sprichst nicht Deutsch als Muttersprache? Die Bedienoberfläche steht in vier Sprachen zur Verfügung — Rechnungs-PDFs sind aber immer korrekt auf Deutsch.",
    audience_3_title: "Kleine Kreativ-Agenturen",
    audience_3_text: "Projekt-Abrechnung, Retainer-Verträge, mehrere USt-Sätze auf einer Rechnung, § 13b Reverse-Charge für EU-B2B — alles standardmäßig dabei.",
    trust_title: "Sicherheit & Datenhoheit",
    trust_subtitle: "Wie deine Daten heute geschützt sind — und was wir als nächstes bauen.",
    trust_1_title: "Verschlüsselte Speicherung in Deutschland",
    trust_1_text: "Alle Daten werden auf Servern in Frankfurt gehostet (Supabase eu-central-1, AES-256 at rest). Übertragung ausschließlich per TLS 1.3. Kein Datentransfer in Drittstaaten ohne Angemessenheitsbeschluss.",
    trust_2_title: "Zero-Knowledge-Modus (in Entwicklung)",
    trust_2_text: "Optionaler Modus, in dem deine sensiblen Felder (Belege, Beträge, Notizen) bereits im Browser mit deiner Passphrase verschlüsselt werden. Wir sehen dann nur Ciphertext — selbst bei einem Datenleck bleibt dein Inhalt unleserlich.",
    trust_3_title: "Daten-Export ohne Lock-In",
    trust_3_text: "Egal welcher Plan, egal ob aktiv oder gekündigt: Du kannst jederzeit alle Rechnungen, Kunden, Belege und Anlagen als ZIP, CSV oder DATEV exportieren. Wir halten deine Daten nicht fest.",
    trust_disclaimer: "Wir geben heute keine Versprechen, die wir morgen nicht halten können. Roadmap-Punkte sind als „in Entwicklung\" gekennzeichnet — keine Vapor-Ware.",
    roadmap_title: "Roadmap",
    roadmap_subtitle: "Was wir aktuell bauen. Vorbestellungen sind nicht möglich — wir verkaufen nichts, was nicht funktioniert.",
    roadmap_1_badge: "In Entwicklung",
    roadmap_1_title: "Native Mac- & Windows-App",
    roadmap_1_text: "Lokale Desktop-Version: deine Daten bleiben standardmäßig auf deinem Computer. Lizenz-Key statt Online-Zwang — Cloud-Sync ist optional. Ideal wenn du deine Bücher offline führen willst.",
    roadmap_2_badge: "In Planung",
    roadmap_2_title: "Mobile Apps (iOS / Android)",
    roadmap_2_text: "Belege per Kamera erfassen, Rechnungen unterwegs verschicken, Banking-Eingänge prüfen — als nativ mobile App mit Touch-ID/Face-ID-Schutz.",
    roadmap_3_badge: "In Entwicklung",
    roadmap_3_title: "Zero-Knowledge-Verschlüsselung",
    roadmap_3_text: "Optionaler Premium-Modus: client-seitige AES-256-Verschlüsselung mit deiner Master-Passphrase. Wir sehen ausschließlich Ciphertext, nicht einmal mit Server-Vollzugriff lesbar.",
    pricing_title: "Preise",
    pricing_subtitle: "Free dauerhaft kostenlos. Pro und Business mit Monats- oder Jahres-Abo, jederzeit kündbar.",
    pricing_per_month: "/ Monat",
    pricing_inkl_mwst: "Endpreis · keine USt (§ 19 UStG, Kleinunternehmer)",
    pricing_view_full: "Detaillierte Preise & Vergleich",
    legal_impressum: "Impressum",
    legal_datenschutz: "Datenschutz",
    legal_agb: "AGB",
    legal_widerruf: "Widerruf",
    footer_company: "Faktivo · Buchhaltung für Selbstständige",
    footer_anbieter_label: "Anbieter",
  },
  en: {
    hero_badge: "Bookkeeping for self-employed people in Germany",
    hero_title_main: "Invoices, EÜR and Anlage EKS — in German, legally compliant, EU-hosted.",
    hero_subtitle: "A bookkeeping app for freelancers, Bürgergeld top-up recipients and small agencies. Compliant with § 14 UStG, § 19 UStG (small-business scheme), GoBD and GDPR. Data hosted on EU servers in Frankfurt.",
    hero_disclaimer: "Free plan stays free forever · no credit card · cancel anytime.",
    cta_primary: "Get started — free",
    cta_secondary: "Sign in",
    cta_view_pricing: "View pricing",
    already_user: "Already a customer?",
    sign_in: "Sign in",
    why_title: "What makes Faktivo different",
    why_subtitle: "Four points we deliberately build differently from the standard SaaS approach.",
    why_1_title: "Four-language interface",
    why_1_text: "Use the app in German, English, Ukrainian or Russian. Generated PDFs and ELSTER exports always stay in German — exactly how the Finanzamt expects them.",
    why_2_title: "Anlage EKS for Bürgergeld recipients",
    why_2_text: "Self-employed and on Bürgergeld? We generate the Anlage EKS automatically using the § 11b SGB II allowances. Both preliminary and final assessments as PDF.",
    why_3_title: "100 % EU servers",
    why_3_text: "Database in Frankfurt (Supabase eu-central-1), email delivery via EU providers. No transfer to third countries without an adequacy decision. DPA under Art. 28 GDPR available on request.",
    why_4_title: "GoBD-compliant archive",
    why_4_text: "Finalised invoices are archived immutably under § 147 AO. 8-year retention period under BEG IV (in force since 2025). Audit log for every booking.",
    features_title: "Feature set",
    features: [
      "Quotes · Invoices · Cancellation invoices",
      "Receipts via photo/PDF with automatic OCR",
      "Income & expenses (business + private) tracked separately",
      "E-Invoice XRechnung 3.0 and ZUGFeRD",
      "§ 19 UStG small-business with 2025 thresholds",
      "Reminder process levels 1–3 (§ 288 BGB)",
      "Banking CSV import (all German banks)",
      "DATEV export EXTF 700 for tax advisor",
      "Anlage EKS for Jobcenter (monthly + final)",
      "Anlage EÜR under § 4 (3) EStG",
      "Client database — Excel/PDF export anytime",
      "Full data export, no lock-in",
    ],
    audience_title: "Who Faktivo is for",
    audience_subtitle: "Three groups whose needs are not covered by the standard tool.",
    audience_1_title: "Bürgergeld top-up recipients (Aufstocker)",
    audience_1_text: "You are self-employed and also receive Bürgergeld? We calculate your monthly Anlage EKS with all § 11b SGB II allowances — no more Excel.",
    audience_2_title: "Multi-language self-employed",
    audience_2_text: "Not a native German speaker? The user interface is available in four languages — invoice PDFs are always rendered correctly in German.",
    audience_3_title: "Small creative agencies",
    audience_3_text: "Project-based billing, retainer contracts, multiple VAT rates on one invoice, § 13b reverse charge for EU B2B — all included by default.",
    trust_title: "Security & data sovereignty",
    trust_subtitle: "How your data is protected today — and what we are building next.",
    trust_1_title: "Encrypted storage in Germany",
    trust_1_text: "All data is hosted on servers in Frankfurt (Supabase eu-central-1, AES-256 at rest). Transit only over TLS 1.3. No transfer to third countries without an adequacy decision.",
    trust_2_title: "Zero-knowledge mode (in development)",
    trust_2_text: "Optional mode where your sensitive fields (receipts, amounts, notes) are encrypted in the browser with your passphrase before they ever reach our servers. We only see ciphertext — even a database breach would not reveal your content.",
    trust_3_title: "Data export with no lock-in",
    trust_3_text: "No matter the plan, no matter if active or cancelled: you can export every invoice, client, receipt and document as ZIP, CSV or DATEV any time. We don't hold your data hostage.",
    trust_disclaimer: "We don't promise today what we can't deliver tomorrow. Items marked \"in development\" are exactly that — no vapor-ware.",
    roadmap_title: "Roadmap",
    roadmap_subtitle: "What we are actively building. No pre-orders — we don't sell what doesn't work yet.",
    roadmap_1_badge: "In development",
    roadmap_1_title: "Native Mac & Windows app",
    roadmap_1_text: "Local desktop version: your data stays on your machine by default. License key instead of online-only — cloud sync is optional. Ideal if you want to run your books offline.",
    roadmap_2_badge: "Planned",
    roadmap_2_title: "Mobile apps (iOS / Android)",
    roadmap_2_text: "Capture receipts with the camera, send invoices on the go, check banking inflows — as a native mobile app with Touch-ID / Face-ID protection.",
    roadmap_3_badge: "In development",
    roadmap_3_title: "Zero-knowledge encryption",
    roadmap_3_text: "Optional premium mode: client-side AES-256 encryption with your master passphrase. We only see ciphertext — not even server admins can read your content.",
    pricing_title: "Pricing",
    pricing_subtitle: "Free forever. Pro and Business with monthly or annual subscription, cancellable any time.",
    pricing_per_month: "/ month",
    pricing_inkl_mwst: "Final price · no VAT (§ 19 UStG, small-business scheme)",
    pricing_view_full: "Detailed pricing & comparison",
    legal_impressum: "Imprint",
    legal_datenschutz: "Privacy",
    legal_agb: "Terms",
    legal_widerruf: "Right of withdrawal",
    footer_company: "Faktivo · Bookkeeping for the self-employed",
    footer_anbieter_label: "Provider",
  },
  ru: {
    hero_badge: "Бухгалтерия для самозанятых в Германии",
    hero_title_main: "Счета, EÜR и Anlage EKS — на немецком, по закону, серверы в ЕС.",
    hero_subtitle: "Бухгалтерия для фрилансеров, Bürgergeld-Aufstocker и небольших агентств. Соответствие § 14 UStG, § 19 UStG (Kleinunternehmer), GoBD и DSGVO. Данные на серверах в Германии (Франкфурт).",
    hero_disclaimer: "Free-план бесплатен навсегда · без карты · отмена в любой момент.",
    cta_primary: "Начать бесплатно",
    cta_secondary: "Войти",
    cta_view_pricing: "Цены",
    already_user: "Уже клиент?",
    sign_in: "Войти",
    why_title: "Что отличает Faktivo",
    why_subtitle: "Четыре пункта, которые мы сознательно делаем иначе, чем стандартный SaaS.",
    why_1_title: "Интерфейс на 4 языках",
    why_1_text: "Приложение на немецком, английском, украинском и русском. Сгенерированные PDF и ELSTER-экспорты всегда остаются на немецком — как этого требует Finanzamt.",
    why_2_title: "Anlage EKS для Bürgergeld-Aufstocker",
    why_2_text: "Самозанятость + Bürgergeld? Считаем Anlage EKS автоматически с Freibeträge по § 11b SGB II. Vorläufige и Endgültige Festsetzung в PDF.",
    why_3_title: "100 % серверы в ЕС",
    why_3_text: "База данных во Франкфурте (Supabase eu-central-1), email через EU-провайдеров. Никаких передач в третьи страны без решения о соответствии. AVV по ст. 28 DSGVO по запросу.",
    why_4_title: "GoBD-архив",
    why_4_text: "Финализированные счета архивируются неизменяемо по § 147 AO. Срок хранения 8 лет по BEG IV (в силе с 2025). Audit-Log на каждую проводку.",
    features_title: "Возможности",
    features: [
      "Angebote · Rechnungen · Storno",
      "Чеки фото/PDF — авто-распознавание OCR",
      "Доходы и расходы (бизнес + частные) раздельно",
      "E-Rechnung XRechnung 3.0 + ZUGFeRD",
      "§ 19 UStG Kleinunternehmer с порогами 2025",
      "Mahnwesen 1–3 ступени (§ 288 BGB)",
      "CSV-импорт банковских выписок",
      "DATEV EXTF 700 экспорт",
      "Anlage EKS для Jobcenter (месяц + endgültig)",
      "Anlage EÜR по § 4 Abs. 3 EStG",
      "База клиентов — экспорт Excel/PDF",
      "Полный экспорт данных без Lock-In",
    ],
    audience_title: "Для кого",
    audience_subtitle: "Три категории, чьи требования стандартный инструмент не закрывает.",
    audience_1_title: "Aufstocker (получатели Bürgergeld)",
    audience_1_text: "Самозанятый + Bürgergeld? Считаем месячный EKS со всеми Freibeträge § 11b SGB II — забудь про Excel.",
    audience_2_title: "Многоязычные самозанятые",
    audience_2_text: "Если немецкий — не родной язык: интерфейс на 4 языках, PDF-счета всегда корректно на немецком.",
    audience_3_title: "Небольшие креативные агентства",
    audience_3_text: "Проектная Abrechnung, ретейнеры, несколько USt-ставок в одном счёте, § 13b Reverse-Charge для EU-B2B — всё включено.",
    trust_title: "Безопасность и контроль данных",
    trust_subtitle: "Как твои данные защищены сейчас — и что мы строим дальше.",
    trust_1_title: "Зашифрованное хранение в Германии",
    trust_1_text: "Все данные хостятся на серверах во Франкфурте (Supabase eu-central-1, AES-256 at rest). Передача только по TLS 1.3. Никаких передач в третьи страны без решения о соответствии.",
    trust_2_title: "Zero-Knowledge режим (в разработке)",
    trust_2_text: "Опциональный режим, в котором чувствительные поля (чеки, суммы, заметки) шифруются в браузере с твоей passphrase до отправки на сервер. Мы видим только ciphertext — даже при утечке БД содержимое останется нечитаемым.",
    trust_3_title: "Экспорт без Lock-In",
    trust_3_text: "Любой план, активный или отменённый: ты можешь в любой момент выгрузить все счета, клиентов, чеки и документы в ZIP, CSV или DATEV. Мы не удерживаем твои данные.",
    trust_disclaimer: "Мы не обещаем сегодня то, что не сможем доставить завтра. Пункты со статусом «в разработке» — это именно разработка, не vapor-ware.",
    roadmap_title: "Roadmap",
    roadmap_subtitle: "Что мы активно делаем. Без предзаказов — не продаём то, что ещё не работает.",
    roadmap_1_badge: "В разработке",
    roadmap_1_title: "Native Mac & Windows приложение",
    roadmap_1_text: "Локальная desktop-версия: данные по умолчанию остаются на твоём компьютере. License-key вместо онлайн-зависимости, sync в облако опциональный. Идеально если хочешь вести бухгалтерию офлайн.",
    roadmap_2_badge: "В планах",
    roadmap_2_title: "Мобильные приложения (iOS / Android)",
    roadmap_2_text: "Чеки с камеры, отправка счетов на ходу, проверка банковских поступлений — нативное мобильное приложение с защитой Touch-ID / Face-ID.",
    roadmap_3_badge: "В разработке",
    roadmap_3_title: "Zero-Knowledge шифрование",
    roadmap_3_text: "Опциональный premium-режим: client-side AES-256 шифрование с твоей master passphrase. Мы видим только ciphertext — даже админ сервера не сможет прочитать.",
    pricing_title: "Цены",
    pricing_subtitle: "Free навсегда бесплатен. Pro и Business — месячная или годовая подписка, отмена в любой момент.",
    pricing_per_month: "/ месяц",
    pricing_inkl_mwst: "Конечная цена · без НДС (§ 19 UStG, Kleinunternehmer)",
    pricing_view_full: "Детальные цены и сравнение",
    legal_impressum: "Impressum",
    legal_datenschutz: "Защита данных",
    legal_agb: "Условия",
    legal_widerruf: "Отзыв",
    footer_company: "Faktivo · Бухгалтерия для самозанятых",
    footer_anbieter_label: "Поставщик",
  },
  uk: {
    hero_badge: "Бухгалтерія для самозайнятих у Німеччині",
    hero_title_main: "Рахунки, EÜR і Anlage EKS — німецькою, відповідно до закону, сервери в ЄС.",
    hero_subtitle: "Бухгалтерія для фрілансерів, Bürgergeld-Aufstocker і невеликих агенцій. Відповідає § 14 UStG, § 19 UStG (Kleinunternehmer), GoBD і DSGVO. Дані на серверах у Німеччині (Франкфурт).",
    hero_disclaimer: "Free-план безкоштовний назавжди · без картки · скасування в будь-який момент.",
    cta_primary: "Почати безкоштовно",
    cta_secondary: "Увійти",
    cta_view_pricing: "Ціни",
    already_user: "Вже клієнт?",
    sign_in: "Увійти",
    why_title: "Що вирізняє Faktivo",
    why_subtitle: "Чотири пункти, які ми свідомо робимо інакше, ніж стандартний SaaS.",
    why_1_title: "Інтерфейс на 4 мовах",
    why_1_text: "Застосунок німецькою, англійською, українською та російською. Згенеровані PDF та ELSTER-експорти завжди залишаються німецькою — так, як цього вимагає Finanzamt.",
    why_2_title: "Anlage EKS для Bürgergeld-Aufstocker",
    why_2_text: "Самозайнятість + Bürgergeld? Рахуємо Anlage EKS автоматично з Freibeträge § 11b SGB II. Vorläufige та Endgültige Festsetzung як PDF.",
    why_3_title: "100 % сервери ЄС",
    why_3_text: "База даних у Франкфурті (Supabase eu-central-1), email через EU-провайдерів. Жодних передач у треті країни без рішення про відповідність. AVV за ст. 28 DSGVO на запит.",
    why_4_title: "GoBD-архів",
    why_4_text: "Фіналізовані рахунки архівуються незмінно за § 147 AO. Термін зберігання 8 років за BEG IV (чинний з 2025). Audit-Log на кожну проводку.",
    features_title: "Можливості",
    features: [
      "Angebote · Rechnungen · Storno",
      "Чеки фото/PDF — авто-розпізнавання OCR",
      "Доходи та витрати (бізнес + приватні) окремо",
      "E-Rechnung XRechnung 3.0 + ZUGFeRD",
      "§ 19 UStG Kleinunternehmer з порогами 2025",
      "Mahnwesen 1–3 ступені (§ 288 BGB)",
      "CSV-імпорт банківських виписок",
      "DATEV EXTF 700 експорт",
      "Anlage EKS для Jobcenter (місяць + endgültig)",
      "Anlage EÜR за § 4 Abs. 3 EStG",
      "База клієнтів — експорт Excel/PDF",
      "Повний експорт даних без Lock-In",
    ],
    audience_title: "Для кого",
    audience_subtitle: "Три категорії, чиї вимоги стандартний інструмент не закриває.",
    audience_1_title: "Aufstocker (отримувачі Bürgergeld)",
    audience_1_text: "Самозайнятий + Bürgergeld? Рахуємо місячний EKS з усіма Freibeträge § 11b SGB II — забудь про Excel.",
    audience_2_title: "Багатомовні самозайняті",
    audience_2_text: "Якщо німецька — не рідна мова: інтерфейс 4 мовами, PDF-рахунки завжди коректно німецькою.",
    audience_3_title: "Невеликі креативні агенції",
    audience_3_text: "Проєктна Abrechnung, ретейнери, кілька USt-ставок в одному рахунку, § 13b Reverse-Charge для EU-B2B — все включено.",
    trust_title: "Безпека та контроль даних",
    trust_subtitle: "Як твої дані захищені зараз — і що ми будуємо далі.",
    trust_1_title: "Зашифроване зберігання в Німеччині",
    trust_1_text: "Усі дані хостяться на серверах у Франкфурті (Supabase eu-central-1, AES-256 at rest). Передача тільки через TLS 1.3. Жодних передач у треті країни без рішення про відповідність.",
    trust_2_title: "Zero-Knowledge режим (у розробці)",
    trust_2_text: "Опціональний режим, у якому чутливі поля (чеки, суми, нотатки) шифруються в браузері з твоєю passphrase до відправки на сервер. Ми бачимо тільки ciphertext — навіть при витоку БД вміст залишиться нечитаним.",
    trust_3_title: "Експорт без Lock-In",
    trust_3_text: "Будь-який план, активний чи скасований: ти можеш у будь-який момент вивантажити всі рахунки, клієнтів, чеки і документи у ZIP, CSV або DATEV. Ми не утримуємо твоїх даних.",
    trust_disclaimer: "Ми не обіцяємо сьогодні те, що не зможемо доставити завтра. Пункти зі статусом «у розробці» — це саме розробка, не vapor-ware.",
    roadmap_title: "Roadmap",
    roadmap_subtitle: "Що ми активно робимо. Без передзамовлень — не продаємо те, що ще не працює.",
    roadmap_1_badge: "У розробці",
    roadmap_1_title: "Native Mac & Windows застосунок",
    roadmap_1_text: "Локальна desktop-версія: дані за замовчуванням залишаються на твоєму комп'ютері. License-key замість онлайн-залежності, sync у хмару опціональний. Ідеально якщо хочеш вести бухгалтерію офлайн.",
    roadmap_2_badge: "У планах",
    roadmap_2_title: "Мобільні застосунки (iOS / Android)",
    roadmap_2_text: "Чеки з камери, відправка рахунків на ходу, перевірка банківських надходжень — нативний мобільний застосунок із захистом Touch-ID / Face-ID.",
    roadmap_3_badge: "У розробці",
    roadmap_3_title: "Zero-Knowledge шифрування",
    roadmap_3_text: "Опціональний premium-режим: client-side AES-256 шифрування з твоєю master passphrase. Ми бачимо тільки ciphertext — навіть адмін сервера не зможе прочитати.",
    pricing_title: "Ціни",
    pricing_subtitle: "Free назавжди безкоштовний. Pro і Business — щомісячна або річна підписка, скасовується в будь-який момент.",
    pricing_per_month: "/ місяць",
    pricing_inkl_mwst: "Кінцева ціна · без ПДВ (§ 19 UStG, Kleinunternehmer)",
    pricing_view_full: "Детальні ціни та порівняння",
    legal_impressum: "Impressum",
    legal_datenschutz: "Захист даних",
    legal_agb: "Умови",
    legal_widerruf: "Відкликання",
    footer_company: "Faktivo · Бухгалтерія для самозайнятих",
    footer_anbieter_label: "Постачальник",
  },
}

export function LandingPage({ locale }: Props) {
  const t = COPY[locale] ?? COPY.de
  return (
    <div className="bg-background text-foreground min-h-dvh overflow-x-clip">
      <NavBar locale={locale} signInLabel={t.sign_in} alreadyLabel={t.already_user} />
      <Hero t={t} locale={locale} />
      <WhySection t={t} />
      <FeaturesSection t={t} />
      <AudienceSection t={t} />
      <TrustSection t={t} />
      <RoadmapSection t={t} />
      <PricingSection t={t} locale={locale} />
      <Footer t={t} locale={locale} />
    </div>
  )
}

// ─── NavBar ─────────────────────────────────────────────────────────────

function NavBar({
  locale,
  signInLabel,
  alreadyLabel,
}: {
  locale: string
  signInLabel: string
  alreadyLabel: string
}) {
  return (
    <motion.header
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="bg-background/60 sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 px-6 backdrop-blur-xl md:px-10"
    >
      <Link href={`/${locale}`} className="group flex items-center gap-2.5">
        <span className="bg-foreground text-background grid size-9 shrink-0 place-items-center rounded-2xl text-base font-medium transition-transform duration-300 group-hover:rotate-[-6deg]">
          F
        </span>
        <div className="grid leading-tight">
          <span className="text-sm font-medium tracking-tight">Faktivo</span>
          <span className="text-muted-foreground text-[10px] tracking-[0.08em] uppercase">
            Buchhaltung
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 text-sm md:gap-3">
        <Link
          href={`/${locale}/pricing`}
          className="text-muted-foreground hover:text-foreground hidden rounded-full px-4 py-1.5 font-medium transition md:inline-block"
        >
          {locale === "de" ? "Preise" : locale === "en" ? "Pricing" : locale === "uk" ? "Ціни" : "Цены"}
        </Link>
        <LangSwitcher locale={locale} />
        <span className="text-muted-foreground hidden md:inline">{alreadyLabel}</span>
        <Link
          href={`/${locale}/login`}
          className="hover:bg-muted rounded-full px-4 py-1.5 font-medium transition"
        >
          {signInLabel}
        </Link>
      </div>
    </motion.header>
  )
}

// ─── Hero — animated mesh + display typography + magnetic CTA ───────────

function Hero({ t, locale }: { t: I18nBlock; locale: string }) {
  const prefersReduced = useReducedMotion()
  const heroRef = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -80])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  // Split title into words for word-by-word stagger reveal.
  const words = t.hero_title_main.split(" ")

  return (
    <section ref={heroRef} className="relative overflow-hidden">
      <MeshGradient />

      <motion.div
        style={prefersReduced ? undefined : { y: titleY, opacity: titleOpacity }}
        className="relative mx-auto flex max-w-4xl flex-col items-center gap-7 px-6 py-24 text-center md:py-36"
      >
        {/* Badge — fade up first */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <span className="bg-background/60 ring-foreground/10 ring-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-md">
            <span className="bg-emerald-500 size-1.5 rounded-full animate-pulse" />
            {t.hero_badge}
          </span>
        </motion.div>

        {/* Title — word-by-word stagger with display-serif italic accents */}
        <h1 className="font-heading text-balance text-4xl font-medium leading-[1.05] tracking-[-0.025em] md:text-6xl lg:text-[72px]">
          {words.map((w, i) => {
            const isAccent = ACCENT_KEYWORDS.has(w.replace(/[.,—]/g, ""))
            return (
              <motion.span
                key={`${w}-${i}`}
                initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.7,
                  delay: 0.2 + i * 0.04,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                className={
                  isAccent
                    ? "font-display italic font-normal text-foreground/90 mx-1 [letter-spacing:-0.02em]"
                    : "inline-block mx-1"
                }
              >
                {w}
              </motion.span>
            )
          })}
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="text-muted-foreground mx-auto max-w-2xl text-balance text-base leading-relaxed md:text-lg"
        >
          {t.hero_subtitle}
        </motion.p>

        {/* CTAs — magnetic primary + ghost secondary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.75 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Magnetic strength={0.35}>
            <Link
              href={`/${locale}/sign-up`}
              className="group bg-foreground text-background hover:bg-foreground/90 relative inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium shadow-lg shadow-foreground/10 transition-colors"
            >
              {/* Inner glow on hover */}
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <span className="relative">{t.cta_primary}</span>
              <ArrowRight className="relative size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Magnetic>
          <Magnetic strength={0.2}>
            <Link
              href={`/${locale}/pricing`}
              className="group ring-foreground/15 hover:ring-foreground/30 hover:bg-muted/50 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-medium ring-1 transition"
            >
              {t.cta_view_pricing}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Magnetic>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1 }}
          className="text-muted-foreground text-xs"
        >
          {t.hero_disclaimer}
        </motion.p>
      </motion.div>

      {/* Scroll-down hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block"
      >
        <motion.div
          animate={prefersReduced ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="ring-foreground/15 grid size-9 place-items-center rounded-full ring-1"
        >
          <ArrowRight className="text-muted-foreground size-4 rotate-90" />
        </motion.div>
      </motion.div>
    </section>
  )
}

// Words rendered in italic display serif. We pick semantically meaningful
// nouns from each locale — keeps the editorial accent consistent across DE/EN/RU/UK.
const ACCENT_KEYWORDS = new Set([
  "EÜR",
  "EKS",
  "Anlage",
  "Rechnungen",
  "Deutsch",
  "Invoices",
  "compliant",
  "EU-hosted",
  "EU-gehostet",
  "Счета",
  "Рахунки",
  "rechtskonform",
])

// ─── Why-Section ─────────────────────────────────────────────────────────

function WhySection({ t }: { t: I18nBlock }) {
  const cards = [
    { icon: Languages, title: t.why_1_title, text: t.why_1_text, tone: "emerald" },
    { icon: FileText, title: t.why_2_title, text: t.why_2_text, tone: "amber" },
    { icon: Lock, title: t.why_3_title, text: t.why_3_text, tone: "blue" },
    { icon: Shield, title: t.why_4_title, text: t.why_4_text, tone: "violet" },
  ] as const

  return (
    <section className="border-t border-border/50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
            {t.why_title}
          </h2>
          <p className="text-muted-foreground mt-4 text-balance text-base md:text-lg">
            {t.why_subtitle}
          </p>
        </Reveal>
        <RevealStagger className="grid gap-4 md:grid-cols-2">
          {cards.map(({ icon: Icon, title, text, tone }) => (
            <RevealItem key={title} className="h-full">
              <FeatureCard icon={Icon} title={title} text={text} tone={tone} />
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}

const TONE_CHIP: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "bg-[#5266eb]/10 text-[#5266eb] dark:text-[#7c8cf5]",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

function FeatureCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
  tone: string
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="group bg-card ring-foreground/8 dark:ring-white/8 relative grid h-full gap-4 overflow-hidden rounded-3xl p-7 ring-1 transition-shadow duration-300 hover:shadow-2xl hover:shadow-foreground/5 dark:hover:shadow-black/40"
    >
      {/* Decorative glow on hover */}
      <div className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-gradient-to-br from-foreground/0 via-foreground/0 to-foreground/5 opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
      <div className={`relative grid size-12 place-items-center rounded-2xl ${TONE_CHIP[tone]}`}>
        <Icon className="size-5" />
      </div>
      <h3 className="font-heading relative text-xl font-medium tracking-tight">{title}</h3>
      <p className="text-muted-foreground relative text-sm leading-relaxed">{text}</p>
    </motion.div>
  )
}

// ─── Features ───────────────────────────────────────────────────────────

function FeaturesSection({ t }: { t: I18nBlock }) {
  return (
    <section className="bg-muted/40 border-t border-border/50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mb-12 text-center">
          <h2 className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
            <Receipt className="text-foreground/60 mr-2 inline size-7" />
            {t.features_title}
          </h2>
        </Reveal>
        <RevealStagger className="grid gap-2.5 md:grid-cols-2" amount={0.05}>
          {t.features.map((f) => (
            <RevealItem key={f}>
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ duration: 0.2 }}
                className="bg-card ring-foreground/8 dark:ring-white/6 flex items-start gap-3 rounded-2xl p-4 text-sm ring-1 transition-shadow hover:shadow-lg hover:shadow-foreground/5"
              >
                <span className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span>{f}</span>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}

// ─── Audience ───────────────────────────────────────────────────────────

function AudienceSection({ t }: { t: I18nBlock }) {
  const cards = [
    { num: "01", title: t.audience_1_title, text: t.audience_1_text },
    { num: "02", title: t.audience_2_title, text: t.audience_2_text },
    { num: "03", title: t.audience_3_title, text: t.audience_3_text },
  ]
  return (
    <section className="border-t border-border/50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
            {t.audience_title}
          </h2>
          <p className="text-muted-foreground mt-4 text-balance text-base md:text-lg">
            {t.audience_subtitle}
          </p>
        </Reveal>
        <RevealStagger className="grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <RevealItem key={c.num} className="h-full">
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="bg-card ring-foreground/8 dark:ring-white/8 group relative grid h-full gap-3 overflow-hidden rounded-3xl p-7 ring-1 transition-shadow hover:shadow-2xl hover:shadow-foreground/5"
              >
                <span className="font-display text-foreground/15 group-hover:text-foreground/35 absolute -top-2 -right-2 select-none text-[120px] italic leading-none transition-colors duration-500">
                  {c.num}
                </span>
                <h3 className="font-heading relative mt-2 text-xl font-medium tracking-tight">
                  {c.title}
                </h3>
                <p className="text-muted-foreground relative text-sm leading-relaxed">{c.text}</p>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}

// ─── Trust ──────────────────────────────────────────────────────────────

function TrustSection({ t }: { t: I18nBlock }) {
  const cards = [
    { icon: Server, title: t.trust_1_title, text: t.trust_1_text, tone: "emerald" },
    { icon: KeyRound, title: t.trust_2_title, text: t.trust_2_text, tone: "blue" },
    { icon: Download, title: t.trust_3_title, text: t.trust_3_text, tone: "amber" },
  ] as const
  return (
    <section className="bg-muted/40 border-t border-border/50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
            <Shield className="text-foreground/60 mr-2 inline size-7" />
            {t.trust_title}
          </h2>
          <p className="text-muted-foreground mt-4 text-balance text-base md:text-lg">
            {t.trust_subtitle}
          </p>
        </Reveal>
        <RevealStagger className="grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, text, tone }) => (
            <RevealItem key={title} className="h-full">
              <FeatureCard icon={Icon} title={title} text={text} tone={tone} />
            </RevealItem>
          ))}
        </RevealStagger>
        <Reveal>
          <p className="text-muted-foreground mx-auto mt-10 max-w-3xl text-balance text-center text-xs leading-relaxed">
            {t.trust_disclaimer}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Roadmap ────────────────────────────────────────────────────────────

function RoadmapSection({ t }: { t: I18nBlock }) {
  const cards = [
    { icon: Cpu, badge: t.roadmap_1_badge, title: t.roadmap_1_title, text: t.roadmap_1_text },
    { icon: Smartphone, badge: t.roadmap_2_badge, title: t.roadmap_2_title, text: t.roadmap_2_text },
    { icon: KeyRound, badge: t.roadmap_3_badge, title: t.roadmap_3_title, text: t.roadmap_3_text },
  ]
  return (
    <section className="border-t border-border/50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
            <Globe2 className="text-foreground/60 mr-2 inline size-7" />
            {t.roadmap_title}
          </h2>
          <p className="text-muted-foreground mt-4 text-balance text-base md:text-lg">
            {t.roadmap_subtitle}
          </p>
        </Reveal>
        <RevealStagger className="grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, badge, title, text }) => (
            <RevealItem key={title} className="h-full">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
                className="bg-card ring-foreground/8 dark:ring-white/8 grid h-full gap-3 rounded-3xl p-7 ring-1 transition-shadow hover:shadow-2xl hover:shadow-foreground/5"
              >
                <div className="flex items-center justify-between">
                  <div className="bg-muted/80 grid size-12 place-items-center rounded-2xl">
                    <Icon className="size-5" />
                  </div>
                  <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded-full px-3 py-1 text-[10px] font-medium tracking-[0.08em] uppercase">
                    {badge}
                  </span>
                </div>
                <h3 className="font-heading text-xl font-medium leading-tight tracking-tight">
                  {title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}

// ─── Pricing ────────────────────────────────────────────────────────────

function PricingSection({ t, locale }: { t: I18nBlock; locale: string }) {
  return (
    <section className="bg-muted/40 border-t border-border/50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-medium tracking-tight md:text-5xl">
            <Wallet className="text-foreground/60 mr-2 inline size-7" />
            {t.pricing_title}
          </h2>
          <p className="text-muted-foreground mt-4 text-balance text-base md:text-lg">
            {t.pricing_subtitle}
          </p>
        </Reveal>
        <RevealStagger className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <RevealItem key={p.id} className="h-full">
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.3 }}
                className={`relative grid h-full gap-3 overflow-hidden rounded-3xl p-7 transition-shadow hover:shadow-2xl ${
                  p.popular
                    ? "bg-foreground text-background shadow-2xl shadow-foreground/20 ring-2 ring-foreground"
                    : "bg-card ring-foreground/8 dark:ring-white/8 ring-1"
                }`}
              >
                {p.popular ? (
                  <span className="bg-emerald-500 text-white absolute top-5 right-5 rounded-full px-3 py-1 text-[10px] font-medium tracking-[0.08em] uppercase">
                    Beliebt
                  </span>
                ) : null}
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-xl font-medium tracking-tight">{p.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-5xl font-medium tabular-nums tracking-tight">
                    {p.price_monthly_cents === 0
                      ? "0 €"
                      : `${(p.price_monthly_cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                  </span>
                </div>
                <span className={`text-sm ${p.popular ? "text-background/60" : "text-muted-foreground"}`}>
                  {t.pricing_per_month}
                </span>
                {p.price_monthly_cents > 0 ? (
                  <p className={`text-[11px] ${p.popular ? "text-background/50" : "text-muted-foreground"}`}>
                    {t.pricing_inkl_mwst}
                  </p>
                ) : null}
                <ul className="mt-3 grid gap-2 text-sm">
                  {p.highlights.slice(0, 5).map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check
                        className={`mt-0.5 size-4 shrink-0 ${p.popular ? "text-emerald-300" : "text-emerald-600 dark:text-emerald-400"}`}
                        strokeWidth={2.5}
                      />
                      <span className={p.popular ? "text-background/85" : ""}>{h}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </RevealItem>
          ))}
        </RevealStagger>
        <Reveal className="mt-10 text-center">
          <Magnetic strength={0.2}>
            <Link
              href={`/${locale}/pricing`}
              className="group ring-foreground/15 hover:ring-foreground/30 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium ring-1 transition"
            >
              {t.pricing_view_full}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ─────────────────────────────────────────────────────────────

function Footer({ t, locale }: { t: I18nBlock; locale: string }) {
  return (
    <footer className="bg-background border-t border-border/50 px-6 py-12">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="text-sm font-medium">{t.footer_company}</p>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {t.footer_anbieter_label}: Vasyl Kolos · Rückäckerweg 4, 93055 Regensburg (DE).
            <br />
            Kleinunternehmer nach § 19 UStG. Hosting: Supabase EU (Frankfurt).
          </p>
        </div>
        <nav className="grid gap-1.5 text-xs">
          <Link href={`/${locale}/pricing`} className="text-muted-foreground hover:text-foreground transition">
            {t.cta_view_pricing}
          </Link>
          <Link href={`/${locale}/impressum`} className="text-muted-foreground hover:text-foreground transition">
            {t.legal_impressum}
          </Link>
          <Link href={`/${locale}/datenschutz`} className="text-muted-foreground hover:text-foreground transition">
            {t.legal_datenschutz}
          </Link>
          <Link href={`/${locale}/agb`} className="text-muted-foreground hover:text-foreground transition">
            {t.legal_agb}
          </Link>
          <Link href={`/${locale}/widerruf`} className="text-muted-foreground hover:text-foreground transition">
            {t.legal_widerruf}
          </Link>
        </nav>
        <div className="text-muted-foreground grid gap-1.5 text-xs">
          <p className="text-foreground font-medium">DSGVO</p>
          <p className="leading-relaxed">
            Auftragsverarbeitungsvertrag (Art. 28 DSGVO) auf Anfrage. Kein Datentransfer in
            Drittstaaten.
          </p>
        </div>
      </div>
      <div className="text-muted-foreground mx-auto mt-8 flex max-w-5xl flex-col items-start justify-between gap-2 border-t border-border/40 pt-4 text-[11px] md:flex-row">
        <p>© {new Date().getFullYear()} Faktivo · Vasyl Kolos</p>
        <p>Made in Regensburg · Hosted in Frankfurt</p>
      </div>
    </footer>
  )
}
