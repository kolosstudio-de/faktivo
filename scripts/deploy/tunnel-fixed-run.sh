#!/bin/bash
# Startet den festen Cloudflare-Tunnel (nach tunnel-fixed-setup.sh).
# Stop: Ctrl+C
set -e
if [ ! -f "$HOME/.cloudflared/config.yml" ]; then
  echo "❌ Tunnel-Config fehlt. Erst ./scripts/deploy/tunnel-fixed-setup.sh ausführen."
  exit 1
fi
tunnel_name=$(grep "^tunnel:" "$HOME/.cloudflared/config.yml" | awk '{print $2}')
echo "🚀 Tunnel '$tunnel_name' startet ..."
cloudflared tunnel run "$tunnel_name"
