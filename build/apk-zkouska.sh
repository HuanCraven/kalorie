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
  adb install -r "$APK" || { echo "✗ instalace selhala"; chyba=1; echo "::endgroup::"; return; }
  adb logcat -c
  adb shell am start -n "$ID/.MainActivity"
  sleep 30
  adb logcat -d > "log-$VAR.txt"
  local znacka
  znacka=$(grep -o "KALORIE_NATIVNI.*" "log-$VAR.txt" | head -1)
  echo "značka: ${znacka:-žádná}"
  if ! echo "$znacka" | grep -q "pluginy=Filesystem,Share,App"; then
    echo "✗ $ID: most nebo doplňky nežijí"; chyba=1
  fi
  if ! echo "$znacka" | grep -q " $VAR "; then
    echo "✗ $ID: běží jiná podoba aplikace, než měla"; chyba=1
  fi
  if grep -E "Capacitor/Console.*(Uncaught|TypeError|ReferenceError|SyntaxError)" "log-$VAR.txt"; then
    echo "✗ $ID: chyba JavaScriptu"; chyba=1
  fi
  adb shell screencap -p "/sdcard/snimek-$VAR.png" && adb pull "/sdcard/snimek-$VAR.png" . || true
  echo "::endgroup::"
}

zkus vystup/kalorie-osobni-*.apk  cz.huancraven.kalorie      osobni
zkus vystup/kalorie-verejna-*.apk cz.huancraven.kalorie.lite verejna
exit $chyba
