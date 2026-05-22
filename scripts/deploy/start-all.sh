#!/bin/bash
# Faktivo — Alles auf einmal starten:
#   1. Supabase (Postgres + Auth + Storage)
#   2. Next.js dev server
#   3. Cloudflare Tunnel (random URL)
#
# Stop: Ctrl+C oder ./scripts/deploy/stop-all.sh
#
# Output: temporäre URL wie https://soft-fluffy-banana-123.trycloudflare.com

set -e

cd "$(dirname "$0")/../.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Faktivo — Local-as-a-Server Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Supabase
echo "[1/3] Supabase starten ..."
if ! npx supabase status 2>/dev/null | grep -q "API URL"; then
  npx supabase start
else
  echo "  ✓ schon up"
fi

# 2. Next.js (im Hintergrund)
echo ""
echo "[2/3] Next.js dev-server starten (Port 3000) ..."
NEXT_LOG=/tmp/faktivo-next.log
if curl -sf http://localhost:3000/de >/dev/null 2>&1; then
  echo "  ✓ schon up auf :3000"
else
  # WICHTIG: shell-exportierte (oft leere) API-Keys unset machen, damit
  # Next.js die Werte aus .env.local nimmt — sonst gewinnt eine leere
  # Shell-Variable und Claude-Aufrufe schlagen mit "API_KEY_MISSING" fehl.
  unset ANTHROPIC_API_KEY ANTHROPIC_BASE_URL AI_AGENT API_TIMEOUT_MS
  npm run dev > "$NEXT_LOG" 2>&1 &
  NEXT_PID=$!
  echo "  PID: $NEXT_PID (logs: $NEXT_LOG)"
  echo -n "  warte auf :3000 ..."
  until curl -sf http://localhost:3000/de >/dev/null 2>&1; do
    sleep 1
    echo -n "."
  done
  echo " ✓"
fi

# 3. Cloudflare Tunnel
echo ""
echo "[3/3] Cloudflare Tunnel öffnen ..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Suche unten: 'https://*.trycloudflare.com' — das ist deine URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TUNNEL_LOG=/tmp/faktivo-tunnel.log
cloudflared tunnel --url http://localhost:3000 > "$TUNNEL_LOG" 2>&1 &
CF_PID=$!

# URL aus Log holen (max. 15 sek warten)
echo -n "  warte auf Tunnel-URL "
for i in {1..15}; do
  URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  [[ -n "$URL" ]] && break
  echo -n "."
  sleep 1
done
echo " ✓"

if [[ -n "$URL" ]]; then
  echo "  → Tunnel: $URL"
  echo ""
  echo "[4/4] Supabase site_url synchronisieren ..."
  ./scripts/deploy/sync-tunnel-url.sh
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Fertig! Teile diese Links mit deinen Testern:"
  echo ""
  echo "    Landing : $URL/de"
  echo "    Signup  : $URL/de/sign-up"
  echo "    Pricing : $URL/de/pricing"
  echo ""
  echo "  Mailpit (lokale Test-E-Mails): http://127.0.0.1:54324"
  echo "  Logs: tail -f $TUNNEL_LOG /tmp/faktivo-next.log"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "  ✗ Keine Tunnel-URL erkannt — siehe Log: $TUNNEL_LOG"
fi

# Tunnel im Foreground halten (Ctrl+C beendet alles)
wait $CF_PID
