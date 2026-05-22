#!/bin/bash
# Quick Cloudflare Tunnel — random URL, kein Account nötig.
# Perfekt zum schnellen Testen mit ein paar Beta-Usern.
#
# Voraussetzung: dev-server läuft (npm run dev → :3000) + supabase up.
#
# Run: ./scripts/deploy/tunnel-quick.sh
# Stop: Ctrl+C

set -e

cd "$(dirname "$0")/../.."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared nicht gefunden. Installieren mit:"
  echo "   brew install cloudflared"
  exit 1
fi

# Pre-check: ist :3000 lauschig?
if ! curl -sf http://localhost:3000/de >/dev/null 2>&1; then
  echo "⚠️  Dev-server auf :3000 nicht erreichbar."
  echo "   Starte 'npm run dev' in einem anderen Terminal."
  exit 1
fi

echo "🚀 Faktivo Tunnel startet..."
echo ""
echo "Was passiert:"
echo "  • Dein Mac wird zum Web-Server"
echo "  • Cloudflare gibt dir eine öffentliche URL (~5 sek)"
echo "  • Jeder kann auf https://*.trycloudflare.com zugreifen"
echo "  • Wenn du Ctrl+C drückst → Tunnel zu, App nicht mehr erreichbar"
echo ""
echo "Hinweise:"
echo "  • URL ändert sich bei jedem Neustart (random subdomain)"
echo "  • Free, ohne Account, ohne Kreditkarte"
echo "  • Für FESTE URL: ./scripts/deploy/tunnel-fixed-setup.sh ausführen"
echo ""

cloudflared tunnel --url http://localhost:3000
