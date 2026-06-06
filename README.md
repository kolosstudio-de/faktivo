# Faktivo

> **Buchhaltung & Rechnungen für Aufstocker** — eine deutsche Finanz-SaaS für
> Selbstständige, die gleichzeitig Bürgergeld (Aufstockung) beziehen.
> Rechnungen, Mahnungen, Banking-Import, EÜR, Anlage EKS, Steuerberater-ZIP.
> DSGVO- & GoBD-konform, auf Deutsch, Englisch, Русский, Українською.

## 🚀 Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkolosstudio-de%2Ffaktivo&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,CRON_SECRET&envDescription=Required%20environment%20variables%20%E2%80%94%20Supabase%20%2B%20Anthropic%20Claude%20%2B%20Cron%20Secret&envLink=https%3A%2F%2Fgithub.com%2Fkolosstudio-de%2Ffaktivo%2Fblob%2Fmain%2F.env.local.example&project-name=faktivo&repository-name=faktivo)

**1-Klick-Deploy auf Vercel** (Frankfurt-Region pinned, GDPR-safe). Setup-Guide für
Cloud-Supabase + Vercel + Storage-Buckets: [`scripts/deploy/QUICKSTART-CLOUD.md`](./scripts/deploy/QUICKSTART-CLOUD.md).

## Was Faktivo macht

| Bereich        | Funktion                                                                              |
| -------------- | ------------------------------------------------------------------------------------- |
| **Rechnungen** | §14 UStG-konform, KU §19, Reverse-Charge §13b, Storno, GoBD-Archiv (8 Jahre)          |
| **Mahnwesen**  | 3 Stufen (§286/§288 BGB), Verzugszinsen (Basis + 5/9 p.p.), €40 Pauschale für B2B    |
| **Banking**    | PDF/CSV-Import + Claude-AI-Klassifizierung, TrueLayer-Live-Sync, Transfer-Detection   |
| **Bürgergeld** | Anlage EKS (Vorläufig/Endgültig/Vergleich), §11b SGB II-Freibeträge, Rückforderung    |
| **Steuern**    | EÜR §4 Abs. 3 EStG, DATEV EXTF 700-Export, XRechnung EN 16931, Steuerberater-ZIP      |
| **Belege**     | OCR + Auto-Kategorisierung, Mehrbedarfe-Tracking, Jobcenter-Dokument-Vision-Parsing   |

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + Turbopack + Tailwind CSS 4
- **i18n:** `next-intl` mit 4 Locales (de/en/ru/uk), 1212 Schlüssel pro Sprache
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **AI:** Anthropic Claude (Haiku 4.5 für Transaktions-Klassifizierung & PDF-Parsing,
  Sonnet 4.5 für komplexe Bank-Statements und Vision-OCR)
- **PDF:** `@react-pdf/renderer` mit DejaVu Serif (Cyrillic-Support)
- **Banking:** TrueLayer (Live-Sync) + manueller PDF/CSV-Upload (Coinbase, N26, Sparkasse, ...)
- **Email:** Resend (mit Dry-Run-Fallback für lokales Dev)
- **Payment:** Stripe Payment Links (für KU bewusst ohne SCA-Aufwand)

## Lokales Setup

### Variante A — ohne Docker (Cloud-Supabase) ✅ empfohlen

```bash
# 1. Dependencies
npm ci

# 2. Supabase Cloud-Projekt anlegen (https://supabase.com/dashboard/new)
#    Region: eu-central-1 (Frankfurt), Plan: Free
#    → 5-Minuten-Walkthrough: scripts/deploy/QUICKSTART-CLOUD.md
./scripts/deploy/setup-cloud-supabase.sh  # linkt + pushed alle Migrationen

# 3. ENV — Cloud-Werte aus Dashboard → Settings → API
cp .env.local.example .env.local
# Editiere mindestens:
#   NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
#   ANTHROPIC_API_KEY=sk-ant-…

# 4. Dev-Server
npm run dev
```

### Variante B — vollständig offline (lokales Supabase, braucht Docker)

```bash
brew install supabase/tap/supabase docker
supabase start                       # startet Postgres + Auth + Storage auf :54321
supabase db reset                    # wendet alle Migrationen an
# .env.local zeigt auf http://127.0.0.1:54321 (siehe .env.local.example)
npm run dev
```

Öffne http://localhost:3000 — Default-Locale ist Deutsch (`/de/...`).

## Tests

```bash
npm test                # alle Unit-Tests: money + jobcenter + pdf
npm run typecheck       # tsc --noEmit über alle .ts/.tsx
npm run lint            # ESLint
```

CI (GitHub Actions) läuft Lint + Typecheck + Tests auf jedem Push & PR.
Integration-Tests (eks-vergleich, smoke-test-routes) brauchen lokales
Supabase und werden manuell gefahren — siehe `scripts/`.

## Architekturentscheidungen

- **Auth:** Custom `/auth/confirm`-Route mit `token_hash`-Flow (statt Default
  Magic-Link-Route, weil Kong's `/verify` mit i18n-Locale-Prefix kollidiert)
- **Login-Rate-Limit:** Server-side via `/api/auth/signin` (5/5 min, Key = IP+Email),
  localStorage als zweite Verteidigungslinie + UX-Countdown
- **Money-Type:** `Cents = number` (Invariant: max €90 T€ pro Wert), Migration auf
  `bigint` ist im Backlog (`/.planning/REMAINING-TODOS.md` TODO 1)
- **Storno:** §14 Abs. 6 UStG erzwingt Begründung — sowohl im Frontend (3+ Zeichen)
  als auch im RPC (sqlstate `22023` bei Verstoß)
- **Krypto-Statements:** 6 Regex-Patterns + AI-Hint markieren intra-account moves
  (Convert/Sold/Withdrawal) als `is_transfer=true`, damit EKS nicht 4-fach zählt
- **Berlin-Timezone:** Alle Overdue-Berechnungen und Cron-Trigger in `Europe/Berlin`,
  nicht UTC — die Steuer schert sich um Mittel-Europäische Wochentage

## License

Proprietary — © 2026 Kolos Digital. Kein Public-License-Grant. Code für interne
Audits und Steuerberater-Reviews einsehbar.
