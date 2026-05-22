# Faktivo Deployment Roadmap

3 Stufen — von «mein Mac als Server» (heute, 0 €) bis Production (50 €/Monat).

---

## Stufe 1 — Local-as-a-Server (jetzt, 0 €)

Dein Mac ist der Server. Cloudflare Tunnel pumpt ihn ins öffentliche Web.

### Quick Start (random URL)
```bash
# Terminal 1: alles auf einmal starten — synct supabase site_url automatisch
./scripts/deploy/start-all.sh

# → URL erscheint nach ~5 sek, z.B.:
#   https://tale-warnings-vocals-controversial.trycloudflare.com
#
# Magic: das Skript schreibt diese URL automatisch in supabase/config.toml
# als site_url. So funktionieren E-Mail-Bestätigungslinks für Tester
# (sonst zeigen sie auf localhost:3000 und failen extern).
```

URL ändert sich bei jedem Neustart. Wenn du den Tunnel neustartest ohne
start-all.sh, ruf manuell `./scripts/deploy/sync-tunnel-url.sh` auf.

### Mit fester URL (free Cloudflare-Account + Domain)
```bash
# Einmalig:
./scripts/deploy/tunnel-fixed-setup.sh

# Danach jedes Mal:
./scripts/deploy/tunnel-fixed-run.sh

# → https://app.kolos.digital
```

### Was funktioniert
- ✅ Erste Beta-User (alle die du persönlich kennst, 10-20 Leute)
- ✅ Demos für Kunden, Investoren
- ✅ Eigene Nutzung von überall (öffne Faktivo vom Handy)

### Was NICHT funktioniert
- ❌ Mac aus = Server aus = User können nicht arbeiten
- ❌ Mac im Sleep-Mode → Tunnel zu
- ❌ Skalierung > 50 User
- ❌ DSGVO-Profis: Server "in der Wohnung" sieht unprofessionell aus

### Workaround für Always-On
- Settings → Battery → "Prevent automatic sleeping when display is off" ON
- Mac an Strom + Cloudflare Tunnel auto-restart bei Boot:
  ```bash
  brew services start cloudflared
  ```

---

## Stufe 2 — Vercel Cloud Deploy (Production-ready, ~5–25 €/Monat)

Wenn du Geld investieren willst: 1× deployen, läuft 24/7.

### Was du brauchst
1. **Vercel-Account** (free für Hobby, 20 €/Monat für Pro)
2. **Supabase Cloud-Project** (free bis 500 MB DB + 50K Auth-User)
3. **Domain** (~12 €/Jahr bei Cloudflare)

### Setup-Schritte

#### 1. Supabase Cloud anlegen
```bash
# https://supabase.com/dashboard/new
# Region: eu-central-1 (Frankfurt) — DSGVO!
# Project name: faktivo-prod
# DB password: random, speichern!
```

Dann:
```bash
# Lokal mit Cloud-Project verlinken
npx supabase link --project-ref <PROJECT_REF>

# Migrationen pushen (alle 9)
npx supabase db push

# Storage-Buckets erstellen (falls noch nicht):
npx supabase storage ls remote
# Bei Bedarf nachholen via Dashboard → Storage
```

#### 2. Vercel Deploy
```bash
# Erstmaliges Setup
npx vercel --prod

# Folge den Prompts:
#   - Link to existing project? No → erstelle neu
#   - Framework: Next.js (auto-detected)
#   - Build command: npm run build
#   - Output: .next
```

#### 3. Environment Variables in Vercel
Im Vercel-Dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL          = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = eyJ... (aus Supabase Dashboard)
SUPABASE_SERVICE_ROLE_KEY         = eyJ... (Settings > API)
NEXT_PUBLIC_APP_URL                = https://app.faktivo.de

CRON_SECRET                       = $(openssl rand -hex 32)

ANTHROPIC_API_KEY                 = sk-ant-...     (für AI-Features)
RESEND_API_KEY                    = re_...          (Email — siehe Hinweis ↓)
EMAIL_FROM                        = Faktivo <noreply@faktivo.de>
# Alternativ (DSGVO-Empfehlung): Brevo statt Resend, siehe Sektion "Provider".
BREVO_API_KEY                     = xkeysib-...     (optional, ersetzt RESEND_API_KEY)

