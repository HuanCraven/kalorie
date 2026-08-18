---
name: kalorie-projekt
description: Pravidla a kontext projektu Kalorie — offline-first PWA pro sledování jídla a alkoholu (repozitář HuanCraven/kalorie, GitHub Pages). Použij tento skill VŽDY, když uživatel zmíní aplikaci Kalorie, počítání kalorií/alkoholu, soubory index.html/sw.js/zaklad.js/jidla.js/receptury.js z tohoto projektu, přidávání jídel či surovin do databáze, zmíní repozitář HuanCraven/kalorie nebo nasazení na GitHub Pages, nebo pošle odkaz na složku s kalorie-projekt-*.zip. Obsahuje závazná pravidla verzování, buildu a testů, která se musí dodržet při každé změně.
---

# Projekt Kalorie — pravidla práce

Offline-first PWA pro sledování jídla a alkoholu. Nahrazuje Kalorické tabulky a AlcoDroid.
Běží na GitHub Pages: <https://huancraven.github.io/kalorie/>, repozitář `HuanCraven/kalorie`.
Data uživatele žijí jen v telefonu (IndexedDB `kaltrack`), nikam se neposílají.
Uživatel píše česky — odpovídej česky, stroze a přesně.

## Kde vzít aktuální kód

Skill kód neobsahuje. **Zdrojem pravdy je od 9. 8. 2026 git**, ne zipy —
repozitář obsahuje i `build/`, `testy/` a dokumentaci:

```bash
git clone https://github.com/HuanCraven/kalorie.git
```

Nejdřív si přečti `PREDANI.md` v repu (aktuální stav a novinky po verzích).

**Když máš nástroje** (Claude Code apod.): pracuj přímo v naklonovaném repu.
`gh` bývá přihlášené jako HuanCraven s právem `repo`, takže commit a push zvládneš sám —
uživatel o to stojí, šetří mu to klikání. **Push na `main` je nasazení**
(GitHub Pages servíruje kořen větve), takže před pushem musí projít regrese.

**Když nástroje nemáš** (běžný chat): uživatel přiloží `kalorie-projekt-vNN.zip`,
nebo je na Google Drive spolu s `PREDANI.md` a `kalorie-build-vNN.zip`.
Pracuj s nejvyšším NN a upravené soubory vrať k ručnímu nahrání.
Starší zipy jsou archiv — **nové se už nevytvářejí**.

## Soubory v repozitáři

| soubor | co je | edituje se ručně? |
|---|---|---|
| `index.html` | celá aplikace (HTML+CSS+JS v jednom, ~5400 řádků) | ano |
| `sw.js` | service worker, cache `kaltrack-vNN` | ano |
| `manifest.json` | PWA manifest, ikony a zkratky jako data URI | zřídka |
| `zaklad.js` | základní suroviny (`window.ZAKLAD`, klíče n/k/e/p/c/f/v/s na 100 g) | ano |
| `jidla.js` | hotová jídla (`window.JIDLA`) | **NE — generuje se** |
| `zxing.js` | bundlovaná čtečka čárových kódů | ne |
| `build/receptury.js` | receptury: `{n, k, w, sur:[[název,g],…], odkap?}` | ano |
| `build/extra.js` | suroviny chybějící v zaklad.js | ano |
| `build/build-jidla.js` | generátor jidla.js (Atwater, výtěžnost) | zřídka |
| `build/ikony-zkratek.py` | generátor ikon pro zkratky v manifest.json | zřídka |
| `build/off-export.js` | z hromadného exportu Open Food Facts vytáhne české produkty s kódy | zřídka |
| `build/off-cz.js` | totéž přes API — jen na malé výběry, server hromadné odmítá | zřídka |
| `testy/` | 63 sad Playwright testů + `runall.sh` + `make-fixtures.py` | ano |
| `testy/prostredi.js` | najde prohlížeč a složku pro fixtures (`KAL_CHROME`, `KAL_DIR`) | zřídka |
| `PREDANI.md` | aktuální stav projektu a novinky po verzích | ano |
| `README.md` | uživatelská dokumentace | ano |
| `.gitattributes` | `* -text` — žádné převádění konců řádků | ne |

## Závazná pravidla (porušení = rozbitá aplikace)

1. **Každá změna `index.html`** → zvyš `APP_VERSION` (formát `RRRR.MM.DD-NN`)
   **a zároveň** číslo cache v `sw.js` (`kaltrack-vNN`). Jinak telefon drží starou verzi.
2. **`jidla.js` nikdy needituj ručně.** Uprav `build/receptury.js` (příp. `build/extra.js`)
   a spusť `node build/build-jidla.js`. Skript hlásí neznámé suroviny, nemožnou
   výtěžnost a nesoulad energie se živinami (Atwater 4/4/9 + vláknina 2, tolerance 12 %).
