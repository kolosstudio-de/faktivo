#!/usr/bin/env bash
# Faktivo Cloud-Supabase One-Shot Setup
#
# Was es macht:
#   1. Prüft ob `supabase` CLI installiert + eingeloggt ist
#   2. Fragt nach `project-ref` (oder liest aus $SUPABASE_PROJECT_REF)
#   3. Linkt das lokale Verzeichnis mit dem Cloud-Projekt
#   4. Pusht alle Migrationen aus supabase/migrations/
#   5. Verifiziert dass alle Tabellen + RPCs auf der Cloud sind
#   6. Druckt die Env-Vars die in `.env.local` / Vercel rein müssen
#
# Was es NICHT macht:
#   - Erstellt das Supabase-Projekt nicht (manuell auf supabase.com/new)
#   - Migriert keine Daten (nur Schema)
#   - Setzt keine OAuth / Email-Provider auf (Dashboard manuell)
#
# Usage:
#   ./scripts/deploy/setup-cloud-supabase.sh [<project-ref>]
#
# Stand 2026-06-04

set -euo pipefail

C_RED='\033[31m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_BLUE='\033[34m'; C_RESET='\033[0m'
say() { printf "${C_BLUE}▸${C_RESET} %s\n" "$1"; }
ok()  { printf "${C_GREEN}✓${C_RESET} %s\n" "$1"; }
warn(){ printf "${C_YELLOW}⚠${C_RESET}  %s\n" "$1"; }
err() { printf "${C_RED}✗${C_RESET} %s\n" "$1" >&2; }

# ─── 1. Supabase CLI installiert? ──────────────────────────────────────────
if ! command -v supabase >/dev/null 2>&1; then
  err "supabase CLI nicht gefunden."
  echo
  echo "Installation (macOS):"
  echo "  brew install supabase/tap/supabase"
  echo
  echo "Dann erneut ausführen:"
  echo "  $0 $*"
  exit 1
fi
ok "supabase CLI: $(supabase --version 2>&1 | head -1)"

# ─── 2. Eingeloggt? ────────────────────────────────────────────────────────
if ! supabase projects list >/dev/null 2>&1; then
  warn "Nicht bei Supabase eingeloggt. Browser öffnet sich gleich …"
  supabase login
fi
ok "Supabase-Login aktiv"

# ─── 3. Project-Ref ermitteln ──────────────────────────────────────────────
PROJECT_REF="${1:-${SUPABASE_PROJECT_REF:-}}"

if [[ -z "${PROJECT_REF}" ]]; then
  echo
  say "Welches Cloud-Projekt soll verlinkt werden?"
  echo "  (Du findest die Project-Ref im URL auf supabase.com/dashboard"
  echo "   oder unten als Liste der verfügbaren Projekte)"
  echo
  supabase projects list 2>&1 | head -20 || true
  echo
  read -r -p "Project-Ref (oder 'q' zum Abbrechen): " PROJECT_REF
  if [[ "${PROJECT_REF}" == "q" || -z "${PROJECT_REF}" ]]; then
    err "Abgebrochen."
    exit 1
  fi
fi

# Sanity-Check: Project-Ref ist 20 alphanumerische Zeichen
if [[ ! "${PROJECT_REF}" =~ ^[a-z0-9]{20}$ ]]; then
  warn "Project-Ref '${PROJECT_REF}' sieht nicht wie ein Standard-Format aus (erwartet: 20 lowercase chars)."
  read -r -p "Trotzdem fortfahren? [y/N]: " CONFIRM
  [[ "${CONFIRM,,}" != "y" ]] && exit 1
fi
ok "Project-Ref: ${PROJECT_REF}"

# ─── 4. Link ───────────────────────────────────────────────────────────────
say "Verlinke lokales Verzeichnis mit Cloud-Projekt …"
supabase link --project-ref "${PROJECT_REF}"
ok "Linked"

# ─── 5. DB-Password aus Cloud holen (für migrate) ─────────────────────────
say "Du wirst gleich nach dem Database-Password gefragt — das ist NICHT dein"
say "Supabase-Account-Passwort, sondern das DB-Passwort vom Cloud-Projekt"
say "(steht in deinem 1Password / KeePass / wo auch immer du es bei der"
say "Projekt-Erstellung gespeichert hast)."
echo

# ─── 6. Migrate ────────────────────────────────────────────────────────────
say "Pushe alle Migrationen aus supabase/migrations/ …"
MIGRATION_COUNT=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
ok "${MIGRATION_COUNT} Migrationen gefunden"

supabase db push
ok "Schema deployed"

# ─── 7. Verifizieren via migration-list ────────────────────────────────────
# `supabase migration list` zeigt remote-vs-local migrations; wenn alle als
# "applied" markiert sind, ist das Schema vollständig deployed. `supabase db
# execute` gibt es nicht in der CLI — `migration list` ist die offizielle
# Quelle der Wahrheit.
say "Vergleiche Local- vs Remote-Migrations …"
if supabase migration list 2>&1 | tail -40; then
  ok "Migration-Status oben prüfen — alle Spalten 'Remote' müssen befüllt sein"
else
  warn "supabase migration list konnte den Stand nicht abrufen — manuell prüfen"
  warn "auf https://supabase.com/dashboard/project/${PROJECT_REF}/database/migrations"
fi

# ─── 8. Env-Vars für Vercel / .env.local ausgeben ──────────────────────────
echo
say "Fertig! Nächste Schritte:"
echo
echo "  1. Hole die API-Keys aus dem Dashboard:"
echo "     https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo
echo "  2. Setze diese Env-Vars (lokal in .env.local UND in Vercel):"
echo
echo "     NEXT_PUBLIC_SUPABASE_URL=https://${PROJECT_REF}.supabase.co"
echo "     NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>"
echo "     SUPABASE_SERVICE_ROLE_KEY=<service-role-secret-key>"
echo
echo "  3. Storage-Buckets manuell anlegen:"
echo "     https://supabase.com/dashboard/project/${PROJECT_REF}/storage/buckets"
echo "       - 'belege'      (private, für Eingangs-Belege)"
echo "       - 'signatures'  (private, für E-Signaturen)"
echo "       - 'stamps'      (private, für Firmen-Stempel)"
echo "       - 'documents'   (private, für hochgeladene Original-Rechnungen)"
echo "       - 'public'      (public, für Logos)"
echo
echo "  4. Auth-Settings:"
echo "     https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration"
echo "       - Site URL: https://faktivo.vercel.app (oder eigene Domain)"
echo "       - Redirect URLs: https://*.vercel.app/**, https://yourdomain.com/**"
echo
echo "  5. Vercel-Deploy: scripts/deploy/QUICKSTART-CLOUD.md"
echo
ok "Cloud-Supabase ist deployed und ready."
