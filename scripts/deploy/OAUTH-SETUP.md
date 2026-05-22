# OAuth-Setup: Google + Apple Sign-In für Faktivo

Schritt-für-Schritt für lokal-as-a-Server (Cloudflare Tunnel) und später Production.

---

## Übersicht

Faktivo unterstützt drei Login-Wege:
1. **E-Mail + Passwort** mit Bestätigungs-Mail (Supabase Auth, sofort einsatzbereit)
2. **Magic Link** (Supabase Auth, sofort einsatzbereit)
3. **Google Sign-In** + **Apple Sign-In** (OAuth, benötigt einmaliges Setup pro Provider)

OAuth-Provider sind in `supabase/config.toml` als `enabled = false` vorkonfiguriert. Aktiviere sie, sobald du Client-ID + Secret hast.

---

## Vorbereitung: Tunnel-URL ermitteln

Damit OAuth-Provider den Redirect zurück zu Faktivo erlauben, brauchst du eine **stabile öffentliche URL**:

### Option A — Quick & Dirty (random URL)
```bash
./scripts/deploy/start-all.sh
# → https://soft-fluffy-banana-123.trycloudflare.com (URL ändert sich bei jedem Restart)
```
**Problem**: Bei jedem Tunnel-Restart musst du die OAuth-Redirect-URLs aktualisieren. Nicht praktikabel für Apple (deren Review dauert lange).

### Option B — Empfohlen: Feste Domain (Cloudflare Tunnel + eigene Domain)
```bash
./scripts/deploy/tunnel-fixed-setup.sh    # einmalig
./scripts/deploy/tunnel-fixed-run.sh      # bei jedem Start
# → https://app.kolos.digital (oder dein eigener Domain)
```

**Mindestvoraussetzung für OAuth**: deine eigene Domain unter Cloudflare-DNS-Management.

---

## 1. Google Sign-In

