---
name: kalorie-projekt
description: Pravidla a kontext projektu Kalorie — offline-first PWA pro sledování jídla a alkoholu (repozitář HuanCraven/kalorie, GitHub Pages). Použij tento skill VŽDY, když uživatel zmíní aplikaci Kalorie, počítání kalorií/alkoholu, soubory index.html/sw.js/zaklad.js/jidla.js/receptury.js z tohoto projektu, přidávání jídel či surovin do databáze, čtení snímků z hodinek Zepp, zmíní repozitář HuanCraven/kalorie nebo nasazení na GitHub Pages. Obsahuje závazná pravidla verzování, buildu a testů, která se musí dodržet při každé změně.
---

# Projekt Kalorie — pravidla práce

Offline-first PWA pro sledování jídla a alkoholu. Nahrazuje Kalorické tabulky a AlcoDroid.
Běží na GitHub Pages: <https://huancraven.github.io/kalorie/>, repozitář `HuanCraven/kalorie`.
Data uživatele žijí jen v telefonu (IndexedDB `kaltrack`), nikam se neposílají.
Uživatel píše česky — odpovídej česky, stroze a přesně.

## Kde vzít aktuální kód

Skill kód neobsahuje. **Zdrojem pravdy je git**, ne zipy:

```bash
git clone https://github.com/HuanCraven/kalorie.git
```

Nejdřív si přečti `PREDANI.md` v repu — má aktuální stav a novinky po verzích
i s odůvodněním, **proč** se co rozhodlo. Starší zipy `kalorie-projekt-vNN.zip`
jsou archiv, nové se nevytvářejí.

`gh` bývá přihlášené jako HuanCraven s právem `repo`, takže commit a push zvládneš
sám — uživatel o to stojí, šetří mu to klikání. **Push na `main` je nasazení**
(Pages servírují kořen větve), takže před pushem musí projít regrese.

## Soubory v repozitáři

| soubor | co je | edituje se ručně? |
|---|---|---|
| `index.html` | celá aplikace (HTML+CSS+JS v jednom, ~6600 řádků) | ano |
| `sw.js` | service worker, cache `kaltrack-vNN` | ano |
| `manifest.json` | PWA manifest, ikony a zkratky jako data URI | zřídka |
| `zaklad.js` | základní suroviny (`window.ZAKLAD`, klíče n/k/e/p/c/f/v/s na 100 g) | ano |
| `jidla.js` | hotová jídla (`window.JIDLA`) | **NE — generuje se** |
| `zxing.js` | bundlovaná čtečka čárových kódů | ne |
| `build/receptury.js` | receptury: `{n, k, w, sur:[[název,g],…], odkap?}` | ano |
| `build/extra.js` | suroviny chybějící v zaklad.js | ano |
| `build/build-jidla.js` | generátor jidla.js (Atwater, výtěžnost) | zřídka |
| `build/ikony-zkratek.py` | generátor ikon pro zkratky v manifest.json | zřídka |
| `build/off-export.js` | z hromadného exportu Open Food Facts vytáhne české produkty | zřídka |
| `build/off-cz.js` | totéž přes API — jen na malé výběry, server hromadné odmítá | zřídka |
| `testy/` | 71 sad Playwright testů + `runall.sh` + `make-fixtures.py` | ano |
| `testy/prostredi.js` | najde prohlížeč a složku pro fixtures (`KAL_CHROME`, `KAL_DIR`) | zřídka |
| `PREDANI.md` | aktuální stav projektu a novinky po verzích | ano |
| `README.md` | uživatelská dokumentace | ano |
| `.gitattributes` | `* -text` — žádné převádění konců řádků | ne |

## Závazná pravidla (porušení = rozbitá aplikace)

1. **Každá změna `index.html`** → zvyš `APP_VERSION` (formát `RRRR.MM.DD-NN`)
   **a zároveň** číslo cache v `sw.js` (`kaltrack-vNN`). Jinak telefon drží starou verzi.
   CI shodu obou čísel kontroluje.
2. **`jidla.js` nikdy needituj ručně.** Uprav `build/receptury.js` (příp. `build/extra.js`)
   a spusť `node build/build-jidla.js`. Skript hlásí neznámé suroviny, nemožnou
   výtěžnost a nesoulad energie se živinami (Atwater 4/4/9 + vláknina 2, tolerance 12 %).