3. **Před nasazením (= před pushem na `main`) regrese**: `bash runall.sh` v `testy/`,
   63 sad, ~20 minut. Aplikace musí běžet na `http://127.0.0.1:8811`
   (`python -m http.server 8811 --bind 127.0.0.1` z kořene repa) — ne přes `file://`,
   service worker a IndexedDB potřebují origin. Testy mockují Open Food Facts,
   takže neposílají dotazy ven. Jednorázová příprava v novém prostředí:
   `npm install` a `python testy/make-fixtures.py`.
   Regrese běží i v GitHub Actions při každém pushi na `main`
   (`.github/workflows/regrese.yml`); výpisy sad se ukládají jako artefakt.
   Prohlížeč si `prostredi.js` najde sám (Chrome/Edge/Chromium), stahovat se nemusí.
   Podrobnosti a pasti při psaní testů v `testy/README.md`.
4. **Open Food Facts: limit 10 dotazů/min/IP.** Aplikace má vlastní hlídač (6/min)
   a 24h cache odpovědí. Nikdy nezaváděj našeptávání (search-as-you-type) proti OFF —
   vede k zablokování IP. Online dotaz jen po stisku Hledat.
5. **Cizí databáze potravin** (NutriDatabáze, Open Food Facts) se importují jen
   do telefonu — do repozitáře nepatří, nesynchronizují se a nejsou v záloze.
   Jde jich načíst víc naráz; import nahradí jen databázi se stejným klíčem `zd`.
6. Žádný `eval` ani `document.write`; texty z OFF a z odpovědí Claude escapovat (`esc()`),
   ID sanitizovat (`sid()`) — obrana proti podvržené záloze.

## Jak přidat hotové jídlo

Do `build/receptury.js`:

```js
{ n:'Název jídla', k:'kategorie', w:1500, sur:[
  ['Hovězí přední',700],['Cibule',200],['Sůl',12],['Voda pitná',600]] },
```

- `sur` = suroviny **syrové**, v gramech, na celý hrnec; názvy musí přesně sedět
  se `zaklad.js` nebo `build/extra.js`, jinak build zahlásí chybu
- `w` = hmotnost hotového pokrmu po odpaření vody; `odkap:80` = slitý vypečený tuk (g)
- kategorie: polévky, omáčky a maso, smažená, bezmasá, saláty, pomazánky,
  studená kuchyně, moučníky
- pak `node build/build-jidla.js` → vznikne nové `jidla.js`; zvyš verzi (pravidlo 1)
  a commitni `build/receptury.js` i vygenerované `jidla.js` společně

## Doménová logika (neměnit bez rozmyslu)

- **Dynamické cíle**: bílkoviny 2,0 g/kg a tuky 0,9 g/kg podle hmotnosti;
  energie = klidový výdej + aktivní kcal − deficit; sacharidy dopočítávají zbytek.
- **Alkohol**: gramy čistého etanolu = `ml × %obj. × 0,789`; kcal = `g × 7,1 + sacharidy × 4`.
  **Limit je klouzavý 30denní průměr**, ne týdenní součet.
- **Bilance**: `příjem − (klidový výdej + aktivní kcal)`; reálný výdej se dopočítává
  ze změny váhy (7700 kcal/kg) při vážení rozložených přes ≥ 10 dní.
- **Hotová jídla se počítají ze surovin** (právní důvod — neopisují se z cizích databází).
- Hodnoty potravin vždy **na 100 g/ml**, hotová jídla na 100 g hotového pokrmu.

## Integrace s Claude (foto → JSON)

Aplikace parsuje odpovědi Claude na fotky jídla/etikety — formát je závazný,
definovaný v `AI_PROMPT` a `LABEL_PROMPT` v `index.html` a v `PROJEKT-INSTRUKCE.md`
(instrukce pro uživatelův Claude projekt). Při změně formátu uprav obojí + parser
(`tryJson`/`tryTable`/`tryLines`, resp. `processLabel`).
Sdílení fotky z Androidu vždy otevře nový chat mimo projekt — proto flow
„ulož fotku → otevři projekt → přilož ručně". Neměň to na přímé sdílení.

## Co vědomě chybí (nezavádět bez zadání)

- odhad promile v krvi
- import receptu z URL (CORS — aplikace nemá server)

## Pracovní postup

1. Naklonuj repozitář (nebo si ověř, že je aktuální: `git pull`) a přečti `PREDANI.md`.
2. Proveď změny podle pravidel výše.
3. Změnily se receptury? Spusť `node build/build-jidla.js`.
4. Zvyš `APP_VERSION` a cache v `sw.js`, pokud se měnil `index.html`.
5. **Spusť celou regresi.** Padá-li test, nejdřív zjisti, jestli je chyba
   v aplikaci, nebo v testu — a spravuj to, co je opravdu rozbité. Test se nikdy
   neopravuje prodloužením čekání; udělej ho deterministickým (např. zpomal mock).
6. Doplň novinky do `PREDANI.md`.
7. Commituj a pushni na `main`. Zprávu commitu piš česky: co se změnilo **a proč**,
   ne výčet souborů. Pak ověř, že Pages servírují novou verzi.

Nasazenou verzi ověříš takhle:

```bash
curl -s https://huancraven.github.io/kalorie/index.html | grep -o "APP_VERSION = '[^']*'"
```

Pages mají po pushi zpoždění zhruba minutu.
