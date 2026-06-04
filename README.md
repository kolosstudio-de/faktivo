# Faktivo

> **Buchhaltung & Rechnungen für Aufstocker** — eine deutsche Finanz-SaaS für
> Selbstständige, die gleichzeitig Bürgergeld (Aufstockung) beziehen.
> Rechnungen, Mahnungen, Banking-Import, EÜR, Anlage EKS, Steuerberater-ZIP.
> DSGVO- & GoBD-konform, auf Deutsch, Englisch, Русский, Українською.

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

```bash
# 1. Dependencies
npm ci

# 2. Supabase lokal (braucht Docker)
brew install supabase/tap/supabase   # einmalig
supabase start                       # startet Postgres + Auth + Storage auf :54321
supabase db reset                    # wendet alle Migrationen an

# 3. ENV
cp .env.example .env.local           # falls vorhanden — sonst manuell setzen:
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<aus `supabase status`>
# SUPABASE_SERVICE_ROLE_KEY=<aus `supabase status`>
# ANTHROPIC_API_KEY=sk-ant-…
# RESEND_API_KEY=re_…                 # optional — ohne Key gehen Mails in Dry-Run
# STRIPE_SECRET_KEY=sk_test_…         # optional
# TRUELAYER_CLIENT_ID=…               # optional
# TRUELAYER_CLIENT_SECRET=…           # optional

# 4. Dev-Server
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
