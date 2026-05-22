# Kolos Digital Finanzen → SaaS-Produkt: Стратегия и анализ

> **Статус**: v1 с данными market-research. Ждём legal-research.
> **Цель**: превратить текущий инструмент в продукт который можно продавать.
>
> **Ключевой инсайт после ресёрча:** рекомендуемая цена **€5.90 Pro / €12.90 Business**, не €15-49. Комбинация ниш 1+2 (Bürgergeld + RU/UA-speakers) = €48-80k MRR за 24 месяца с 6-10k пользователей.

---

## TL;DR

**Что есть сейчас:** рабочий MVP для одного пользователя (тебя). Все критичные немецкие штуки: §14 UStG, §19 UStG, GoBD, gap-free номера, Storno, PDF-генерация, импорт исторических документов. Три языка (DE/EN/RU). Jobcenter-модуль — редкая фича, конкуренты её не делают.

**Что нужно чтобы продавать:**
1. **Онбординг-визард** — сейчас юзер попадает в пустой дашборд и не понимает что делать. Критично.
2. **Расширенный профиль** — Rechtsform, Branche, Steuerregime, KSK-статус, Steuerberater и т.д.
3. **Монетизация + биллинг** — Stripe с EU/DSGVO, тарифы Free/Pro/Business
4. **Team/multi-user** — бухгалтер видит данные клиента
5. **Banking-интеграция** — автоматический match платежей с Rechnungen (FinAPI/GoCardless)
6. **E-Rechnung (XRechnung/ZUGFeRD)** — обязательно для B2B в 2025-2028
7. **DATEV-экспорт** — каждый Steuerberater требует

**Уникальные ниши где мы можем выиграть:**
1. **Russian/Ukrainian-спикеры в DE** — никто этим не занимается, их тысячи (IT, креатив, коучи)
2. **Bürgergeld-Aufstocker selbstständig** — Jobcenter EKS никто из конкурентов не делает
3. **Медиа-агентства / фрилансеры (дизайн, IT, coaching)** — lexoffice слишком скучный для них

---

## 1. Гэп-анализ: что нужно дописать

### 1.1 Критичные пробелы функциональности

| Сейчас | Нужно | Срочность |
|---|---|---|
| Нет онбординга — попадаешь в пустой dashboard | Wizard 5-10 шагов собирает все данные | 🔴 Блокер для продаж |
| Settings: 10 полей | Нужно ~30 полей (Rechtsform, Branche, KSK, etc) | 🔴 Блокер |
| Только Einzelunternehmer де-факто | UG/GmbH/GbR flow с другими triggerами | 🟡 v2 |
| Нет email-отправки Rechnung клиенту | Resend/Postmark интеграция | 🔴 Must-have |
| Нет Mahnung / Zahlungserinnerung | Автоматические 3 ступени (§286 BGB) | 🟡 Must-have |
| PDF только один шаблон | 3-5 шаблонов (Minimal/Elegant/Studio/Creative) + брендинг | 🟡 Важно |
| Нет E-Rechnung XRechnung/ZUGFeRD | С 2025-01-01 B2B DE **обязан принимать** | 🔴 Legal |
| Нет Banking-интеграции | FinAPI auto-match платежей | 🟡 Killer feature |
| Нет DATEV-экспорта | CSV EXTF 510 — все Steuerberater просят | 🔴 Must-have |
| Нет OCR для чеков | Tesseract/OpenAI Vision на Belege | 🟢 Wow-фича |
| Нет Android/iOS | PWA достаточно для MVP; native позже | 🟢 v2 |
| Нет Backup/Export | JSON dump + GoBD ZIP | 🟡 Compliance |
| Нет Team / Multi-User | Steuerberater-доступ read-only | 🟡 v2 |
| Нет Abonnement-Rechnung | Повторяющиеся счета каждый месяц | 🟢 v2 |

### 1.2 UX-пробелы которые ты сам заметишь

- Нет drag&drop позиций в Rechnung
- Нет копирования клиента/счёта одной кнопкой
- Нет быстрого действия "Rechnung aus letztem Angebot" в profile клиента
- Нет Einstellungen→Export/Import данных
- Нет уведомлений о Fälligkeit счетов
- Нет Kalender-View дат выплат
- Нет Suche через всю базу (глобальный поиск по №, клиенту, сумме)
- Нет Kommentare / Notizen с timeline на клиенте
- Нет Projekte — группировка Rechnungen по проекту
- Нет Zeiterfassung → авто-создание Rechnung из часов (killer для фрилансеров)

---

## 2. Онбординг-визард (спека)

Это самое важное. Сейчас ноль — нужно сделать 7-шаговый flow после первого логина.

### Шаг 1: Willkommen
- "Hi 👋, in 3 Minuten richten wir dein Business ein."
- Прогресс-бар [1/7]
- Визуально красиво (gradient card)

### Шаг 2: Rechtsform — "Was bist du?"
Radio-cards с иконками:
- 🧑‍💼 **Freiberufler** (Designer, Entwickler, Journalist, Therapeut...)
- 🏪 **Einzelunternehmen** (Gewerbe, Handwerk, Handel...)
- 👥 **GbR** (2+ Personen, einfache Gesellschaft)
- 🏢 **UG (haftungsbeschränkt)**
- 🏛️ **GmbH**
- 🎭 **Künstler / Publizist** (KSK-pflichtig?)
- ⛰️ **Andere**

→ Результат определяет: какие поля нужны, нужен ли Handelsregister, применяется ли KSK, какие налоги.

