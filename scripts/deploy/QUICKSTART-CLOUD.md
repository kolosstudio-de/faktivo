# Faktivo — Cloud Deployment Quickstart

**Ziel:** Faktivo läuft 24/7 für deine Kunden, du arbeitest lokal ohne Docker.

**Aufwand:** ~30 Minuten Klicks + Copy/Paste. **Kosten:** 0 € auf Free-Tiers.

```
┌─────────────┐    auto-deploy     ┌──────────────┐
│   GitHub    │ ────────────────▶  │   Vercel     │ ← Next.js runtime
│ kolosstudio │  on git push       │   (fra1)     │   faktivo-*.vercel.app
└─────────────┘                    └──────┬───────┘
                                          │
                                          ▼ über NEXT_PUBLIC_SUPABASE_URL
                                   ┌──────────────┐
                                   │  Supabase    │ ← Postgres+Auth+Storage
                                   │ Cloud (eu-…) │   xxx.supabase.co
                                   └──────────────┘
```

---

## Schritt 1 — Supabase-Projekt in der Cloud erstellen (~3 Min)

> Account-Creation muss manuell erfolgen — kein CLI-Workaround. Browser auf.

1. Öffne **https://supabase.com/dashboard** → Sign up via GitHub
2. **«New project»**:
   - **Name:** `faktivo-prod`
   - **Database password:** generiere stark, speichere in 1Password/Bitwarden
   - **Region:** **eu-central-1 (Frankfurt)** ← wichtig: GDPR + closest to DACH-Nutzer
   - **Plan:** Free ($0/mo, 500 MB DB, 50 K MAU — reicht für die ersten 100 Nutzer)
3. Klick **«Create new project»** → ~2 Min warten bis Status «Active»

---

## Schritt 2 — Schema deployen (1 CLI-Command, ~2 Min)

> Macht alles Andere automatisch.

```bash
# CLI installieren (einmalig)
brew install supabase/tap/supabase

# Vom Faktivo-Repo aus:
cd "/Users/vasylkolos/Downloads/claude code/AngebotRechnung"

# Setup-Script: linkt + pushed alle 38+ Migrations + verifiziert
./scripts/deploy/setup-cloud-supabase.sh
```

Das Skript fragt nach deinem **Project-Ref** (steht im URL deines Supabase-Dashboards) und dem **Database-Password** (das du in Schritt 1 gesetzt hast). Danach läuft alles automatisch.

Am Ende kriegst du die 3 Env-Vars in der Konsole — die brauchst du gleich für Vercel.

---

## Schritt 3 — Storage-Buckets manuell anlegen (~2 Min)

> Buckets gehen leider nicht über Migrations. Eine Minute Klicken im Dashboard.

Öffne `https://supabase.com/dashboard/project/<PROJECT_REF>/storage/buckets` und erstelle 5 Buckets:

| Name | Public? | Wofür |
|------|---------|-------|
| `belege` | **No** | Eingangs-Belege (Quittungen, Rechnungen) |
| `signatures` | **No** | E-Signaturen der Nutzer |
| `stamps` | **No** | Firmen-Stempel |
| `documents` | **No** | Hochgeladene Original-Rechnungen (Import) |
| `public` | **Yes** | Logo-Bilder (auf Invoice-PDFs sichtbar) |

---

## Schritt 4 — Vercel-Deploy mit GitHub-Auto-Build (~5 Min)

> Hier wird's komfortabel: 1× connecten, danach push = deploy.

1. Öffne **https://vercel.com/new** → Sign up via GitHub
2. Klick **«Import»** beim Repo `kolosstudio-de/faktivo`
3. Framework wird automatisch als **Next.js** erkannt — alles auf Default lassen
4. **Environment Variables** — fülle das Minimum aus:

```
NEXT_PUBLIC_SUPABASE_URL          = https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJhbGc… (Dashboard → Settings → API → anon public)
SUPABASE_SERVICE_ROLE_KEY         = eyJhbGc… (Dashboard → Settings → API → service_role secret)
ANTHROPIC_API_KEY                 = sk-ant-…
CRON_SECRET                       = <openssl rand -hex 32>
NEXT_PUBLIC_APP_URL               = https://faktivo.vercel.app  (oder eigene Domain)
```

**Optional (wenn du sie schon hast — sonst später nachtragen):**

```
RESEND_API_KEY                    = re_…       # E-Mail-Versand (sonst Dry-Run)
EMAIL_FROM                        = Faktivo <noreply@faktivo.de>
STRIPE_SECRET_KEY                 = sk_test_…  # Stripe Payment-Links
STRIPE_WEBHOOK_SECRET             = whsec_…
TRUELAYER_CLIENT_ID               = …          # Open-Banking
TRUELAYER_CLIENT_SECRET           = …
```

5. Klick **«Deploy»** → ~2 Min Build → fertig 🎉