STRIPE_SECRET_KEY                 = sk_live_...    (Pay-Links + Subscriptions Fallback)
STRIPE_WEBHOOK_SECRET             = whsec_...
# Alternativ (DE-Empfehlung): Mollie für Subscriptions — bessere SEPA-Fees.
MOLLIE_API_KEY                    = live_...        (optional, primärer Subscription-Provider)
MOLLIE_WEBHOOK_SECRET             =

TRUELAYER_CLIENT_ID               = (optional, falls TrueLayer approved)
TRUELAYER_CLIENT_SECRET           =
```

#### 4. Custom Domain
```bash
# Vercel → Domains → Add → app.faktivo.de
# Vercel zeigt DNS-Records, in Cloudflare oder Registrar eintragen.
# SSL-Cert: automatisch via Let's Encrypt
```

### Cost Estimate (Stufe 2)
| Service | Free Tier | Wenn drüber |
|---|---|---|
| Vercel | Hobby plan free | 20 €/mo Pro |
| Supabase | 500 MB DB, 50K MAU | 25 €/mo Pro |
| Domain | — | 12 €/Jahr |
| Resend | 3K Mails/Monat | 20 €/mo |
| Anthropic Claude | $5 Trial | Pay-as-you-go (~$0.003/OCR) |
| Stripe | 0€ Setup | 1.5% + 0.25€ pro Zahlung |

**Realistisch für 100 paying users**: ~25-50 €/Monat Infrastruktur, ~70 €/Monat profit pro €5.90-Pro-Plan.

### Migration von Stufe 1 → Stufe 2 (30 Minuten)
```bash
# 1. Lokale DB → SQL Dump
npx supabase db dump --data-only > local-data.sql

# 2. Cloud DB importieren
psql "$CLOUD_DB_URL" < local-data.sql

# 3. Storage migrieren (Belege)
npx supabase storage cp local://belege/* remote://belege/

# 4. Vercel deploy
git push origin main
# → Vercel auto-deploy

# 5. Tunnel stoppen, DNS auf Vercel
# Fertig!
```

---

## Stufe 3 — Self-Hosted (volle Kontrolle, ~5 €/Monat)

Wenn du keinen Cloud-Anbietern vertrauen willst.

### Setup (Hetzner Cloud Frankfurt, ~5 €/Monat)
1. Hetzner CX22 Server (2vCPU, 4GB RAM, FRA)
2. Coolify oder Dokku für Git-Push-Deploy
3. Self-hosted Supabase (offizieller Docker-Compose)
4. Caddy Reverse Proxy + automatische Let's Encrypt
5. tägliche Backups → S3-kompatibles Storage (Hetzner Object Storage 0.99 €/TB)

→ alles auf deinem eigenen Server in Frankfurt.

---

## Encryption-Roadmap (Phase 4 — Sicherheit by Design)

Wenn du Web-Version mit "Wir haben keinen Zugriff auf eure Daten" verkaufen willst:

### Option A: Field-level Encryption
Sensitive Felder (`vendor`, `description`, `iban`, OCR-Beleg-Inhalt) werden **im Browser** vor Upload verschlüsselt.

```
Master-Key = Argon2id(password, salt=user_id)
            └── nie an Server gesendet
            └── nur in Browser-Memory
            
Encrypted-Field = AES-256-GCM(plaintext, key=master, iv=random)
                  └── als base64 im Postgres-Feld gespeichert