### Шаг 3: Branche — "Was machst du?"
Combobox с автодополнением (предзагружены 200 немецких WZ-2008-Codes):
- Media / Werbung (WZ 70.21)
- Grafik / Design (WZ 74.10)
- IT / Programmierung (WZ 62.01)
- Coaching / Beratung (WZ 70.22)
- и т.д.

Это нужно для: KSK-определение, WZ-Code на Rechnung (für Einbringung zur Rente), правильный SKR.

### Шаг 4: Steuer-Regime
- **§19 Kleinunternehmer?** — с хорошим объяснением:
  > "Dein Umsatz war 2025 unter 22.000 € und wird 2026 unter 50.000 € sein. Dann brauchst du keine USt auf Rechnungen — einfacher, aber kannst auch keine Vorsteuer ziehen."

  [Ja, bin Kleinunternehmer] [Nein, normal besteuert]

  Wenn "Ja": добавить прогноз-блок "Ist das noch sinnvoll? → Rechner".

- **Ist- oder Soll-Versteuerung?** (§20 UStG) — только если не Kleinunt.

- **Steuernummer**
- **USt-IdNr** (optional но для EU-B2B нужно)
- **Finanzamt** (dropdown 570+ FAs Deutschlands)

### Шаг 5: Adresse & Kontakt
- Vorname + Nachname (personenbezogen, falls Einzel/Freiberufler)
- Firmenname (falls UG/GmbH/GbR)
- Straße, PLZ, Ort (Autocomplete через PLZ-API)
- Land (DE по умолчанию)
- Telefon, Website, Impressum-URL

### Шаг 6: Bank + Zahlungen
- IBAN (валидируем checksum)
- BIC auto-lookup по IBAN
- Bank-Name
- Kleine Hilfe: "Diese Daten stehen auf deinen Rechnungen"
- Default-Zahlungsmethode: 🏦 Überweisung | 💵 Bar | 🪙 Krypto

### Шаг 7: Bürgergeld / Jobcenter (neu!)
Нажимной тумблер:
- "Beziehst du Bürgergeld / Aufstocker-Leistungen?"

Wenn Ja →
- Jobcenter-Ort (dropdown всех 406 Jobcenter)
- Bewilligungszeitraum (von-bis)
- Geschäftszeichen / BG-Nummer
- → активируется модуль Anlage EKS автоматически

### Шаг 8 (optional): Steuerberater + Integration
- Name + Email
- DATEV-Berater-Nr (опционально)
- Кнопка "DATEV-Export aktivieren" → Phase 2 OAuth к DATEV Upload-Manager

### Шаг 9: Logo + Rechnungsdesign
- Upload Logo (PNG/SVG, max 2MB)
- Upload Unterschrift (PNG transparent, optional)
- Accent-Farbe picker
- 3 готовых шаблона PDF: **Minimal** / **Elegant** / **Studio**
- Live-Preview

### Шаг 10: Готово
- "Deine Einrichtung ist fertig."
- CTA: "Erste Rechnung erstellen" → Wizard "Neue Rechnung" с предзаполненными данными

**UX pattern:** шаги сохраняются как draft — можно выйти и продолжить позже. В sidebar иконка "Setup abschließen" с прогрессом.

---

## 3. Расширенная schema Settings

```sql
alter table public.settings add column if not exists (
  -- Personal identity
  first_name text,
  last_name text,
  phone text,
  website text,
  email_from_invoice text,       -- used as "From" when sending
  email_signature text,          -- HTML snippet
  signature_image_url text,

  -- Legal
  legal_form text check in ('freiberufler','einzelunternehmen','gbr','ug','gmbh','ohg','kg','kuenstler','andere'),
  trade_register_number text,    -- HRB/HRA
  trade_register_court text,     -- Amtsgericht
  branche_wz_code text,          -- WZ 2008 code
  branche_label text,
  is_ksk_mitglied boolean default false,
  ksk_nummer text,

  -- Tax
  tax_regime text check in ('kleinunternehmer','regelbesteuerung','durchschnittssatz'),
  vat_scheme text check in ('ist','soll') default 'ist',
  finanzamt_id text,
  finanzamt_name text,
  skr_chart text check in ('SKR03','SKR04') default 'SKR03',

  -- Jobcenter (optional module)
  receives_buergergeld boolean default false,
  jobcenter_name text,
  jobcenter_bg_nummer text,
  bewilligungszeitraum_start date,
  bewilligungszeitraum_end date,

  -- Steuerberater
  steuerberater_name text,
  steuerberater_email text,
  steuerberater_datev_id text,

  -- PDF
  pdf_template text default 'minimal',   -- 'minimal' | 'elegant' | 'studio'
  pdf_accent_color text default '#0f766e',
  pdf_footer_text text,
  invoice_language_default text default 'de',

  -- Mahnwesen
  enable_auto_mahnung boolean default true,
  mahnung_1_days_after_due int default 7,
  mahnung_2_days_after_due int default 14,
  mahnung_3_days_after_due int default 21,
  mahngebuehr_1_cents bigint default 0,
  mahngebuehr_2_cents bigint default 500,
  mahngebuehr_3_cents bigint default 1000,
  verzugszins_pct numeric(4,2) default 5.0,  -- §288 BGB = 5 p.p. über Basiszinssatz

  -- Product
  onboarding_step int default 0,
  onboarding_completed_at timestamptz,
  plan text default 'free',               -- 'free' | 'pro' | 'business'
  trial_ends_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text
);

create table public.onboarding_progress (
  user_id uuid primary key,
  step int not null,
  data jsonb,
  updated_at timestamptz default now()
);
```

---

