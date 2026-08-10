# Regresní testy

57 sad Playwright testů proti skutečné aplikaci. Testy mockují Open Food Facts,
takže **neposílají žádný dotaz ven** — limit 10 dotazů/min/IP se jimi nedá vyčerpat.

## Jednorázová příprava

```bash
npm install                    # z kořene repa; verze jsou v package.json
python testy/make-fixtures.py
```

`make-fixtures.py` vygeneruje tři soubory, které si testy nedokážou vyrobit samy:
`alco.bin` (záloha AlcoDroidu), `nutri.csv` (export NutriDatabáze, 1136 položek)
a `bc.y4m` (video s čárovým kódem pro falešnou kameru).

Prohlížeč se stahovat nemusí — `prostredi.js` si najde Chrome, Edge nebo Chromium
v systému. Pokud žádný nenajde, sáhne Playwright po vlastním; ten se doinstaluje
příkazem `npx playwright install chromium`.

## Spuštění

Aplikace musí běžet na `http://127.0.0.1:8811` — testy chodí proti serveru,
ne proti `file://`, protože service worker a IndexedDB potřebují origin.

```bash
python -m http.server 8811 --bind 127.0.0.1
```

V druhém terminálu, ze složky `testy/`:

```bash
bash runall.sh
```

Trvá zhruba 20 minut. Jednotlivou sadu spustíš přes `node test42.js`.

## Kde co leží

`prostredi.js` drží obě cesty, které se liší stroj od stroje:

| proměnná | co je | výchozí |
|---|---|---|
| `KAL_CHROME` | cesta k prohlížeči | najde se Chrome / Edge / Chromium |
| `KAL_DIR` | složka pro fixtures a snímky obrazovky | `<temp>/kalorie-testy` |

Stejnou složku používá i `make-fixtures.py`, takže když přepíšeš `KAL_DIR`,
nastav ho pro obojí.

## Co při psaní testů překvapí

- **Nastavení jsou rozdělená do tří skupin** (Já · Propojení · Data) a cokoli mimo
  zvolenou skupinu je skryté, takže `click`/`fill` selže. Nejdřív
  `await p.evaluate(() => setSetMode('prop'))` nebo `'data'`.
- **Testy běží bez API klíče.** V panelu Popsat je proto ruční cesta (`#rucniCesta`)
  rozbalená — s klíčem by byla sbalená.
- **Konzolové `ERR_FAILED` nemusí být závada.** Několik sad schválně shazuje požadavky
  na Open Food Facts (`route(…, r => r.abort())`), aby ověřily chování offline.
- **Testy nesmí chodit na internet.** Mockuje se jen to, co čekáme; když aplikace složí
  adresu jinak (třeba `api.github.com/repos//contents/…` při prázdném repozitáři), vzor
  se netrefí a Playwright požadavek pustí ven — výsledek pak závisí na kvalitě připojení.
  Použij `PROSTREDI.blokujVenek(ctx)` a **registruj ji jako první**: v Playwrightu má
  přednost naposledy přidaná routa, takže záchytná musí přijít před konkrétními.
- **Aplikace slaďuje i sama od sebe.** Kromě časovače (`syLater`) spouští kolo `onfocus`
  (>30 s od posledního sladění), `visibilitychange` (>60 s) a `setInterval` (jednou za
  dvě minuty) — první dva **okamžitě**, takže se nedají zrušit `clearTimeout`. Kdo počítá
  přesné počty commitů, ať zakládá zařízení jako čerstvě sladěné (`last: Date.now()`),
  jinak mu do měření vleze kolo navíc. Tohle byla příčina nestability `test50.js`.
- **Vratký test neopravuj prodloužením čekání.** Zjisti, co ho rozhazuje, a udělej ho
  deterministickým — zpomal mock, zastav samovolné dění, počkej na podmínku. A ověř, že
  na rozbité verzi opravdu padá; jinak nic nedokazuje.
- `runall.sh` hlásí pád na nenulovém návratovém kódu nebo na `TimeoutError`,
  `PAGEERROR`, `MODULE_NOT_FOUND`, `NEPROŠLO: [1-9]` či `Error:` na začátku řádku.
  Test, který jen tiše vypíše nesmysl, pořád projde — proto každý test končí
  kontrolou a slovem `NEPROŠLO`. Kontrola kódu tam přibyla poté, co se ukázalo,
  že šest testů havarovalo hned při načtení a skript je počítal jako úspěšné.
- **Neuvěř zelené regresi, dokud nevidíš test spadnout.** U každé nové sady ověř,
  že na neopravené verzi opravdu padá. Právě tím se zjistilo, že se testy tváří
  jako projité, i když se vůbec nespustí.
