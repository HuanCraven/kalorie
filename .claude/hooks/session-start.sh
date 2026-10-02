#!/bin/bash
# Příprava cloudové session (Claude Code na webu): závislosti, fixtures a server
# na 8811, aby šla rovnou pustit regrese (cd testy && bash runall.sh).
# Lokálně (Windows) nedělá nic — tam se postupuje podle testy/README.md.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"

# Chromium je v kontejneru předinstalované (/opt/pw-browsers), nestahovat znovu
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install --no-audit --no-fund --loglevel=error

python3 testy/make-fixtures.py > /dev/null

# Server se do mezipaměti kontejneru neuloží — spouští se při každém startu
if ! curl -sf -o /dev/null http://127.0.0.1:8811/index.html; then
  setsid nohup python3 -m http.server 8811 --bind 127.0.0.1 > /tmp/kalorie-server.log 2>&1 < /dev/null &
  for i in $(seq 1 20); do
    curl -sf -o /dev/null http://127.0.0.1:8811/index.html && break
    sleep 0.5
  done
fi