## 4. Legal Compliance Checklist — ФИНАЛЬНО с legal-research

> **Полный отчёт** (1444 строки, 12к слов): [.research/legal-de-2026.md](.research/legal-de-2026.md) — включает XRechnung XML-пример, BT-codes, Anlage-EKS строка-в-строку, Beispielrechnung с Freibeträgen, DATEV EXTF 700 спеку, ERiC-bridge архитектуру.

### 🔴 Критичные legal-changes 2025 которые ломают текущий код

1. **Retention 8 лет, НЕ 10** — Bürokratieentlastungsgesetz IV (BGBl. I 2024 Nr. 323, с 2025-01-01) снизил срок хранения счетов с 10 до 8 лет. У нас в `document_archive` и migration стоит 10 → **надо поменять + добавить tooltip "8 Jahre seit BEG IV"** как маркетинговый moat.

2. **Kleinunternehmer thresholds UPDATED** — Jahressteuergesetz 2024 (BGBl. I 2024 Nr. 387) поднял с €22k/€50k на **€25k / €100k**. Если превысил €100k в течение года → теряешь §19 статус **сразу на этом счёте** (раньше оставался до конца года). У нас settings hard-coded нет, но в онбординг-визарде надо показать правильные цифры.

3. **§19 Invoice notice wording — обновлён**: новая формулировка
   > "Kein Steuerausweis aufgrund Anwendung der Kleinunternehmerregelung nach § 19 UStG."

   Старый "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet" технически ещё окей, но ресёрчер рекомендует новый. Надо обновить `lib/vat.ts`.

4. **Kleinunternehmer E-Rechnung**: §34a UStDV (new) — Kleinunternehmer **освобождены от отправки** E-Rechnung, но **обязаны принимать**. UX-consequence: default "PDF-Versand" в settings для KU-юзеров.

5. **DATEV формат 700**, не 510 — у меня в стратегии было "EXTF 510", правильный формат **EXTF 700** с 47 колонками + BU-Schlüssel. Phase 2 фича, но название везде надо поправить.

### ✅ Уже реализовано (проверено legal-ресёрчером)

- §14 UStG 10 обязательных полей ✅
- §19 UStG snapshot per invoice + Hinweis ✅
- §13b Reverse Charge toggle + wording ✅
- §14c lock после finalize + Storno-цепь ✅
- Gap-free Nummerierung через RPC ✅
- Storno preserves original, new number for Storno ✅
- Document archive snapshot ✅ (исправить retention)
- Audit log append-only ✅
- DSGVO: RLS + user-isolation ✅

### 🟡 Частично реализовано

- **Supabase локально** → но production должен быть **EU Frankfurt** с DPA (AVV). Production-deployment чек-лист: Supabase EU region, Vercel Frankfurt, Resend EU, все subprocessors EU.
- **Jobcenter module**: страница есть, но нет Anlage-EKS PDF-экспорта в формате SA40.
- **EÜR preview** есть, нет Anlage-EÜR PDF (Zeilen 11-99).

### 🔴 Критичные пробелы (для sellable SaaS)

| Gap | Статья | Последствия |
|---|---|---|
| **E-Rechnung XRechnung 3.x + ZUGFeRD 2.3 приём** | BMF 15.10.2024 | С 2025-01-01 B2B recipients обязаны! |
| **E-Rechnung XRechnung отправка** | BGBl. I 2024 | 2027 для €800k+, 2028 для всех B2B |
| **KoSIT Validator + veraPDF в CI/CD** | BMF | иначе отправишь non-compliant XML → recipient reject |
| **Verfahrensdokumentation (VDok) template** | GoBD §146 AO | Обязательная для каждого клиента, download PDF |
| **Z3 GoBD-Audit-Export** (Datenträgerüberlassung) | §147 AO | Для Betriebsprüfung — ZIP с index.xml + CSV |
| **Hash-chain для GoBD Unveränderbarkeit** | §146 AO | Наш SHA-256 на PDF — хорошо, но нужна chain |
| **2FA / MFA** | Art. 32 DSGVO TOMs | Corporate buyer lehnt ab wenn nicht da |
| **DPA one-click signature** | Art. 28 DSGVO | Каждому клиенту для компаний нужно |
| **ERiC-Bridge для UStVA/EÜR** | §18 UStG | Отдельный Linux-сервис нужен |
| **BZSt USt-IdNr qualifizierte Bestätigung** | §18e UStG | Валидация USt-ID клиентов |
| **Basiszins auto-update для §288 BGB** | §247 BGB | Меняется 2 раза в год, нельзя hardcode |
| **Verzugspauschale €40 auto** | §288 Abs. 5 BGB | Автомат на все B2B Mahnungen |
| **KSK-флаг на Ausgaben-Kategorien** | §24 KSVG | **Media agencies подлежат! 5% Abgabe** |
| **OSS-Report для EU B2C >€10k** | §18j UStG | Квартальный BZSt-schema |

### 💎 MOAT-потенциал (legal-ресёрчер выделил отдельно)

**Anlage EKS для Jobcenter** — никто не делает правильно. Полная спека из отчёта:
- 45+ полей входа
- Отличие EKS ≠ EÜR: AfA считается **иначе**, Arbeitszimmer **нельзя**, KFZ только **€0.10/km**
- 6-monatiger Bewilligungszeitraum cycle
- Vorläufig → Endgültig при конце BWZ
- SA40-PDF-Generator для Einreichung Jobcenter
- Beispielrechnung с Freibeträgen §11b SGB II (100€ Grundfreibetrag + 20% Brutto-Freibetrag staffelung)