3. **Před nasazením (= před pushem na `main`) regrese**: `bash runall.sh` v `testy/`,
   71 sad, ~20 minut. Aplikace musí běžet na `http://127.0.0.1:8811`
   (`python -m http.server 8811 --bind 127.0.0.1` z kořene repa) — ne přes `file://`,
   service worker a IndexedDB potřebují origin. Testy mockují Open Food Facts
   i Claude API, takže neposílají dotazy ven. Jednorázová příprava v novém prostředí:
   `npm install` a `python testy/make-fixtures.py`.
   Regrese běží i v GitHub Actions při každém pushi na `main`.
   Podrobnosti a pasti při psaní testů v `testy/README.md`.
4. **Open Food Facts: limit 10 dotazů/min/IP.** Aplikace má vlastní hlídač (6/min)
   a 24h cache odpovědí. Nikdy nezaváděj našeptávání (search-as-you-type) proti OFF —
   vede k zablokování IP. Online dotaz jen po stisku Hledat.
5. **Cizí databáze potravin** (NutriDatabáze, Open Food Facts) se importují jen
   do telefonu — do repozitáře nepatří, nesynchronizují se a nejsou v záloze.
6. Žádný `eval` ani `document.write`; texty z OFF a z odpovědí Claude escapovat (`esc()`),
   ID sanitizovat (`sid()`) — obrana proti podvržené záloze.

## Jednotící pravidla (sjednoceno ve v87–v90)

Aplikace vede **jednu denní řadu** — co jsem přijal, co vydal, co to udělalo s váhou
a se zdravím. Všechno ostatní je pohled na tuhle řadu skrz jedno zvolené okno.
Kdo to poruší, rozdrobí ji zpátky.

- **`denniRada(days, konec, zdroj)` je jediné místo**, kde se z databáze skládá
  „den po dni". `zdrojDnu()` načte `log`, `daily` a cvičení jednou a dá se sdílet.
  `statsData` i `alcStats` staví z ní.
- **`logged` = den má zápis a není označený jako nekompletní.** Podle něj se filtruje
  příjem, výdej, bilance a makra.
- **`alc` se nefiltruje NIKDY.** Počítá se i z nekompletních dnů a den bez zápisu je
  nula, ne chybějící údaj. Uživatel si alkohol hlídá vždycky, jídlo ne — je to vědomá
  výjimka, na které trval, a snadno se setře.
