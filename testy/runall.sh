#!/bin/bash
# Výstup každé sady se ukládá, aby po pádu bylo vidět KTERÉ tvrzení padlo.
# Stejná složka jako fixtures (KAL_DIR, jinak temp) — viz prostredi.js.
# Cestu si vezmeme přímo z prostredi.js, ať se logy a fixtures nerozejdou.
LOGY="$(node -e "process.stdout.write(require('./prostredi').DIR)")/logy"
mkdir -p "$LOGY"
PASS=0; FAIL=0; FAILED=""
for t in audit.js audit2.js test.js test2.js test3.js test4.js test5.js test6.js test7.js test8.js \
         test9.js test10.js test11.js test12.js test13.js test14.js test15.js test16.js test17.js \
         test18.js test19.js test21.js test22.js test23.js test24.js test25.js test26.js \
         test27.js test28.js test29.js test30.js test32.js test33.js test34.js test35.js test36.js test37.js test38.js \
         test39.js test40.js test41.js test42.js test43.js test44.js test45.js test46.js test47.js test48.js test49.js test50.js test51.js test52.js test53.js test54.js test55.js test56.js test57.js test58.js test59.js test60.js test61.js test62.js test63.js test64.js test65.js test66.js; do
  [ -f "$t" ] || continue
  OUT=$(node "$t" 2>&1); KOD=$?
  echo "$OUT" > "$LOGY/$t.log"
  # Nenulový návratový kód je pád i bez známé hlášky — spadlý test (třeba na
  # TypeError v evaluate) se dřív počítal jako úspěšný, protože se hledaly jen vzory.
  if [ "$KOD" -ne 0 ] || echo "$OUT" | grep -qE "TimeoutError|PAGEERROR|MODULE_NOT_FOUND|NEPROŠLO: [1-9]|^Error:"; then
    FAIL=$((FAIL+1)); FAILED="$FAILED $t"
    printf "  ✗ %-12s %s\n" "$t" "$(echo "$OUT" | grep -oE 'TimeoutError|PAGEERROR.*|NEPROŠLO: [0-9]+' | head -1)${KOD:+ (kód $KOD)}"
    # rovnou ukaz, ktera tvrzeni padla — jinak je z pouheho poctu videt houby
    echo "$OUT" | grep -E "^  ✗|TimeoutError|PAGEERROR" | head -5 | sed 's/^/      /'
  else
    PASS=$((PASS+1)); printf "  ✓ %-12s\n" "$t"
  fi
done
echo "════════════════════════"
echo "PROŠLO: $PASS   SELHALO: $FAIL"
[ -n "$FAILED" ] && echo "selhalo:$FAILED"
echo "úplné výstupy: $LOGY"
# Návratový kód, aby se dalo spolehnout na výsledek i bez čtení výpisu (CI).
[ "$FAIL" -eq 0 ] || exit 1
exit 0