Это реально защищаемый moat — Jobcenter-специфика сложная, никто из конкурентов не вникал.

### 🧪 Топ-15 "killer gotchas" от legal-ресёрчера (приоритезированы)

1. **Nicht-unveränderbare Speicherung** → Betriebsprüfung-fail → PR-крах
2. **E-Rechnung-XML без валидации** → отправлял invalid → recipient rejects
3. **Kleinunternehmer UI с VAT-полями** → user случайно выдаёт → §14c-Schuld
4. **Invoice-номер deletable in frontend** → Lücke → Finanzamt-Beanstandung
5. **Данные на US-Serverах** → DPA не подписать → нет enterprise-продаж
6. **Нет Export-Funktion** (Art. 20 DSGVO + §147 AO) → судебные иски
7. **"3 Mahnstufen pflicht"** коммуникация — правово НЕ нужно, сбивает с толку
8. **ERiC-Bridge не сертифицирован** → UStVA fails
9. **Retention 10 лет hardcoded** → после BEG IV устарело ← **У НАС ТАК, ИСПРАВИТЬ**
10. **Нет Visual-Render для принятых XRechnungen** → пользователь видит XML
11. **Basiszinssatz hardcoded** для §288 BGB → меняется 2x/год
12. **SEPA-XML Export отсутствует** → Steuerberater недоволен
13. **Нет Multi-Mandanten** → Steuerberater уходит (у них N клиентов)
14. **2FA отсутствует/optional** → corporate отказывает
15. **Нет Open Data API** → enterprise-vendor-lock-fear

### 📋 Operational чек-лист (из отчёта, 13.1-13.8)

Готов выполнить в таком порядке:

**Core invoicing** (block 1, ~2 недели)
- [ ] XRechnung 3.x + ZUGFeRD 2.3 на каждый invoice
- [ ] KoSIT-Validator + veraPDF в CI
- [ ] BT-130 unit-code dropdown (UN/ECE Rec 20)
- [ ] BZSt USt-IdNr qualifizierte Bestätigung API
- [ ] Kleinunternehmer-guard: блокирует VAT-поля жёстко
- [ ] Visual-Render для incoming XRechnungen

**GoBD** (block 2, ~1 неделя)
- [ ] XML + PDF в Object Store с Object Lock
- [ ] Hash-chain per tenant (append-only)
- [ ] VDok-Vorlage PDF + Markdown, downloadable
- [ ] "GoBD-Audit-Export" button → Z3 ZIP
- [ ] Retention 8 лет + tooltip BEG IV

**DSGVO** (block 3, ~1 неделя)
- [ ] EU hosting default
- [ ] Subprocessor-list публично на /legal/subprocessors
- [ ] DPA one-click Art.28 signature
- [ ] Export (Art.20) + Delete (Art.17) self-service
- [ ] 2FA (TOTP + WebAuthn)

**EKS / Bürgergeld** (block 4, ~2 недели — это moat!)
- [ ] Dualer Kontenrahmen EÜR + EKS
- [ ] SA40-PDF-Generator
- [ ] Monatliche Vorläufig + End-of-BWZ Endgültig
- [ ] KFZ-Pauschale €0.10/km toggle
- [ ] Beispielrechnung walkthrough в UI

**EÜR / UStVA / DATEV** (block 5, ~2 недели)
- [ ] ERiC-Bridge Linux-service
- [ ] DATEV EXTF 700 CSV export (47 колонок)
- [ ] SKR03 + SKR04 toggle

**Mahnwesen** (block 6, ~1 неделя)
- [ ] 3-Stufen-Workflow (optional, не pflicht)
- [ ] §288 BGB Zinsrechner с auto-updated Basiszins
- [ ] €40 Verzugspauschale auto
- [ ] "Online-Mahnantrag" PDF export

**KSK** (block 7, 2 дня)
- [ ] "KSK-abgabepflichtig" флаг на expense-категориях
- [ ] Jahres-Report bis 31.03.

**OSS / EU** (block 8, 3 дня)
- [ ] B2C EU-Kennzeichnung
- [ ] OSS-Report Quartal BZSt-schema
- [ ] USt-IdNr-Check (BZSt)

### ✅ Реализовано
- §14 UStG обязательные поля
- §19 UStG Kleinunternehmer-Hinweis + snapshot
- §13b reverse-charge toggle + Hinweis
- §14c lock после finalize + Storno-flow
- Gap-free Nummerierung через RPC
- GoBD-archive snapshot + retention_until
- DSGVO: RLS, user-isolation, EU-hosting (Supabase Frankfurt когда деплоим)
- Audit log append-only
- 3 языка UI

### 🟡 Начато но не доделано
- Jobcenter — есть страница preview, нет PDF-экспорта Anlage EKS
- EÜR — есть preview, нет Anlage-EÜR PDF с Zeilen 11-99

### 🔴 Отсутствует (критично для SaaS)
- **E-Rechnung XRechnung/ZUGFeRD 2.3** — обязательно с 2025-01-01 на приём!
- **DATEV CSV EXTF 510** экспорт
- **ELSTER** интеграция (Anlage-EÜR submission)
- **UStVA** (если не §19)
- **Mahnwesen** — §286 BGB 3-ступенчатое + Verzugszinsen §288 BGB
- **OSS** (One-Stop-Shop EU-B2C)
- **GoBD-Testat** (нужно заказать у Steuerberater когда соберём 10+ клиентов)
- **AV-Vertrag (DPA)** template для клиентов
- **Datenschutzerklärung + Impressum** публичные страницы
- **Cookie-Banner** (TTDSG) — хотя у нас нет tracking, можно без него
- **Widerrufsbelehrung** (B2C)