- **Jedno období (`period`) pro celou aplikaci**, přepínatelné na Statistikách
  i na Alkoholu. Pevná okna zůstávají jen tam, kde odpovídají na jinou otázku
  (kalendářní měsíc, „od začátku měření", limit jako 30denní průměr) — a mají to
  napsané v popisku.
- **Do `daily` se zapisuje výhradně přes `zapisDen(datum, vlastnik, hodnoty)`.**
  `DEN_POLE` drží dva seznamy: `uzivatel` (total, burn, weight, neuplny) a `hodinky`
  (total, kroky, tep, hrv, spanek, hluboky, rem, skore). Pole, o kterém volající mlčí,
  zůstane nedotčené. Neznámý vlastník vyhodí chybu. Přidáváš-li do dne údaj, zapiš ho
  do jednoho z těch seznamů, jinak se neuloží.
- **`maloDat(co, chybi)`** je jediná podoba hlášky „ještě nemám dost dat". Prahy se
  sjednocovat nemají (víkendová karta potřebuje jiný počet dnů než křivka), jejich
  vyjádření ano. Není-li k tématu ani jeden údaj, karta se neukáže; je-li něco, ale
  málo, karta se ukáže s hláškou.

## Doménová logika (neměnit bez rozmyslu)

- **Výdej dne** počítá `vydejDne(dd, wk)`: je-li zadaný **celkový výdej z hodinek**
  (`daily.total`), platí on a **nic se k němu nepřičítá** — má v sobě klid i pohyb.
  Jinak klidový výdej + aktivní kcal + zapsaná cvičení.
- **Dynamické cíle**: bílkoviny 2,0 g/kg a tuky 0,9 g/kg podle hmotnosti;
  energie = výdej dne − deficit; sacharidy dopočítávají zbytek.
- **Alkohol**: gramy čistého etanolu = `ml × %obj. × 0,789`; kcal = `g × 7,1 + sacharidy × 4`.
  **Limit je klouzavý 30denní průměr**, ne týdenní součet.
- **Reálný výdej** se dopočítává ze změny váhy (7700 kcal/kg) při vážení rozložených
  přes ≥ 10 dní a aspoň 60 % zapsaných dnů v tom úseku.
- **Hotová jídla se počítají ze surovin** (právní důvod — neopisují se z cizích databází).
- Hodnoty potravin vždy **na 100 g/ml**, hotová jídla na 100 g hotového pokrmu.

## Čtení obrázků přes Claude API (jediná cesta)

Ruční posílání do chatu bylo zrušeno ve v67 — uživatel používá výhradně API klíč
uložený v aplikaci. Tři zadání v `index.html`, formát odpovědi je závazný:

| zadání | k čemu | zvláštnosti |
|---|---|---|
| `AI_PROMPT` | jídlo z věty, fotky talíře, nebo obojího | výsledek jdou položky do deníku |
| `LABEL_PROMPT` | nová potravina z tabulky, obalu nebo popisu | `zdroj` říká, jak se k číslům došlo |
| `CVICENI_PROMPT` | snímek hodinek Zepp | model **opisuje řádky**, přiřazuje kód |

Poučení, která se draze zaplatila a nemají se vracet:

- **Nečitelnou předlohu nesmí model dohadovat.** `zdroj:"necitelne"` → nevyplní se nic.
  Kdysi z fotky šunky vyšla čokoláda; špatná potravina je horší než žádná.
- **Klíče v JSON mají plné názvy živin** (`bilkoviny`, `tuky`), ne `b`/`t` — v pořadí
  české tabulky model prohazoval bílkoviny s tuky. K tomu kontrola Atwaterem.
- **U snímku hodinek model jen opisuje** seznam do pole `radky`; přiřazení k polím
  dělá `zpracujFitFoto`. Tři pokusy zpřesňovat zadání selhaly — `KLIDOVÝ SRDEČNÍ TEP`
  a `VARIABILITA TEPOVÉ FREKVENCE` jsou sousední řádky se slovem „tep" a model si je
  slil. Rozhodování patří do kódu, kde jde otestovat.
- **Datum ze snímku se ověřuje** (`rozumneDatum`: ne budoucnost, ne víc než 60 dní zpět).
  Zepp ukazuje datum bez roku, model si ho domýšlel a zápis skončil o rok vedle.

## Struktura stránek

- **Hlavní** — den, bilance, alkohol. Položky mají zaškrtávátka (přesun mezi chody,
  kopie na jiný den), chody jdou sbalit.
- **Zadat** — jen zápis dnešního jídla: Časté (z deníku, po chodech), Hledat, Popsat.
- **Alkohol**, **Pohyb** (snímek hodinek, cvičení), **Statistiky** (lišta kotev,
  klikatelné postřehy), **Jídla** (databáze + Recept + Přidat), **Nastavení**.

## Co vědomě chybí (nezavádět bez zadání)

- odhad promile v krvi
- import receptu z URL (CORS — aplikace nemá server)
- zrušení zástupných `productId` — prověřeno, třída chyb je uzavřená jinak
  (`neniPotravina`, `saveProduct`, `opravZastupnaId`); přepis všech řádků deníku
  by byl riskantní bez užitku

## Pracovní postup

1. Naklonuj repozitář (nebo `git pull`) a přečti `PREDANI.md`.
2. Proveď změny podle pravidel výše.
3. Změnily se receptury? Spusť `node build/build-jidla.js`.
4. Zvyš `APP_VERSION` a cache v `sw.js`, pokud se měnil `index.html`.
5. **Spusť celou regresi.** Padá-li test, nejdřív zjisti, jestli je chyba v aplikaci,
   nebo v testu — a spravuj to, co je opravdu rozbité. Test se nikdy neopravuje
   prodloužením čekání; udělej ho deterministickým (zpomal mock, počkej na doběhnutí).
   Nespoléhej na to, že test „prošel", když jsi jen počítal řádky s křížkem —
   **sleduj návratový kód**, sada může spadnout výjimkou.
6. Doplň novinky do `PREDANI.md` — co se změnilo **a proč**, ne výčet souborů.
7. Commituj a pushni na `main`, pak ověř, že Pages servírují novou verzi.

```bash
curl -s https://huancraven.github.io/kalorie/index.html | grep -o "APP_VERSION = '[^']*'"
```

Pages mají po pushi zpoždění zhruba minutu.
