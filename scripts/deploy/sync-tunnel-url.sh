#!/bin/bash
# Faktivo — Sync supabase site_url mit aktueller Cloudflare-Tunnel-URL.
#
# Wenn du den Tunnel öffnest und Tester-Links via E-Mail verschickst, müssen
# diese Links auf die öffentliche Tunnel-URL zeigen — nicht auf localhost:3000.
# Dieses Skript liest die Tunnel-URL aus /tmp/faktivo-tunnel.log, schreibt sie
# in supabase/config.toml und startet Supabase neu.
#
# Aufruf:  ./scripts/deploy/sync-tunnel-url.sh
# Vorab: start-all.sh muss laufen (Tunnel + Next.js + Supabase).

set -e
cd "$(dirname "$0")/../.."

LOG="/tmp/faktivo-tunnel.log"

if [[ ! -f "$LOG" ]]; then
  echo "✗ Tunnel-Log $LOG nicht gefunden — läuft start-all.sh überhaupt?"
  exit 1
fi

URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG" | tail -1)

if [[ -z "$URL" ]]; then
  echo "✗ Keine Tunnel-URL im Log gefunden."
  exit 1
fi

echo "→ Tunnel-URL erkannt: $URL"
echo "→ Schreibe site_url in supabase/config.toml ..."

# macOS sed -i '' / Linux sed -i unterscheiden sich. Wir nutzen ein Backup-Suffix.
sed -i.bak -E "s|^site_url = \".*\"|site_url = \"$URL\"|" supabase/config.toml
rm -f supabase/config.toml.bak

# additional_redirect_urls muss tunnel sowieso enthalten — schon in der
# config drin via "https://*.trycloudflare.com/**".

echo "→ Supabase neu starten ..."
npx supabase stop >/dev/null 2>&1 || true
npx supabase start 2>&1 | tail -3

echo ""
echo "✓ Fertig. site_url = $URL"
echo "  E-Mails verlinken jetzt korrekt auf den Tunnel."
echo ""
echo "  Test-Links:"
echo "    Login   : $URL/de/login"
echo "    Signup  : $URL/de/sign-up"
echo "    Pricing : $URL/de/pricing"