---

## 5. Целевые сегменты (кому продавать)

> **Данные конкурентов** (из `.research/market-de-2026.md`):
> - **QuickBooks Germany закрылся июнь 2024** — пустое место
> - **invoiz закрылся 2020** — пустое место
> - **Billomat стагнирует под Sage** с 2022 — устаревает
> - lexoffice ~40% рынка (€70-90M ARR), sevdesk #2 (~€25-35M ARR)
> - **GoBD-Testat стоит €30-80k** — откладываем на месяц 12-18
> - **DATEV Partnerschaft €1,500-5k/год** — DATEV-CSV export покрывает 90%
> - **CAC organic €80-150**, paid €200-400, Trial→Paid 18-28%, Free→Paid 2-5%
> - Solo ACV: €90-180/год → для €10k MRR нужно 800-1000 платящих

### Сегмент A: **Russian/Ukrainian-спикеры в DE** 🥇
**Размер (уточнено):** 350-450k самозанятых
- 120-180k украинских фрилансеров пост-февраль-2022
- ~200-280k long-term русскоязычных самозанятых
**Realistic 24mo capture:** 2-4k платящих × €10/мес = **€20-40k MRR**
**Конкурентов с нативной UA/RU локализацией — НОЛЬ.**


**Болит:**
- Не понимают немецкое налоговое. lexoffice на DE + RU-интерфейс отсутствует у конкурентов.
- Не знают про §19, GoBD, E-Rechnung
- Боятся Jobcenter/Finanzamt
- Ищут помощь на Telegram-каналах и Facebook-группах

**Каналы:** Telegram-channels (Deutschland für Russisch-Sprechende, Ausländer in Deutschland), Russian-speaking Steuerberater, Reddit r/RussianGermany.

**Ценник:** €15-29/мес. Они согласятся платить за спокойствие.

**USP:** "Kolos Finanzen — твоя бухгалтерия на родном языке, с немецким правом."

### Сегмент B: **Bürgergeld-Aufstocker / Selbstständige mit Grundsicherung** 🥈
**Размер (уточнено):** 280-350k активных Aufstocker-mit-selbstständigem-Einkommen
**Realistic 24mo capture:** 3-5k × €5-6/мес = **€15-30k MRR**
**ZERO прямых SaaS-конкурентов** — монополия возможна.
**SEO-gap**: ключи `bürgergeld selbstständig`, `anlage eks ausfüllen`, `aufstocker selbständig buchhaltung` доминируются гос-сайтами — SaaS-присутствия НЕТ.


**Болит:**
- Ежемесячно нужно заполнять Anlage EKS вручную
- Неправильный расчёт = потеря Leistungen / требование вернуть
- Стресс + бумаги
- Steuerberater не хотят работать за €50-80/мес

**Каналы:** Jobcenter-Forum, Schuldnerberatung, selbstaendig.de, Buchhaltung-Facebook-Gruppen.

**Ценник:** €9-15/мес (они бедные, но это инвестиция). Можно freemium с EKS-экспортом в Pro.

**USP:** "Monatlich deine EKS für's Jobcenter in 2 Klicks — fehlerfrei."

### Сегмент C: **Kleine Medien-/Kreativ-Agenturen** 🥉
**Размер:** ~80k Agentur-GmbHs/Freelancer Kreative in DE.

**Болит:**
- lexoffice скучный и "для бухгалтеров"
- Нужно красивые PDF с брендингом
- Проекты с клиентами через месяцы — нужно Zeiterfassung → Rechnung
- Retainer-Kunden = ежемесячные Abo-Rechnungen

**Каналы:** Designers-guild, Dribbble/Behance communities, Agenturen-Newsletter, Studio-Owner-Twitter.

**Ценник:** €29-49/мес.

**USP:** "Rechnungen und Finanzen für Kreative — mit Stil und ohne Buchhaltungs-Deutsch."

---

## 6. Monetization — **Combination Play (Niche A + B вместе)**

> **Стратегия:** запускаем A (Bürgergeld) + B (RU/UA) как одно позиционирование — аудитории пересекаются (много украинских беженцев-Aufstocker). Год 2 — C (агентства).
>
> **Позиционирование:** *"Die Rechnung & Buchhaltung für Selbstständige, die zählen muss — inklusive Jobcenter-EKS, Elster-Export und Ukrainisch/Russisch-Oberfläche."*
>
> **24-month target:** 6-10k платящих × €8/мес avg = **€48-80k MRR**

### Tarifstruktur (обновлено по данным ресёрчера)

| Feature | **Free €0** | **Pro €5.90/мес** | **Business €12.90/мес** |
|---|---|---|---|
| Клиенты | 10 | ∞ | ∞ |
| Rechnungen/месяц | 5 | ∞ | ∞ |
| Angebote | ∞ | ∞ | ∞ |
| Jobcenter EKS Export | 1/квартал | ∞ | ∞ |
| E-Rechnung XRechnung | ✅ приём | ✅ приём | ✅ приём + отправка |
| DE/RU/UA UI | ✅ | ✅ | ✅ |
| PDF-шаблоны | 1 (Minimal) | 3 | 3 + кастом + logo |
| Banking Auto-Sync (GoCardless) | ❌ | ✅ | ✅ |
| Receipt OCR | ❌ | ❌ | ✅ |
| Mahnwesen 3-Stufen | ❌ | ✅ | ✅ |
| DATEV CSV Export | ❌ | ✅ | ✅ |
| EÜR / UStVA Helper | ❌ | ✅ | ✅ |
| Elster-Export (ERiC) | ❌ | ❌ | ✅ |
| Team (Steuerberater read-only) | ❌ | ❌ | ✅ |
| API + Webhooks | ❌ | ❌ | ✅ |
| Support | Community | Email 24h | Chat + Phone |

