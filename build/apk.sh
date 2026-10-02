#!/usr/bin/env bash
# Postaví obě APK — osobní a veřejnou — jako samostatné aplikace (Capacitor).
#
#   KS_B64=… KS_PASS=… bash build/apk.sh
#
# Běží v GitHub Actions (.github/workflows/apk.yml). Lokálně ne: na Huanově počítači
# chybí Android SDK a Java je jen 8, Capacitor chce 21.
#
# Podpisový klíč přichází z tajemství repozitáře. Do repozitáře ani do výstupu se
# nesmí dostat — repozitář je veřejný. Originál klíče má Huan mimo repozitář ve
# složce podpisovy-klic; bez něj nejde vydat aktualizaci, která se nainstaluje
# přes starou verzi.
set -euo pipefail

KOREN="$(cd "$(dirname "$0")/.." && pwd)"
V=$(grep -o "APP_VERSION = '[^']*'" "$KOREN/index.html" | head -1 | cut -d"'" -f2)
KOD=$((10#${V##*-}))                      # 2026.10.01-114 → 114, musí s každým vydáním růst
VYSTUP="$KOREN/vystup"
mkdir -p "$VYSTUP"
KLIC="$(mktemp -d)/kalorie-podpis.p12"
echo "$KS_B64" | base64 -d > "$KLIC"
trap 'rm -f "$KLIC"' EXIT
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)
echo "Verze $V (versionCode $KOD), build-tools $(basename "$BT")"

postav() {
  local VAR=$1 ID=$2 NAZEV=$3
  local D="$RUNNER_TEMP/apk-$VAR"
  rm -rf "$D"; mkdir -p "$D/www"
  echo "::group::$NAZEV ($ID)"

  # --- webové soubory: veřejná podoba přes stejný skript jako web ---
  if [ "$VAR" = verejna ]; then
    python3 "$KOREN/build/verejna.py" "$D/www"
  else
    for f in index.html sw.js manifest.json zxing.js zaklad.js jidla.js katalog.json; do
      cp "$KOREN/$f" "$D/www/"
    done
  fi

  cd "$D"
  echo "{ \"name\": \"kalorie-$VAR\", \"private\": true }" > package.json
  npm i --no-audit --no-fund \
    @capacitor/core @capacitor/cli @capacitor/android \
    @capacitor/filesystem @capacitor/share @capacitor/app

  # Most do nativních doplňků. Bez balíčkovače není jisté, že je Capacitor.Plugins
  # naplněné, proto jde do stránky i jádro Capacitoru (nativniPlugin zkusí obojí).
  if [ -f node_modules/@capacitor/core/dist/capacitor.js ]; then
    cp node_modules/@capacitor/core/dist/capacitor.js www/
    python3 - <<'PY'
import io
p = 'www/index.html'
s = io.open(p, encoding='utf-8').read()
s = s.replace('<script src="zaklad.js"></script>',
              '<script src="capacitor.js"></script>\n<script src="zaklad.js"></script>', 1)
io.open(p, 'w', encoding='utf-8').write(s)
PY
  fi

  # loggingBehavior production: jinak Capacitor ve vydávané verzi nepouští výpis z konzole
  # do logu Androidu a zkouška na emulátoru nemá jak ověřit, že most žije. Aplikace do
  # konzole vypisuje jen kontrolní řádek KALORIE_NATIVNI, nic citlivého.
  #
  # Lišty Androidu: od Androidu 15 kreslí aplikace pod stavovou lištu i pod gesta
  # (edge-to-edge, targetSdk 36). Co je pod lištami, obarví Capacitor barvou pozadí
  # okna ze systémového motivu — v tmavém režimu černou, ve světlém bílou — a to
  # kolem aplikace vypadalo jako rámeček. SystemBars proto dostane:
  #   style DARK  = světlé ikony na liště, aplikace je tmavá i při světlém motivu
  #   initialViewportFitValueHint cover = stránka má viewport-fit=cover, ať lišty
  #     od prvního snímku propustí stránku a nečekají na její načtení
  # a pozadí okna (styles.xml níže) je pozadí aplikace pro případ, že WebView je
  # starší než 140 a Capacitor místo propuštění odsadí okraje.
  cat > capacitor.config.json <<EOF
{ "appId": "$ID", "appName": "$NAZEV", "webDir": "www",
  "loggingBehavior": "production",
  "android": { "backgroundColor": "#0e1116" },
  "plugins": { "SystemBars": { "style": "DARK", "initialViewportFitValueHint": "cover" } } }
EOF
  npx cap add android
  npx cap sync android

  # --- ikona z manifestu webové aplikace ---
  python3 "$KOREN/build/apk-ikony.py" "$D/www/manifest.json" "$D/android/app/src/main/res"

  # --- pozadí okna = pozadí aplikace (--bg v index.html), viz SystemBars výše ---
  cat > android/app/src/main/res/values/kalorie.xml <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources><color name="kalorie_pozadi">#0E1116</color></resources>
EOF
  python3 - <<'PY2'
import io
p = 'android/app/src/main/res/values/styles.xml'
s = io.open(p, encoding='utf-8').read()
znacka = '<item name="android:background">@null</item>'
assert znacka in s, 'šablona Capacitoru změnila styles.xml'
s = s.replace(znacka, znacka + '\n        <item name="android:windowBackground">@color/kalorie_pozadi</item>', 1)
io.open(p, 'w', encoding='utf-8').write(s)
PY2

  # --- kamera pro čtečku čárových kódů a focení ---
  python3 - <<'PY'
import io
p = 'android/app/src/main/AndroidManifest.xml'
s = io.open(p, encoding='utf-8').read()
if 'android.permission.CAMERA' not in s:
    s = s.replace('<uses-permission android:name="android.permission.INTERNET" />',
                  '<uses-permission android:name="android.permission.INTERNET" />\n'
                  '    <uses-permission android:name="android.permission.CAMERA" />\n'
                  '    <uses-feature android:name="android.hardware.camera" android:required="false" />', 1)
io.open(p, 'w', encoding='utf-8').write(s)
PY

  # --- verze ---
  sed -i "s/versionCode [0-9]*/versionCode $KOD/; s/versionName \"[^\"]*\"/versionName \"$V\"/" android/app/build.gradle
  grep -E "versionCode|versionName|applicationId" android/app/build.gradle

  # Stažení Gradlu z GitHubu občas skončí chybou 500 na jejich straně (první stavba
  # v114 na tom spadla). Přechodný výpadek se zkusí ještě dvakrát.
  local pokus
  for pokus in 1 2 3; do
    (cd android && ./gradlew assembleRelease --no-daemon --console=plain) && break
    [ "$pokus" = 3 ] && { echo "✗ Gradle selhal třikrát"; exit 1; }
    echo "Gradle selhal (pokus $pokus), zkouším znovu za 20 s…"; sleep 20
  done

  local U=android/app/build/outputs/apk/release/app-release-unsigned.apk
  local Z="$RUNNER_TEMP/zarovnane-$VAR.apk"
  "$BT/zipalign" -f -p 4 "$U" "$Z"
  "$BT/apksigner" sign --ks "$KLIC" --ks-pass env:KS_PASS --ks-key-alias kalorie \
    --key-pass env:KS_PASS --out "$VYSTUP/kalorie-$VAR-$V.apk" "$Z"
  "$BT/apksigner" verify --print-certs "$VYSTUP/kalorie-$VAR-$V.apk" | grep -i "sha-256" || true
  cd "$KOREN"
  echo "::endgroup::"
}

postav osobni  cz.huancraven.kalorie      "Kalorie"
postav verejna cz.huancraven.kalorie.lite "Kalorie lite"
ls -la "$VYSTUP"
