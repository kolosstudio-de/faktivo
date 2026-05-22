#!/bin/bash
# Setup für FESTE Cloudflare Tunnel URL — bleibt zwischen Neustarts gleich.
# Voraussetzung: Cloudflare-Account (free) + eine Domain bei Cloudflare.
#
# Wenn du KEINE eigene Domain hast → benutze tunnel-quick.sh stattdessen.
#
# Run: ./scripts/deploy/tunnel-fixed-setup.sh

set -e

cd "$(dirname "$0")/../.."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared nicht gefunden. Installieren: brew install cloudflared"
  exit 1
fi

echo "🛠 Faktivo — Feste Tunnel-URL einrichten"
echo ""
echo "Was du brauchst:"
echo "  1. Cloudflare-Account (free): https://dash.cloudflare.com/sign-up"
echo "  2. Eine Domain bei Cloudflare oder zu Cloudflare migriert (free Plan reicht)"
echo "     z.B. 'kolos.digital' oder 'faktivo.de'"
echo ""
read -p "Hast du Domain bei Cloudflare? (y/N): " has_domain
if [ "$has_domain" != "y" ]; then
  echo ""
  echo "💡 Ohne eigene Domain → benutze tunnel-quick.sh (random URL)."
  echo "   Migration zu Cloudflare: https://developers.cloudflare.com/dns/zone-setups/full-setup/"
  exit 0
fi

read -p "Deine Domain (z.B. kolos.digital): " domain
read -p "Subdomain für Faktivo (z.B. app oder faktivo): " sub
hostname="${sub}.${domain}"

echo ""
echo "1. Login zu Cloudflare (browser öffnet sich) ..."
cloudflared login

echo ""
echo "2. Tunnel anlegen ..."
tunnel_name="faktivo-$(whoami)"
cloudflared tunnel create "$tunnel_name"

# Find tunnel UUID
tunnel_uuid=$(cloudflared tunnel list -o json | jq -r ".[] | select(.name==\"$tunnel_name\") | .id")
if [ -z "$tunnel_uuid" ]; then
  echo "❌ Konnte Tunnel-UUID nicht ermitteln."
  exit 1
fi

echo ""
echo "3. DNS-Record für $hostname → Tunnel anlegen ..."
cloudflared tunnel route dns "$tunnel_name" "$hostname"

echo ""
echo "4. Config-Datei schreiben ..."
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $tunnel_uuid
credentials-file: $HOME/.cloudflared/$tunnel_uuid.json

ingress:
  - hostname: $hostname
    service: http://localhost:3000
  - service: http_status:404
EOF

echo ""
echo "✅ Setup fertig!"
echo ""
echo "Tunnel starten: cloudflared tunnel run $tunnel_name"
echo "Oder: ./scripts/deploy/tunnel-fixed-run.sh"
echo ""
echo "Dann ist Faktivo erreichbar unter: https://$hostname"
echo ""
echo "💡 Tipp: in den NEXT_PUBLIC_APP_URL .env.local eintragen:"
echo "   NEXT_PUBLIC_APP_URL=https://$hostname"