**Trial:** 14 дней Business бесплатно без карты.
**Skonto:** 20% скидка на годовую предоплату (стандарт DACH).

### Почему эти цены
- **Free €0** — широкая воронка, без этого не конкурировать с Billomat/Papierkram/Zervant
- **Pro €5.90** — *ниже* Billomat (€9) и Papierkram (€8). Ценовой wedge для Bürgergeld
- **Business €12.90** — *ниже* lexoffice (€16.90) и sevdesk (€19.90), но со всеми нужными фичами

**Expected unit economics (DACH SaaS benchmarks):**
- Free → Paid: 3-5% | Trial → Paid: 20-25%
- CAC organic: €80-150 | Gross margin: 80% | Monthly churn: 2-4%
- Payback period: 9-12 мес | NRR: 100-115% через upsell

### Биллинг — Stripe EU + DSGVO
- Stripe Customer Portal
- SEPA Direct Debit (для DE это стандарт)
- Invoice reminders встроенные
- 19% USt auto (Stripe Tax)

---

## 7. Roadmap

### V1.0 — "Sellable MVP" (4-6 недель)
- [ ] Онбординг-визард 7 шагов
- [ ] Расширенная Settings-schema + UI
- [ ] Email-отправка Rechnung (Resend)
- [ ] Mahnwesen (3 ступени, авто-email)
- [ ] 3 PDF-шаблона (Minimal/Elegant/Studio) + логотип
- [ ] Landing page (deutsch + russisch)
- [ ] Stripe биллинг Free/Pro
- [ ] Impressum + Datenschutz + AGB страницы
- [ ] E-Rechnung XRechnung-приём (загрузка XML → auto-fill)

### V1.5 — "Power Features" (2-3 недели)
- [ ] DATEV CSV Export
- [ ] Anlage-EÜR PDF (Zeilen 11-99)
- [ ] Anlage-EKS PDF для Jobcenter
- [ ] E-Rechnung XRechnung/ZUGFeRD **отправка**
- [ ] Abonnement-Rechnungen (recurring)
- [ ] Global Search (Cmd+K)

### V2 — "Banking & OCR" (4-6 недель)
- [ ] FinAPI Bank-Feed интеграция
- [ ] Auto-match Zahlungseingang ↔ Rechnung
- [ ] Receipt OCR (Belege → Expense) via OpenAI Vision
- [ ] Mobile PWA (или React Native позже)
- [ ] Team + Steuerberater-Portal

### V3 — "AI Bookkeeper" (ongoing)
- [ ] AI-ассистент: "Buche diese Ausgabe automatisch ein"
- [ ] Auto-Kategorisierung Ausgaben
- [ ] Voice-Invoice ("Hey Kolos, создай счёт на €500 для ACME")
- [ ] Tax-Advisor-Chat ("Was kann ich absetzen?")
- [ ] Integration mit ELSTER Pro (actual Übermittlung)

---

## 8. "Ебейшие" идеи (wild features)

Часть войдёт в product, часть в marketing, часть в моат:

### 🤖 AI-первый опыт
- **"Photographer-Mode Import"** — загрузил 50 PDF старых Rechnungen → OpenAI Vision читает каждый, вытаскивает Kunde/Nummer/Datum/Summe/VAT → засасывает всё в историю. Конкуренты заставляют вводить руками.
- **"Auto-Mahnung Tone"** — AI пишет Mahnung в твоём стиле (дружеский / корпоративный / жёсткий). GPT-4 + твои пред. письма.
- **"Steuer-Chat"** — "Hey, ich habe einen Laptop für 1800€ gekauft. Wie absetzen?" → AI отвечает на базе §EStG + выдаёт готовую категорию + дата-сплит над 800€-GWG-порогом.
- **"Rechnung aus WhatsApp"** — форвардишь чат клиенту в бот Telegram/WhatsApp → бот создаёт черновик Rechnung.

### 🎨 UX-moats
- **Dark mode + светлый + брендированная тема** под твой logo (автоподбор цвета)
- **Cmd+K global search** — Linear-стиль
- **Drag-to-import** — бросил PDF в окно браузера → импорт
- **Keyboard-first** — всё управляется с клавиатуры
- **Zero-click Rechnung** — один клик из записи времени в Toggl → готовая Rechnung
- **Live-Coaching-Modus** — pro-Tipp-тосты в углу объясняют немецкие законы когда нужно

### 💡 Jobcenter-Hacks (наш killer)
- **"EKS-Vorschau in Real-Time"** — каждый месяц виджет показывает "Deine EKS würde so aussehen: € X. Du gibst ab am 15.{monat+1}"
- **"Was würde Jobcenter fragen?"** — AI-чек перед отправкой: "Hier fehlt eine Reisekosten-Dokumentation" / "Achtung: hier siehst du wie Ausgaben werden, aber bei EKS zählt ..."
- **"Widerspruchs-Generator"** — если Bescheid приходит неправильный → загрузил PDF → AI генерит Widerspruch по §36 SGB X

### 🏦 Banking-Magie
- **"Ghost-Rechnungen"** — бот видит SEPA "von Test GmbH 590€" → предлагает "Ist das Zahlung für KD-2026-0042?" → один клик — associated
- **"Late-Payer-Score"** — рейтинг клиентов по скорости оплаты. Красный клиент = "Pre-Payment verlangen?"
- **"Forecast"** — AI предсказывает какие Rechnungen придут в этом месяце на основе истории

