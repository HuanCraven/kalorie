#!/usr/bin/env bash
# Zkouška APK na emulátoru Androidu (volá se z .github/workflows/apk.yml).
#
# Testy v prohlížeči Capacitor jen napodobují. Tady se aplikace opravdu nainstaluje,
# spustí a z logu se přečte řádek KALORIE_NATIVNI, který vypíše nativniStart():
# potvrdí, že most do Androidu funguje a všechny tři doplňky jsou k dispozici.
# Bez té značky, nebo s chybou JavaScriptu v logu, zkouška selže a nic se nevydá.
set -uo pipefail
cd "$(dirname "$0")/.."
chyba=0

zkus() {
  local APK=$1 ID=$2 VAR=$3
  echo "::group::$ID"
  adb install -r "$APK" || { echo "::error::✗ instalace selhala"; chyba=1; echo "::endgroup::"; return; }
  adb logcat -c
  adb shell am start -n "$ID/.MainActivity"
  sleep 30
  adb logcat -d > "log-$VAR.txt"
  local znacka
  znacka=$(grep -o "KALORIE_NATIVNI.*" "log-$VAR.txt" | head -1)
  echo "značka: ${znacka:-žádná}"
  if ! echo "$znacka" | grep -q "pluginy=Filesystem,Share,App"; then
    echo "::error::✗ $ID: most nebo doplňky nežijí (značka: ${znacka:-žádná})"; chyba=1
  fi
  if ! echo "$znacka" | grep -q " $VAR "; then
    echo "::error::✗ $ID: běží jiná podoba aplikace, než měla"; chyba=1
  fi
  local jsChyba
  # Výjimka: Capacitor 8 na Androidu 15+ vkládá --safe-area-inset-* i do prázdné
  # stránky před načtením aplikace (document.documentElement je null). Chybu si sám
  # chytí a po načtení vloží proměnné znovu — s aplikací nesouvisí.
  jsChyba=$(grep -E "Capacitor/Console.*(Uncaught|TypeError|ReferenceError|SyntaxError)" "log-$VAR.txt" |
    grep -v "Error injecting safe area CSS" | head -3)
  if [ -n "$jsChyba" ]; then
    echo "$jsChyba"
    # celé znění do anotace — log běhu se ne vždy dá stáhnout
    echo "::error::✗ $ID: chyba JavaScriptu: $(echo "$jsChyba" | tr '\n' ' ' | cut -c1-900)"; chyba=1
  fi
  adb shell screencap -p "/sdcard/snimek-$VAR.png" && adb pull "/sdcard/snimek-$VAR.png" . || true
  # Pod stavovou lištou i pod gesty musí být barva aplikace, ne černý (bílý) rámeček
  # z motivu Androidu. Jen u osobní podoby: veřejná při prvním spuštění ukáže
  # průvodce a jeho ztmavení legitimně ztmaví i lišty.
  if [ "$VAR" = osobni ]; then
    if [ -f "snimek-$VAR.png" ]; then
      python3 build/apk-listy.py "snimek-$VAR.png" || chyba=1
    else
      echo "::error::✗ $ID: chybí snímek obrazovky, lišty nejde ověřit"; chyba=1
    fi
  fi
  echo "::endgroup::"
}

zkus vystup/kalorie-osobni-*.apk  cz.huancraven.kalorie      osobni
zkus vystup/kalorie-verejna-*.apk cz.huancraven.kalorie.lite verejna
exit $chyba
