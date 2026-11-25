#!/usr/bin/env bash
# Run the voting app and expose it with a free Cloudflare quick tunnel.
# Use this on a laptop tomorrow if cloud hosting is not ready yet.
set -euo pipefail
cd "$(dirname "$0")"
npm install --omit=dev
npm start &
APP_PID=$!
trap 'kill $APP_PID 2>/dev/null || true' EXIT
sleep 1
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  wait $APP_PID
  exit 1
fi
cloudflared tunnel --url "http://127.0.0.1:${PORT:-3000}"