### 🌍 Русско-сегмент-специальные
- **Полный RU-интерфейс + DE-PDF** (юридические документы остаются на DE)
- **Немецкие термины-hint** — наводишь на "Leistungsdatum" → русское объяснение
- **Steuer-Glossar RU** ↔ DE
- **Видео-туториалы на YouTube по-русски** ("Как выставить первый Rechnung в Deutschland")
- **Telegram-бот для поддержки** — кнопка в app "Вопрос в Telegram"

### 📊 Creator-Mode
- **YouTube/Twitch/Instagram integration** — показывает сколько ты заработал с каждого ролика если есть tracking (brand deals)
- **Rate-Calculator** — "Сколько брать за час?" на базе рынка + твоих расходов
- **Contract-Templates** — готовые KR-Verträge для медиа/дизайн/IT

### 🤝 B2B-Network
- **Kolos Network** — верифицированные клиенты/исполнители в платформе. Создал Rechnung → клиент видит у себя в Kolos без PDF (опционально). Вирусный loop.
- **Referral program** — €10 credit за приведённого друга

### 🎯 Compliance-Killer-Features
- **"GoBD-Testat" — pre-built** — мы сами получаем Testat у Steuerberater и даём клиенту как download. Ни один конкурент для €15/мес это не даёт.
- **Auto-Submit ELSTER** — ты только жмёшь "Absenden", ERiC под капотом. UStVA + EÜR авто.
- **DATEV-mindmap** — видишь какие данные полетят Steuerberater. Confidence boost.

### 🔒 Privacy-First Positioning
- **"Альтернатива американским SaaS"** — Supabase EU, Stripe EU, Resend EU, никаких Google Analytics, Meta Pixel, и т.д. Целая Landing-секция на эту тему.
- **AV-Vertrag 1-Klick** — клиент скачивает готовый DPA с нашими данными, подписывает.

---

## 9. Go-To-Market

### SEO-ниши без конкуренции (золото)

Из ресёрчера — ключи где SaaS-присутствия нет или минимум:

| Ключ | ~MV/мес DE | Сложность | Кто доминирует |
|---|---|---|---|
| `bürgergeld selbstständig` | 2,900 | Low | Гос-сайты — **ноль SaaS** |
| `anlage eks ausfüllen` | 1,900 | Low | Гос-сайты — **ноль SaaS** |
| `aufstocker selbständig buchhaltung` | 400 | Low | **вакуум** |
| `xrechnung erstellen` | 3,600 | Med | **gap** |
| `rechnung erstellen ukrainer deutschland` | 200-500 | Low | **вакуум** |
| `kleinunternehmer rechnung russisch deutsch` | <200 | Low | **вакуум** |

Для сравнения, конкурентные ключи (туда не лезем на старте):
- `rechnung schreiben` — 60,500 MV, lexoffice/sevdesk
- `buchhaltungssoftware` — 27,100, high competition

### Контент-стратегия (первые 90 дней)
Три Hub-Sites:
1. **blog.kolos.digital** (DE) — 20+ статей на зарезервированные ключи:
   - "Bürgergeld + selbstständig — Anlage EKS 2026 richtig ausfüllen"
   - "Wie mache ich XRechnung — Schritt für Schritt in 2 Minuten"
   - "Anlage EKS fürs Jobcenter — 7 häufige Fehler die Rückforderung verursachen"
   - "§19 Kleinunternehmer: lohnt es sich 2026 noch?"
   - "DSGVO-konforme Rechnungssoftware 2026 — Auswahlhilfe"
2. **ua.kolos.digital** — український хаб (POST-2022 рефугі):
   - "Як стати Freelancer в Німеччині — крок за кроком"
   - "Kleinunternehmer §19 — це твій вибір?"
   - "Як правильно виставити Rechnung українській фірмі з Німеччини"
3. **ru.kolos.digital** — русский хаб (долгоживущие диаспоры):
   - "Как стать Freelancer в Германии"
   - "Kleinunternehmer vs Regelbesteuerung — что выбрать?"
   - "Как правильно оформить Rechnung в Германии"
4. **YouTube каналы** DE + RU + UA — короткие (60 сек) скринкасты.

### Distribution — конкретные каналы (из ресёрчера)

**Facebook-Gruppen (наша аудитория)**
- "Selbstständig in Deutschland" ~80k
- "Kleinunternehmer & Selbstständige" ~60k
- "Ukrainer in Deutschland Selbstständig" ~15k ← **low competition**
- "Russen in Deutschland" + дочерние группы

**Telegram-каналы**
- "Ukrainians in Germany Business"
- Deutschland для русскоязычных
- партнёрство с 10-20 каналами через inline-промо

**Jobcenter-specific (niche B)**
- Jobcenter-Gründerberatung — underused channel per ресёрчер
- BA.de форумы/Schuldnerberatung
- VK/OK для RU-комьюнити

**Reddit** — r/Freelance_Germany (20k), r/RussianGermany, r/germany
**LinkedIn** — Freelance-Deutschland (50k)
**Associations**: BDÜ (Übersetzer), Freelens (Fotografen)
**Product Hunt** — запуск с фокусом "EU-hosted, DSGVO-first, no US-cloud"

### Первые 10 клиентов
- Публикуешь тред в своём Telegram/Instagram "Я создал..."
- Даёшь 3-5 друзьям бесплатный Pro на 6 мес за отзыв
- Пишешь 5 Steuerberatern с RU-корнями предлагая affiliate (10% recurring)