```

**Vorteile**:
- Server (du!) sieht nur ciphertext
- DB-Backups sind nutzlos für Angreifer
- DSGVO Art. 32 Verschlüsselung erfüllt

**Nachteile**:
- Server-side SQL `WHERE vendor LIKE 'Aral%'` funktioniert nicht
- Recovery bei Passwort-Verlust = unmöglich (oder via Backup-Phrase)
- PDF muss im Browser gerendert werden (oder pre-render auf encrypted-Buffer)

**Aufwand**: 1-2 Wochen für vollständige Migration aller Felder.

### Option B: Hybrid (empfohlen)
- **Metadaten** (Datum, Betrag, Kategorie-ID) bleiben plaintext → SQL-Queries möglich
- **Inhalte** (vendor name, description, IBAN, Belege) encrypted

→ 80% Privacy, 100% Performance.

### Option C: Local-First (Tauri Desktop App)
Wir haben schon angefangen in `desktop/` — das ist die ultimate Form: Daten verlassen den Mac nie.

---

## Empfehlung für DICH (Bootstrap-Phase)

**Heute (0 €)**: Stufe 1 Tunnel — Beta mit 10 Friendly Users.
**Wenn 5+ paying users (~30 €/mo Revenue)**: Stufe 2 Vercel.
**Wenn 50+ paying users**: Encryption-Layer als Premium-Feature.
**Wenn 500+ paying users**: Stufe 3 self-hosted oder Tauri Desktop.

---

## Provider-Empfehlungen (Marktanalyse Apr 2026)

### Payments — Mollie statt Stripe (für DE-Markt)

Beide funktionieren. Aber für deutsche Kunden mit SEPA-Lastschrift (~17%
des DE-E-Commerce) ist **Mollie** günstiger und freundlicher zu Einzel­
unternehmern.

| Provider | SEPA-Lastschrift | Karten | KYC | Subscriptions | Empfehlung |
|---|---|---|---|---|---|
| **Mollie** | **0,9 % + 0,25 €** | 1,8 % + 0,25 € | Niedrig — Einzelunternehmer-freundlich | ✅ nativ | ⭐ Primär |
| Stripe | 0,35 € + Basisaufschlag | 1,5 % + 0,25 € | Mittel | ✅ best-in-class | Fallback für nicht-EU Karten |
| Paddle | inkludiert | 5 % + 0,50 $ | Hoch | ✅ MoR | ✗ MoR-Aufschlag bei §19 sinnlos |
| Lemon Squeezy | via Stripe | 5 % + 0,50 $ | Mittel | ✅ MoR | ✗ wie Paddle |

**Onboarding Mollie**:
1. https://www.mollie.com/de/signup — Einzelunternehmen, IBAN, Ausweis
2. Dashboard → Entwickler → API-Keys → Test/Live Key
3. `MOLLIE_API_KEY=test_...` in `.env.local`
4. Plan-IDs in Stripe-Style anlegen → `NEXT_PUBLIC_MOLLIE_PRICE_PRO_MONTHLY=...`

Stripe-Scaffolding bleibt im Code (`src/lib/billing/stripe.ts`,
`src/app/api/billing/checkout/route.ts`) als Fallback — wenn ein US-Kunde
mit Karte zahlt, kannst du beides nebeneinander betreiben.

### E-Mails — Brevo statt Resend (für DSGVO-Komfort)

Resend ist ok (EU-Send-Region seit 2024), aber Account-/Logdaten in den
USA. Für eine deutsche Kundenbasis mit AVV-Anforderungen ist **Brevo**
(ex-Sendinblue) der saubere Default.

| Provider | EU-Server | DE-Server | AVV out-of-the-box | Free-Tier |
|---|---|---|---|---|
| **Brevo** | ✅ | ✅ Frankfurt + Paris | ✅ TÜV-Rheinland-Audit | 300 Mails/Tag |
| Resend | ⚠ EU-Send, US-Logs | ✗ | ✅ DPA + SCC | 3 000 Mails/Monat |
| Mailgun | ✅ EU-Region | ✗ | ✅ | 5 000 Mails/Monat (Trial) |
| Postmark | ✗ US | ✗ | ✅ DPA + SCC | 100 Mails/Monat |

**Onboarding Brevo**:
1. https://www.brevo.com/de/ → Account anlegen → "Transactional E-Mail"
2. SMTP & API → API-Key generieren → `BREVO_API_KEY=xkeysib-...`
3. Sender authentifizieren: `noreply@faktivo.de` → DKIM-Records ins DNS
4. Code-Migration: `src/lib/email/send-invoice.ts` von Resend-SDK auf
   Brevo-SDK umstellen (`@getbrevo/brevo`); Templates bleiben gleich.

**Migration in Stages**: Erst Resend nutzen (schon installiert,
schnellster Pfad), bei DSGVO-kritischen Kunden migrieren. Datenschutz-
erklärung im Subprocessor-Abschnitt entsprechend pflegen.

### Email-Confirmation-Flow (Single-Opt-In ist OK)

- Account-Verify-Mails dürfen **Single-Opt-In** sein (der Klick auf den
  Link IST der DOI-Schritt). Quelle: BGH + Art. 6 I b DSGVO.
- 4 Sprachen (de/en/ru/uk) automatisch nach UI-Auswahl: legal, keine
  separate Einwilligung nötig.
- Marketing-Newsletter sind eine ANDERE Sache → strikt Double-Opt-In,
  eigene Checkbox, eigener DOI-Flow.

Solange kein Geld da ist → Stufe 1 ist okay. Tunnel ist nicht "low-quality" — Cloudflare hält Hyperscaler-SLA.