Du bekommst eine URL wie `faktivo-xxx.vercel.app`. **Das ist der Live-Sait.**

---

## Schritt 5 — Auth-Settings in Supabase ergänzen (~1 Min)

> Damit Sign-In + Magic-Link Mails auf den richtigen Domain redirecten.

`https://supabase.com/dashboard/project/<PROJECT_REF>/auth/url-configuration`:

- **Site URL:** `https://faktivo.vercel.app` (deine Vercel-URL aus Schritt 4)
- **Redirect URLs (eine pro Zeile):**
  ```
  https://faktivo.vercel.app/**
  https://*.vercel.app/**          # für Preview-Deploys
  http://localhost:3000/**         # für lokale Entwicklung
  ```

---

## Schritt 6 — Local-Dev ohne Docker (~30 Sek)

> Du arbeitest jetzt mit Cloud-DB von local-Mac aus. Kein `supabase start` mehr.

Erstelle / aktualisiere `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
SUPABASE_SERVICE_ROLE_KEY=eyJ…
ANTHROPIC_API_KEY=sk-ant-…
# Alle anderen Vars siehe .env.local.example
```

Dann:
```bash
npm run dev
```

→ `http://localhost:3000` — Local-Dev mit Cloud-DB. Docker bleibt aus. ✨

---

## ⚠️ Wichtige Limits auf Free-Tier

| Limit | Vercel Hobby | Supabase Free | Workaround |
|-------|--------------|---------------|------------|
| Function-Timeout | **60 s** | — | Steuerberater-ZIP über 60s ZIP-Größe? → Pro-Plan |
| DB-Größe | — | **500 MB** | Reicht für ~50K Rechnungen + Belege |
| Bandwidth/mo | **100 GB** | 5 GB | Bei 100+ aktive Nutzer Pro upgraden |
| Cron-Jobs | **1 pro Tag** auf Hobby | — | Hobby reicht für `daily reminders` nicht — vercel.json hat 3 crons konfiguriert, 2 davon werden ignoriert. Pro-Plan löst das. |
| Edge Functions | unbegrenzt | — | — |

→ Realistic Plan: starte auf Free, upgrade Vercel auf Pro ($20/mo) sobald mehr als ein Cron-Job nötig ist.

---

## ⚙️ Was nach Deploy automatisch passiert

Jeder `git push origin main`:
1. GitHub Actions: Lint + Typecheck + Tests laufen (`.github/workflows/ci.yml`)
2. Vercel: erkennt Push, baut Production, swappt Live-Traffic — Zero-Downtime
3. Migrationen: **NICHT automatisch** — du musst manuell `supabase db push` ausführen, wenn du eine neue Migration committest. (Optional: später in CI integrieren.)

---

## Checkliste «Bin ich bereit für ersten echten Nutzer?»

- [ ] Supabase-Projekt läuft in Frankfurt mit deinen Migrations
- [ ] 5 Storage-Buckets sind angelegt
- [ ] Vercel-Deploy erfolgreich, Site lädt auf `faktivo-xxx.vercel.app`
- [ ] Auth-URL-Config in Supabase zeigt auf Vercel-Domain
- [ ] Sign-Up + Login funktionieren (Test mit eigenem Account)
- [ ] Onboarding-Wizard durchgespielt, erste Test-Rechnung erstellt + PDF downgeloadet
- [ ] (Optional) Custom Domain `faktivo.de` mit Cloudflare/Registrar verbunden
- [ ] (Optional) Resend API-Key gesetzt, Test-Mahnung versandt
- [ ] (Optional) Sentry-DSN gesetzt, Errors landen im Dashboard

Wenn alle Häkchen → **Production-ready**. 🚀

---

## Troubleshooting

**Build failed: `Module not found`**
→ Vermutlich `.npmrc` mit private Registry — auf Vercel ist nur public-npm verfügbar. Check `package.json` auf `@scoped/internal-package`.

**Login zeigt White-Screen**
→ Auth-URL-Config in Supabase falsch. Site-URL muss exakt mit Vercel-URL übereinstimmen (https, ohne trailing slash).

**`/api/cron/reminders` läuft nicht**
→ Hobby-Plan = 1 Cron/Tag. Pro-Plan ($20/mo) braucht's, oder reduziere vercel.json auf 1 Cron.

**Supabase API-Key 401**
→ `service_role`-Key ist ein anderer als `anon`-Key. Beide müssen gesetzt sein. Im Dashboard unter Settings → API klar getrennt.

**`supabase db push` fragt nach Password und wirft Error**
→ Das ist NICHT dein Account-Passwort, sondern das **Database-Password** vom Cloud-Projekt (in Schritt 1 gesetzt). Falls vergessen: Dashboard → Settings → Database → «Reset Database Password» (zerstört keine Daten, ändert nur PG-Auth).