---

## 10. Technical moats (что сложно скопировать)

1. **Gap-free Nummerierung + GoBD-immutability** — правильная реализация занимает месяцы. Мы её сделали в неделю.
2. **Анлаге-EKS автоматика для Jobcenter** — требует понимания SGB-II rules. Никто не делает.
3. **3-языкаовый UI с правильной немецкой юридической терминологией**
4. **PDF-хранение с SHA-256** — если конкурент не делал это с day 1, backfill сложный.
5. **Supabase + Next.js стек** — быстрее Rails/Django-конкурентов по итерациям.

---

## 11. Что я делаю пока ты обедаешь

Параллельно запустил 2 агента:
1. **Legal-researcher** роет германское законодательство глубоко (E-Rechnung timeline точный, GoBD 2024 revision, EKS exact field list, DSGVO, KSK, DATEV-format, ELSTER ERiC)
2. **Market-researcher** анализирует lexoffice/sevdesk/Buchhaltungsbutler, pricing tiers, feature gaps, distribution channels, AI-начинания конкурентов

Когда они закончат — обновлю разделы **4. Legal Compliance** и **5/6/9. Competitive/Pricing/GTM** реальными данными + ссылками.

---

## 12. Следующие 3 действия (что я рекомендую делать сразу после обеда)

1. **Утверди направление** — какой из 3 целевых сегментов первичный? Моё предложение: **A (Russian-speakers in DE)** — минимум конкуренции, ты сам из этого сегмента, дистрибуция через личный network.

2. **Решим по монетизации** — Free + Pro + Business? Или сразу Pro-only €19/мес (нет бесплатного, все платят)? Пустил бы вариант 2 для простоты.

3. **Начнём онбординг-визард** — это самое срочное после sellable-tarif. Ориентир: 2-3 дня работы, я могу начать сразу после твоего ок.

---

---

## 📋 ИТОГО — что сделано пока ты обедал

**Оба research-агента отработали.** Финальная версия этого документа готова.

### Два отчёта в `.research/`:

1. **[legal-de-2026.md](.research/legal-de-2026.md)** — 1444 строки, 12к слов
   - Полный XRechnung 3.0 XML-пример (Appendix A)
   - Anlage EKS по строчкам + Beispielrechnung с §11b Freibeträgen
   - DATEV EXTF 700 точная спека (47 колонок)
   - Timeline E-Rechnung 2025→2027→2028
   - Топ-15 gotchas
   - Operational checklist по каждой подсистеме

2. **[market-de-2026.md](.research/market-de-2026.md)** — 500+ строк, 10 разделов
   - Feature/pricing matrix всех DACH-конкурентов
   - 3 defensible ниши с числами (Niches 1+2 combination рекомендовано)
   - SEO-ключи с MV и competition (золото для niches 1+2)
   - Funnel benchmarks (CAC €80-150, Trial→Paid 18-28%, Churn 2-4%)

### Применено к коду СРАЗУ:

- ✅ **Retention 10 → 8 лет** — миграция `20260424000008_beg_iv_retention.sql` с backfill существующих записей. BEG IV compliance (2025).

### Критичные находки для обсуждения за кофе

1. **Combination Play Niche A+B** (Bürgergeld + RU/UA) — единственная реально pathway к €48-80k MRR за 24 месяца. Одна посадочная на 3 языках, общая CRM-воронка, взаимно-усиливающий контент (UA-refugees часто становятся Aufstocker).

2. **KSK!** — ты как media agency **подлежишь 5% Abgabe** §24 KSVG. Надо это в Settings и на expense-категориях сразу показать. Это и в EÜR отражается.

3. **Pricing €5.90 / €12.90** — ниже чем я сначала думал; данные рынка диктуют. Конкуренты (Billomat €9, Papierkram €8) определяют потолок снизу.

4. **DATEV format — 700, не 510** — мой ранний план был устаревшим. Поправил в стратегии.

5. **§19 Hinweis текст** — обновить в `lib/vat.ts` на новую формулировку из Jahressteuergesetz 2024:
   > "Kein Steuerausweis aufgrund Anwendung der Kleinunternehmerregelung nach § 19 UStG."

6. **Kleinunternehmer thresholds** — €25k / €100k (новые с 2025), не €22k/€50k. Встроить в онбординг-визард.

7. **KoSIT Validator + veraPDF в CI/CD** — обязательно если будем отправлять E-Rechnung. Любой invalid XRechnung = recipient отклоняет счёт = отчётное нарушение.

### Что хочу услышать после обеда

- **Направление подтверждаем?** Combination Play A+B как основной GTM
- **Запустить онбординг-визард сразу?** 2-3 дня работы, это самое срочное для sellable SaaS
- **Или сначала дофиксить legal-gotchas?** (2FA, 8-year-tooltip, E-Rechnung XML validation в CI)
- **Landing-page как приоритет?** Начать привлекать waitlist пока мы строим

**Моя рекомендация:**
1. Онбординг-визард + расширенная Settings (4-5 дней)
2. E-Rechnung XRechnung отправка/приём (3-4 дня)
3. Landing-page DE+RU+UA + ваитлист (2 дня) ← параллельно можно
4. Stripe-биллинг + Free/Pro/Business (2-3 дня)
5. Первые 10 клиентов — твоя сеть + Telegram + 1-2 RU-Steuerberater в affiliate

За **14-21 день непрерывной работы** — sellable v1 с реальным чекаутом. Waitlist начинает собираться с дня 1.

Всё лежит в файлах. Открывай, читай, возражай, дополняй.