### 1.1 Google Cloud Console
1. Gehe zu https://console.cloud.google.com/
2. Neues Projekt erstellen → „Faktivo" (oder vorhandenes wählen).
3. APIs & Services → **OAuth consent screen**:
   - User type: **External**
   - App name: `Faktivo`
   - User support email: `kolosvasiliysergeevich@gmail.com`
   - Developer contact: `kolosvasiliysergeevich@gmail.com`
   - Scopes: `email`, `profile`, `openid` (Standard)
   - Test users: füge deine Test-Mails hinzu (während App im „Testing" steht; max. 100)
4. APIs & Services → **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: **Web application**
   - Name: `Faktivo Web`
   - **Authorized JavaScript origins**:
     - `https://app.kolos.digital` (oder deine Tunnel-URL)
     - `http://localhost:3000` (für `npm run dev`)
   - **Authorized redirect URIs**:
     - `https://<dein-supabase-project>.supabase.co/auth/v1/callback` (Production)
     - `http://127.0.0.1:54321/auth/v1/callback` (lokal Supabase)
5. Notiere **Client ID** + **Client Secret**.

### 1.2 Faktivo .env.local
```bash
# .env.local
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<paste>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<paste>
```

### 1.3 Supabase aktivieren
In `supabase/config.toml` setze:
```toml
[auth.external.google]
enabled = true
```
Dann `npx supabase stop && npx supabase start` (lokal) oder im Supabase-Cloud-Dashboard unter **Authentication → Providers → Google** Client-ID + Secret eintragen + aktivieren.

### 1.4 Test
- App öffnen → /login → „Mit Google fortfahren"
- Google-Zustimmung → Redirect zurück zu `/auth/callback` → Dashboard ✅

---

## 2. Apple Sign-In

⚠️ **Voraussetzung**: kostenpflichtiger **Apple Developer Account** (99 USD / Jahr — https://developer.apple.com/programs/).

### 2.1 Apple Developer Portal
1. **Certificates, Identifiers & Profiles** → **Identifiers** → „+" → **App IDs** → **App**:
   - Bundle ID: `digital.kolos.faktivo` (z. B.)
   - Capabilities: **Sign In with Apple** ✓
2. **Identifiers** → „+" → **Services IDs** → **Web Authentication**:
   - Identifier: `digital.kolos.faktivo.web`
   - **Sign In with Apple → Configure**:
     - Primary App ID: `digital.kolos.faktivo`
     - Domains and Subdomains: `app.kolos.digital`
     - Return URLs:
       - `https://<dein-supabase-project>.supabase.co/auth/v1/callback`
   - Speichern.
3. **Keys** → „+" → Name `Faktivo Sign-In Key` → ✓ **Sign in with Apple** → Configure → Primary App ID → Continue → Register → **Key ID notieren** + `.p8`-Datei downloaden.
4. **Team-ID** notieren (oben rechts in der Apple-Dev-Konsole).

### 2.2 Client Secret JWT generieren
Apple verlangt — anders als Google — ein **kurzlebiges JWT als Client-Secret**, signiert mit dem `.p8`-Schlüssel. Das JWT ist max. 6 Monate gültig und muss erneuert werden.

```bash
npm install jsonwebtoken
node scripts/deploy/apple-jwt.mjs \
  --team-id ABCDE12345 \
  --key-id ABCDE12345 \
  --client-id digital.kolos.faktivo.web \
  --p8 ./AuthKey_ABCDE12345.p8
# → eyJraWQiOiJBQkN…  (paste in env)
```

(Falls `apple-jwt.mjs` noch nicht existiert: nutze https://github.com/supabase/auth/blob/master/internal/api/provider/apple_test.go als Referenz oder das offizielle Snippet aus der Supabase-Doku https://supabase.com/docs/guides/auth/social-login/auth-apple.)

### 2.3 Faktivo .env.local
```bash
SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID=digital.kolos.faktivo.web
SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=<JWT aus Schritt 2.2>
```

### 2.4 Supabase aktivieren
```toml
[auth.external.apple]
enabled = true
```

### 2.5 Test
- /login → „Mit Apple fortfahren"
- Apple-Login → Redirect zurück → Dashboard ✅

---

## 3. Production-Migration

Sobald Faktivo auf Vercel + Supabase Cloud läuft (siehe DEPLOYMENT.md Stufe 2):

1. Supabase-Cloud-Dashboard → **Authentication → URL Configuration**:
   - Site URL: `https://app.faktivo.de`
   - Redirect URLs: `https://app.faktivo.de/**`
2. **Authentication → Providers → Google / Apple**:
   - Client-ID + Secret übertragen.
3. Google Cloud Console → Authorized redirect URI **erweitern** um Production-Supabase-Callback.
4. Apple Developer → Services-ID → Return URL **ergänzen** um Production-Supabase-Callback.
5. Vercel → Project → Environment Variables → Server-side Supabase-Keys eintragen (siehe DEPLOYMENT.md).

---

## Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| `redirect_uri_mismatch` | URI in Google/Apple ≠ Supabase-Callback | Exakt gleiche URI eintragen — auch `https://` vs. `http://` matters |
| `invalid_grant` (Apple) | JWT abgelaufen | Apple-JWT neu generieren (max. 6 Mt. gültig) |
| `Email already exists` | Erstes Login per Google, dann erneut per E-Mail mit selber Adresse | Account-Linking aktivieren oder Apple-Sign-In: Apple liefert anonymisierte Adresse `xxx@privaterelay.appleid.com` |
| Lokal funktioniert, Tunnel-URL nicht | Tunnel-URL nicht in Authorized JS Origins | Bei festem Tunnel: einmalig URL eintragen. Bei random URL: Pech — feste URL aufsetzen |
| Apple-Button wird in Safari nicht angezeigt | Browser-Cookie-Restriktion | „Cross-Site Tracking" temporär in Safari erlauben |

---

## Sicherheitshinweise

- Niemals `.p8`-Datei oder `Client Secret` in Git committen → `.env.local` ist in `.gitignore`.
- Apple-JWT alle 6 Monate **rotieren** (Cron-Job: `0 0 1 1,7 * apple-jwt.mjs > .env.local.apple`).
- Google: in Production Werks-Modus aktivieren ("Publish App") → Verifizierungsprozess durch Google (~2-4 Wochen).

---

## Weiterführende Links

- Supabase Auth Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Supabase Auth Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Apple Sign-In JS-Doku: https://developer.apple.com/sign-in-with-apple/get-started/
- Cloudflare Tunnel Custom Domain: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/routing-to-tunnel/dns/
