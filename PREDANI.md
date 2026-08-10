# Předání projektu — aplikace Kalorie

Tenhle soubor slouží k tomu, abys mohl práci kdykoli obnovit v **novém chatu**,
kde Claude nezná historii. Napiš, co chceš dělat; zdrojáky si Claude Code vezme
z repozitáře (`git clone https://github.com/HuanCraven/kalorie.git`).

> **Od 9. 8. 2026 je celý projekt v gitu, ne v zipech.** Repozitář kromě nasazovaných
> souborů obsahuje i `build/`, `testy/` a dokumentaci — všechno má historii a dá se
> vrátit. Zipy `kalorie-projekt-vNN.zip` už není potřeba vytvářet; starší zůstávají
> jako archiv. Podrobnosti v sekci **Vývojové prostředí** níže.

## Co to je

Offline-first PWA pro sledování jídla a alkoholu. Nahrazuje Kalorické tabulky
i AlcoDroid. Běží na GitHub Pages: <https://huancraven.github.io/kalorie/>
Repozitář: `HuanCraven/kalorie`. Data žijí v telefonu (IndexedDB). Od v46 je lze volitelně
synchronizovat mezi zařízeními přes **jeden soubor v uživatelově privátním repozitáři** na
GitHubu — nikam jinam neodcházejí a dají se zašifrovat heslem.

Aktuální verze: **2026.08.10-65** (`APP_VERSION` v `index.html`, cache `kaltrack-v65` v `sw.js`).

### Novinky ve v65 — oprava: z vyfocené šunky vyšla čokoláda

**Zavlečeno v v61.** Do `LABEL_PROMPT` tehdy přibyla větev „není-li tabulka vidět, urči
výrobek podle obalu a hodnoty odhadni". Model ji ale použil i tehdy, když byla tabulka
jen **nečitelná** — a výrobek si prostě vymyslel. Uživatel vyfotil tabulku na šunce
a dostal čokoládu. Do v61 znělo zadání „jen přepiš, nic si nedomýšlej", takže špatná
fotka skončila nulami, ne cizí potravinou.

1. **Třetí možnost `zdroj: "necitelne"`.** Když Claude název na obalu bezpečně nepřečte,
   vrátí prázdno a `processLabel` **nevyplní nic** — jen řekne „Z fotky se to přečíst
   nedá". V zadání je to i výslovně: raději přiznat nečitelnost než vrátit špatný název,
   protože podle něj uživatel zapisuje, co snědl.
2. **Etiketa se posílá ve 1568 px a kvalitě 0,92** (`apiAsk(file, prompt, detail)`).
   Z 1024 px byl drobný tisk často nečitelný, takže se model do „hádací" větve dostával
   běžně. Fotka talíře zůstává na 1024 px, tam detail netřeba.
3. **Srovnání otočení fotky.** `shrinkPhoto` používá `createImageBitmap` s
   `imageOrientation: 'from-image'`; canvas dřív EXIF ignoroval a tabulka mohla dorazit
   na boku. Starší prohlížeče spadnou zpátky na původní cestu přes `Image`.

`PROJEKT-INSTRUKCE.md` srovnány se zadáním — ruční cesta přes uživatelův projekt
by se jinak rozešla s parserem. **Uživatel je musí v projektu nahradit.**

- testy `test61.js` rozšířeny: nečitelná fotka nevyplní název ani hodnoty, ukáže
  hlášku, neoznačí se jako odhad, a zadání obsahuje zákaz domýšlet si výrobek

### Novinky ve v64 — název databáze načtené starší verzí

Databáze naimportované před v63 nemají `zd` a hlásily se obecně jako **CSV**, takže
uživatel viděl „CSV · 1136" místo NutriDatabáze a myslel si, že je něco rozbité.
`extZdroje()` teď u takové skupiny odhadne název z pole `z` jednotlivých položek —
u NutriDatabáze je tam všude `NutriDatabaze.cz`.

**Bere se jen tehdy, když stejnou hodnotu má přes 90 % řádků.** U databáze s čárovými
kódy je totiž `z` **značka výrobce** a liší se položku od položky; bez té podmínky by
se celá databáze pojmenovala třeba „Hollandia". Obojí hlídá `test63.js`.

### Rozhodnuto: offline databáze se plní používáním

Plná databáze z Open Food Facts (~17 000 položek) se **dělat nebude**. Cesta přes API
je zablokovaná (viz níže) a export má 1,3 GB. Zůstává tedy:

- **online dotaz na jednotlivý kód** — funguje a je rychlý,
- **co se jednou naskenuje, uloží se natrvalo** mezi vlastní potraviny,
- **NutriDatabáze** pokrývá suroviny, u kterých se čárový kód stejně neskenuje.

Databáze se tak plní tím, co uživatel opravdu kupuje. Zaskřípe to jen v obchodě se
slabým signálem u výrobku kupovaného poprvé. Kdyby se to ukázalo jako časté, cesta
přes export 1,3 GB s lokálním filtrem je pořád otevřená.

**Pozor při ověřování importu:** testovat `parseExt(text)` voláním funkce nestačí —
uživateli neproběhl výběr souboru a chyba se hledala jinde. Test má sahat na
`setInputFiles('#extFile', …)`, tedy na tutéž cestu, kterou chodí uživatel.

### Novinky ve v62–63 — databáze s čárovými kódy

Vestavěné databáze čárové kódy nemají (`zaklad.js` 294 surovin, `jidla.js` 95 jídel).
Skenování dosud stálo jen na tom, co si uživatel uložil, plus živý dotaz do Open Food
Facts. Navíc **import externí databáze sloupec s kódem vůbec nečetl**.

**`build/off-cz.js`** stáhne z Open Food Facts české produkty a udělá z nich CSV.
Naměřeno: 20 043 produktů, z toho 86 % s vyplněnými kaloriemi → asi 17 200 položek,
soubor kolem 1,3 MB.

- **Bere se po stránkách, ne z hromadného exportu.** Export má 1,3 GB, tohle přenese
  ~30 MB. Cenou je čas: server pouští asi deset dotazů za minutu → ~45 minut.
- **Stránky po 100 server odmítá (503), po 50 projdou.** Stejně tak odmítá `sort_by`.
  Proto se nedělá přírůstková aktualizace a proto **v aplikaci není tlačítko, které
  by databázi stahovalo z internetu** — na telefonu by to běželo tři čtvrtě hodiny
  a padalo v půlce.
- Skript se dá přerušit a **naváže**, kde skončil; po 503 počká a zkusí to znovu.
  `--dokonci` udělá CSV z toho, co je zatím stažené, a rozdělaný stav nechá být.

> **Ověřeno v provozu: celé stažení přes API se nepovedlo.** Skript došel na stránku 11
> ze 401 a pak dostal `401 Unauthorized` a série 503 přes 25 minut — deset pokusů
> s čekáním až pět minut nestačilo. Open Food Facts tenhle způsob zjevně odmítá a ve
> své dokumentaci na hromadné výběry odkazuje na exporty. Vzorek tří stránek fungoval,
> ale o čtyřech stovkách to nevypovídalo.
>
> **Kdo bude chtít celou databázi, musí sáhnout po exportu (1,3 GB)** a odfiltrovat
> české produkty lokálně; stahování jde streamovat, takže se na disk neusadí 9 GB.
> Skript zůstává použitelný pro malou databázi a pro jiné země s menším počtem produktů.
>
> Bez offline databáze aplikace funguje dál: dotaz na **jednotlivý kód** Open Food Facts
> normálně vrací (ověřeno) a co se jednou naskenuje, uloží se natrvalo mezi vlastní
> potraviny. Databáze se tedy plní sama používáním, jen postupně. Zaskřípe to v obchodě
> se slabým signálem u výrobku kupovaného poprvé.
- Data jsou pod ODbL: volně použitelná při uvedení zdroje. **Výsledné CSV nepatří
  do repozitáře** — zůstává na disku a v telefonu, stejně jako NutriDatabáze.

**V aplikaci:**

- import čte sloupce `kod` a `znacka`; u položek s kódem se z něj tvoří i `id`
- `lookup()` se **nejdřív podívá do databáze v telefonu** a teprve pak na internet;
  nalezená položka se uloží mezi vlastní potraviny (kvůli gramáži a četnosti)
- **víc databází naráz**: každý řádek nese `zd` (klíč databáze), import nahradí jen
  řádky se stejným klíčem. Typicky NutriDatabáze na suroviny + Open Food Facts na kódy.
  Při hledání i skenování se chovají jako jedna, duplicity se v nabídce neopakují.
  Název databáze je v meta `extNazvy`, čas načtení v `extKdy` — odvozovat je zpětně
  z klíče by znamenalo hádat, jak se co zkrátilo.
- v Nastavení → Data je u každé databáze počet, datum načtení a tlačítko **Aktualizovat**

**`ext` se nesynchronizuje ani nezálohuje** (`SYNC_STORES` bez něj, `exportData` bez něj).
Nejsou to data uživatele, dají se znovu načíst ze souboru, a se 17 tisíci řádky by
každý commit i každá záloha narostly o megabajty (sladění posílá vždy celý stav).
Na každém zařízení se importuje zvlášť.

**Pozor na `ZRUSENE_STORY`:** `mergeState` schválně přenáší neznámé klíče beze změny
(kvůli slučitelnosti se staršími verzemi), takže samotné vyřazení ze `SYNC_STORES`
by `ext` ve sdíleném souboru nechalo ležet navždycky. Proto je seznam zrušených klíčů
a v `syncRun` vynucený zápis, když se ve staženém stavu ještě objeví.

- testy `test62.js` (databáze s kódy, dvě naráz, duplicity) a `test63.js`
  (nesynchronizuje se, není v záloze, úklid zbytku po starší verzi)

### Novinky ve v61 — nová potravina z fotky obalu

Třetí panel v Zadat: **Vyfotit** (`s-lab`). Pro potravinu, která není v databázi
a nemá čitelný čárový kód. Jedna fotka pokryje obojí:

- je-li vidět **tabulka výživových údajů**, Claude ji jen opíše (`zdroj: "etiketa"`),
- není-li, určí podle obalu výrobek a hodnoty **odhadne** (`zdroj: "odhad"`) —
  formulář to pak označí varováním `#edOdhad`, ať je jasné, co je potřeba ověřit.

**Nestavělo se to znovu.** Čtení etikety existovalo od v44, jen bylo zakopané uvnitř
formuláře nové potraviny — muselo se tam nejdřív doklikat. Nový panel je **rozcestník**:
`gotObal()` otevře `openEdit(null)`, předá fotku do `labelFile`, ukáže náhled a s API
klíčem rovnou zavolá `apiLabel()`. Bez klíče zůstane ve formuláři ruční cesta (poslat
Claudeovi, vložit odpověď), takže funkce na klíči nezávisí. Žádné UI se nezdvojilo.

- `LABEL_PROMPT` rozšířen o rozhodnutí etiketa/odhad a o pole `abv` a `zdroj`;
  `processLabel` je plní (`edAbv`, varování). Vyfocené pivo se tak započítá i do alkoholu.
- Po uložení potraviny se rovnou nabídne zápis porce (`saveProduct` končí `openPortion`),
  takže jedním průchodem se potravina založí i sní.
- **`PROJEKT-INSTRUKCE.md` upraveny na týž formát** — jinak by se ruční cesta přes
  uživatelův Claude projekt rozešla s tím, co čeká parser (pravidlo ze skillu).
- testy `test61.js` (mockované Claude API, platný 1×1 JPEG — `shrinkPhoto` kreslí fotku
  na plátno, takže neplatná data neprojdou).

`test59` tvrdil „v Zadat zůstaly dva panely" a novým panelem spadl. Smyslem v59 ale
nebyl počet, nýbrž to, že **Kód, Ručně a Recept přestaly být samostatné volby** —
tvrzení je přepsané na tohle, aby neblokovalo legitimní přírůstky.

### Novinky ve v60 — oprava: úprava záznamu měnila jídlo za jiné

Uživatel u položky z popsaného oběda změnil chod z odpolední svačiny na oběd
a **z kuřecího plátku se stala minerální voda**.

**Příčina.** Záznamy, které nevznikly z potraviny v databázi, nesou ZÁSTUPNÉ
`productId` — a všechny stejné: `'quick'` (rychlý zápis), `'popis'` (položky
z popisu bez shody), `'foto'` (jídlo z fotky), `'recept'`, `'alk'` (nápoj).
Není to identifikátor potraviny, jen značka původu. `editLog` ale podle něj
hledal v `products`. Dokud potravina s takovým id neexistovala, fungovalo to;
jenže vyrobit ji šlo snadno — v okně porce **Upravit potravinu** volalo
`openEdit(curProduct.id)`, tedy `openEdit('popis')`, a `saveProduct` pak uložilo
potravinu s `id: 'popis'`. Od té chvíle se pod ni schoval **každý** záznam
z popisu a při úpravě se jím přepsal (název i hodnoty).

Proto se to nedařilo zopakovat na testovací databázi — je skoro prázdná
a taková potravina v ní nikdy nevznikla. Reprodukce vyžaduje **dvě položky
ze stejného popisu** a uložení jedné z nich přes „Upravit potravinu".

**Oprava má tři části** (`ZASTUPNE_ID`, `neniPotravina()`):

1. `editLog` u zástupného `productId` v databázi **nehledá** — hodnoty si nese
   záznam sám (`p = neniPotravina(r.productId) ? null : products.find(…)`).
2. `editCurrent` u takového záznamu zakládá **novou** potravinu předvyplněnou
   jeho hodnotami; `saveProduct` navíc pod zástupným id uložit odmítne
   a vygeneruje vlastní.
3. `opravZastupnaId()` při startu přeznačí už uloženou potravinu se zástupným id
   na vlastní — nezmizí, jen přestane přebíjet cizí záznamy. **Nesmí si nést
   `uid`/`upd` smazaného řádku**, jinak by ji sloučení podle náhrobku zase
   smazalo (u `products` slouží jako klíč pro sync `id`, viz `uidOf`).

- testy `test60.js` — ověřují přesně ten případ i nápravu poškozené databáze;
  na verzi před opravou padají 4 tvrzení.

**Pozor:** záznamy, které se přepsaly dřív, oprava neuzdraví — mají už uložený
cizí název i hodnoty. Zpětná náprava by šla jen odhadem, proto se nedělá.

### Novinky ve v59 — zjednodušené zadávání jídla
Kolo vzniklo z průchodu aplikací na mobilním rozměru. Naměřené výchozí stavy:
Hlavní měřila 1606 px při okně 812 px, karta **Časté** začínala na 1444 px (třetí
obrazovka), panel **Hledat** se otevíral prázdný a na Hlavní bylo **21 tlačítek**
menších než doporučených 44×44 px.

- **Hledat nabízí i bez napsaného dotazu.** `renderRychle()` ukáže 6 nejčastějších
  (podle `uses`) a 4 naposledy použité (`lastUsed`); zápis běžného jídla je pak dva
  ťuky bez psaní. Volá se z `onNameInput()` při dotazu kratším než 2 znaky, ze
  `setAdd('find')` a z `clearNameQ()` — tedy i po zápisu porce a po smazání křížkem.
- **Zadat má místo pěti panelů dva: Hledat a Popsat.** Čtečka kódů je ikona v poli
  hledání (`#nameScan` → `setAdd('code')`), ruční zápis tlačítko pod výsledky
  (→ `setAdd('man')`). Oba panely (`s-code`, `s-man`) zůstaly i s ID, jen se k nim
  chodí jinudy a mají tlačítko zpět. V přepínači zůstává zvýrazněné **Hledat**,
  protože jde o odbočky, ne o samostatné volby.
- **Recept se přestěhoval do Jídel** jako pátý segment (`setDbMode('rec')`, blok
  `#dbRec`) — je to skládání potraviny ze surovin, tedy správa databáze, ne zápis
  dne. Panel `s-rec` v Zadat zanikl; `saveRecipe` proto končí `setDbMode('rec')`.
  V režimu Recept se schová i hledací karta `#dbHledatKarta`.
- **Časté jsou hned pod kruhem** (`#favCard`) — z 1444 px na 338 px.
- **Rychlé gramáže se řídí poslední porcí.** `rychleGramaze()` nabídne ½× · 1× · 2×
  z `lastAmount` (jinak `serving`, jinak 100), zaokrouhleno na pětky do 100 a na
  desítky nad 100: kuřecí prsa 90/180/360, olej 5/10/20. Pevné 30/50/100 sedělo
  na sýr, ne na maso nebo rýži. Volá se z `openPortion` i z `editLog`.
- **Dotykové cíle**: nová třída `.dotyk` (min 44×44 px) na knoflících v hlavičkách
  jídel, šipkách data, chipech Časté a zavíracím křížku. Z 21 podměrečných zbylo 0.
  Tlačítko kopie má nově text **⧉ včera** a `aria-label` — samotná ikona byla na
  mobilu nesrozumitelná, protože `title` se tam nezobrazí. Hlavička jídla se pořád
  vejde na 375 px bez přetékání.
- testy `test59.js`; kvůli zrušeným segmentům přepsáno 14 sad na `setAdd(…)`
  a `setDbMode('rec')` místo klikání na `#addSeg`.

**Dvě zastaralá očekávání v testech**, která tím vyplavala:
`test40` klikal na `text=Zapsat` — volný podřetězec, který nově trefil i skryté
tlačítko „Nenašel jsem to — zapsat rovnou kalorie" v jiném panelu; selektor je teď
omezený na `#s-man`. A tentýž test čekal, že křížek nechá výsledky prázdné, což už
neplatí. **Poučení:** textové selektory omezuj na panel, jinak je rozbije každý nový
text, který obsahuje totéž slovo.

**Co se vědomě nedělalo:** schování pole s datem v okně porce (uživatel chce nechat)
a kopie celého dne (nejí každý den totéž — kopie jednoho jídla stačí a funguje pro
libovolný den: přepni se na den a ⧉ vezme jídlo z předchozího).

### Novinky ve v58 — dvě drobnosti, které otravovaly při zápisu
Obojí vzešlo z běžného používání, ne z revize kódu.

- **Hledání se po zápisu porce vyprázdní.** Dřív tam zůstal minulý dotaz i výsledky,
  takže další hledání začínalo cizím obsahem. `clearNameQ(fokus)` má nově parametr:
  tlačítko ✕ maže s přesunem kurzoru do pole (jako dřív), po zápisu porce se maže
  potichu — jinak by na telefonu vyskočila klávesnice a stránka poskočila.
- **Po zápisu se pohled vrátí k tomu jídlu, kam se psalo.** `go('day')` roluje na
  začátek stránky, takže při psaní několika položek do večeře se muselo pokaždé
  scrollovat dolů. Každá skupina v deníku má teď kotvu `id="jidlo-<klíč>"`
  (`snidane`, `obed`, `vecere`, …) a `addPortion` na ni po překreslení najede
  přes nové `scrollToMeal()`. Platí i pro úpravu existujícího záznamu.
- testy `test58.js` — ověřeno i to, že na verzi před opravou padá 8 tvrzení.

#### `runall.sh` nekontroloval návratový kód — šest testů mlčky neběželo

Test, který spadl výjimkou (a nestihl vypsat `NEPROŠLO`), se počítal jako **úspěšný**,
protože se hledaly jen známé vzory v textu. Přišlo se na to, když `test58.js` na
neopravené verzi havaroval na `getBoundingClientRect` neexistujícího prvku a skript
to nahlásil jako ✓. Nenulový kód je teď pád.

Hned to odhalilo, že **`test39`, `43`, `45`, `46`, `47` a `48` od přechodu na git vůbec
neběžely**. Při hromadném portování se řádek `const PROSTREDI = require('./prostredi');`
vkládal za první řádek souboru — a u testů s víceřádkovou hlavičkou tím skončil
**uvnitř komentáře**, takže `PROSTREDI` nebylo definované. Zprávy „57/57" a „58/58“
byly tedy o šest sad optimističtější, než měly být; v57 šla ven na neúplné regresi.
Řádek se nově vkládá za `require('playwright')` — kotva mimo komentáře.

Když ty testy konečně běžely, našly dvě věci:

- **`test47` měl vadný falešný GitHub.** Ověření práva zápisu (`syTestZapis`) posílá
  zkušební obsah `x` na jinou cestu (`….zkouska`) se záměrně neplatným `sha`. Skutečný
  GitHub odpoví 422 a nic nevytvoří, ale mock zápis přijal a uložil `x` jako sync soubor
  — první opravdové sladění pak narazilo na cizí obsah a test havaroval v `syDecode`.
  `test48` má tentýž případ ošetřený správně, takže stačilo srovnat starší mock.
- **`test48` čekal po nezdařeném „smazat všude" nula náhrobků.** Jenže zařízení vzniká
  až po kroku, kde se mazalo všude, takže si náhrobky legitimně stáhne z repozitáře —
  a **kdy** se to stane, test neurčoval (viz past s `last: 0` u `test50`). Samostatně
  procházel, v sadě padal. Zařízení se nově před měřením jednou ručně sladí a hlídá se,
  že neúspěšné mazání **nepřidá další** náhrobky. Úklid v aplikaci ověřen v izolaci —
  chová se správně, vada byla v očekávání testu.

**Nedořešeno:** uživatel hlásí, že po zápisu popisu „po položkách" a následné úpravě
gramáže v deníku se uloží jiná potravina. Nepodařilo se zopakovat — zkoušeno se dvěma
i pěti položkami, s napojením na databázi i bez, s klepnutím přes UI i programově,
a s desetinnou čárkou v poli množství. Pokaždé se uložil správný záznam. Chybí
konkrétní příklad z ostrých dat; podezření míří na položky napojené na **vlastní**
potravinu uživatele (`pid` z `localMatches`), protože tam `editLog` vezme
`curProduct` z `products` a přepíše záznam hodnotami té potraviny — v testovací
databázi se to neprojeví, protože je skoro prázdná.

### Novinky ve v57 — zkratky ikony aplikace
Po podržení ikony na ploše telefonu nabídne systém tři zkratky, které pustí rovnou
tam, kam se zapisuje: **Zapsat jídlo** (`./?jdi=scan`, otevře Zadat → Hledat),
**Zapsat nápoj** (`./?jdi=alc`) a **Zapsat cvičení** (`./?jdi=fit`).

Obsluha parametru `?jdi=` v `index.html` (kolem řádku 1448) **existovala od dřívějška
a byla nasazená** — chyběl jen klíč `shortcuts` v `manifest.json`, takže o zkratkách
telefon nevěděl. Tohle kolo tedy nepřidalo kód, jen zapnulo, co už bylo hotové.

- každá zkratka má **vlastní ikonu** (vidlička s nožem, sklenice, činka) v barvách
  aplikace: podklad `#12151a`, bílá `#e8ecf3`, modrá `#4ea3ff`. Dřív by všechny tři
  nesly kopii ikony aplikace a v menu by se lišily jen popiskem.
- ikony generuje `build/ikony-zkratek.py` (bez závislostí, vlastní rasterizér a zápis
  PNG). `python build/ikony-zkratek.py <složka> --do-manifestu` je přegeneruje
  a rovnou vloží do `manifest.json`; výstup je reprodukovatelný, opakované spuštění
  dá bajt po bajtu tentýž manifest.
- testy `test57.js` — ověřují manifest, že se ikony liší a jsou to platná PNG 512×512,
  a že každý odkaz opravdu otevře svou stránku. Ověřeno i to, že na verzi bez zkratek
  padá 8 tvrzení (jinak by test nic nedokazoval).

#### Opraven vratký `test50.js` (tři nezávislé vady v testu, ne v aplikaci)

1. **Tvrzení „během sladění" neověřovalo nic.** Sleduje stav tlačítka 60 ms po spuštění
   sladění, jenže mock odpovídal okamžitě — na rychlém stroji bylo v tu chvíli hotovo
   a tvrzení padalo *vždycky* (ověřeno: původní v56 padá 6× ze 6). Mock má nově řiditelné
   `zpozdeni`, takže se měří skutečný průběh.
2. **Test chodil na skutečný internet.** Krok 3 schválně nastaví prázdný repozitář, čímž
   vznikne `api.github.com/repos//contents/…` — adresa, na kterou se mockované vzory
   netrefí, takže požadavek odešel ven a výsledek závisel na kvalitě připojení. Nové
   `PROSTREDI.blokujVenek(ctx)` zachytí všechno mimo `127.0.0.1`. **Musí se registrovat
   jako první** — v Playwrightu má přednost naposledy přidaná routa.
3. **Hlavní příčina nestability: aplikace slaďuje i sama od sebe.** `window.onfocus`
   spustí kolo hned (>30 s od posledního), `visibilitychange` taky (>60 s) — a to
   okamžitě, ne přes časovač, takže `clearTimeout(syTimer)` na to nestačí. Test zakládal
   zařízení s `last: 0`, takže podmínka platila vždy, a zakládání dalšího okna ten fokus
   vyvolalo. Podle časování se buď nahrál nejdřív prázdný stav (druhé zařízení pak
   nenašlo nic), nebo vznikly dva commity místo jednoho. Padalo to v jednom běhu ze
   čtyř, pokaždé na jiném tvrzení. **Řešení: zařízení se zakládá jako čerstvě sladěné**
   (`last: Date.now()`); kroky 4 a 5 si `last` posunou samy. Po opravě 8 běhů z 8 čistých.

**Pravidlo do budoucna:** kdo v testu počítá přesné počty commitů nebo dotazů, musí počítat
i s tím, že si aplikace umí sladit sama — přes časovač (`syLater`), při fokusu, při návratu
viditelnosti a jednou za dvě minuty. Nejjistější je založit zařízení jako čerstvě sladěné.

`runall.sh` navíc ukládá výstup každé sady do `<KAL_DIR>/logy` a po pádu rovnou vypíše,
která tvrzení padla — dřív hlásil jen počet, což k dohledání příčiny nestačilo.

### Novinky ve v56 — úklid
Revize hledala mrtvý kód a zbytečnou složitost. Mrtvý kód se nenašel žádný (jediné dva nálezy
byly falešné: `swEnd` je obsluha události, `denikRun` se volá přes `setTimeout`). Skutečný nález
byl jinde — v panelu Popsat zůstala po sloučení v55 celá **ruční cesta** (uložit fotku, poslat do
chatu, vložit odpověď) rozbalená vedle nového tlačítka, včetně číslování kroků 2/3/4, které už
neplatilo.

- ruční cesta je teď v jednom sbalovacím bloku `#rucniCesta`; `apiUi()` ho **rozbalí jen tomu,
  kdo nemá API klíč** — je to náhrada za API, takže s klíčem jen překáží. Testy běží bez klíče,
  takže se kvůli tomu nemusely přepisovat.
- zrušené číslování kroků v nadpisech
- odstraněno mrtvé pole `today` z `alcStats()` a nepoužité `id="labShare"`
- ověřeno: žádná nepoužitá CSS třída, žádná nevolaná funkce, žádné osiřelé `id` kromě výše

### Novinky ve v55 — jedna cesta pro popis, fotku i obojí
Segmenty pro fotku a pro větu (z v54) jsou sloučené do jednoho panelu **Popsat** (`s-photo`,
ID zůstala, aby se nemusely přepisovat testy). Hlavní vstup je **věta** (`photoNote`, dřív jen
doplňující poznámka k fotce), **fotka je nepovinné upřesnění**. `apiEstimate()` podle toho volí
cestu: s fotkou `apiAsk` + `AI_PROMPT`, bez ní `apiText` + nový `VETA_PROMPT` (stejný tvar
odpovědi, takže ji čte tentýž `parseAI`). Samostatná větná cesta (`txt*`, `s-text`) je zrušená.

- **Dohledávání v databázi se dostalo i k fotce**: `processAI` protáhne položky `aiMatch()`.
- **`aiMatch` je schválně přísný** — název z databáze musí být celý obsažený v rozebíraném názvu
  (nebo být shodný). Volné hledání napojilo rýži na basmati vařenou, ale stejně dobře se mohlo
  trefit do bílé syrové (360 vs 130 kcal). Když si nejsme jistí, **zůstane odhad** a je tak
  i označený. Cenou je, že název s přívlastkem navíc se na obecnější položku nenapojí.
- `parseAI` nově přebírá i `abv`, takže pivo popsané větou se započítá do alkoholu.
- Nové tlačítko **Přidat po položkách** (`aiSaveItems`) vedle původního **Přidat jako jedno jídlo**
  (dřív Přidat do dneška — přejmenováno; upraveny testy `test19`, `test42`, `test45`).
- testy `test56.js` přepsané na sloučenou cestu

### Novinky ve v54
- **Zápis přirozenou větou** (v55 sloučeno do panelu Popsat) — segment „Větou" v panelu Zadat (`s-text`). Claude větu jen
  **rozebere** na položky a odhadne hodnoty (`txtPrompt` → `apiText`, odpověď je čisté JSON);
  aplikace pak každou položku zkusí najít v databázi přes `localMatches()` a **shodě dá přednost
  před odhadem**. Návrh se ukáže k potvrzení: dá se odznačit položka i přepsat množství,
  položky mimo databázi jsou označené jako „odhad". Bez potvrzení se **neuloží nic**.
  Pivo apod. se díky poli `abv` započítá i do alkoholu (viz v52).
- **Hledání v deníku** na Statistikách (`denikQ`, `denikRun`): seskupí záznamy podle názvu přes
  celý deník a ukáže, kdy naposledy, kolikrát, průměrnou porci a součet kcal. Hledá bez ohledu
  na diakritiku (`matchWords`) a nezávisle na zvoleném období statistik.
- testy `test56.js`

### Novinky ve v53 — oprava zdvojování upravených záznamů
Formuláře při **úpravě** staví objekt záznamu znovu: nechají původní `id`, ale `uid` v něm chybí
(`addPortion`, `addCustomDrink`, editace cvičení). `dbPut` mu proto přiděloval **nové** `uid`.
Lokálně se řádek přepsal a vypadalo to dobře, jenže ve sdíleném souboru zůstal pod starým `uid`
a při dalším sloučení se vrátil jako **druhý záznam** — uživatel viděl „úprava se zkopírovala".

Oprava je v `dbPut`: má-li záznam `id`, ale ne `uid`, dohledá se `uid` existujícího řádku
a převezme se. Nové řádky (bez `id`) dostávají `uid` dál nové, takže kopie jídla ze včerejška
zůstává samostatným záznamem.

**Pravidlo do budoucna:** synchronizovaný záznam se pozná podle `uid`, ne podle `id`. Kdo staví
objekt záznamu znovu, musí buď `uid` zkopírovat, nebo se spolehnout na tuhle dohledávku —
nikdy nesmí vzniknout stav „stejné `id`, jiné `uid`".

Testy `test55.js` — ověřeno i tak, že na neopravené verzi padají (jinak by test nic nedokazoval).

### Novinky ve v52
- **Potravina může nést alkohol.** V editaci potraviny je pole `edAbv` (% obj.); při zápisu porce
  `addPortion` dopočítá `rec.alc = alcG({ml: množství, abv})` a uloží i `rec.abv`. Množství se bere
  jako mililitry. Zbytek aplikace se řídí polem `alc`, ne `productId`, takže se to samo objeví
  v denním součtu, na záložce Alkohol, ve statistikách i v exportu. Editace řádku pozná podle
  `productId === 'alk'`, jestli otevřít formulář nápoje, nebo potraviny.
- **Graf „Denní příjem" nahrazen grafem „Denní příjem proti výdeji".** Sloupec je snědeno,
  schodová čára je výdej toho dne (klid + hodinky + cvičení), sloupec nad čarou je červený
  (přebytek), pod ní modrý (deficit). Průměrovaná čára cíle zmizela — v dynamickém režimu
  nedávala smysl. Samostatný graf bilance (`chBal`, `svgDiverging`) je proto **zrušený**;
  testy `audit.js` a `test7.js` si kvůli tomu hlídají `#chKcal path`.
  Bez zadaného klidového výdeje se graf vrací k čáře cíle.
- **Alkohol má stejná období jako statistiky jídla**: segment 7 / 30 / 90 dní (`#alcSeg`,
  `alcPeriod`, `setAlcPeriod`). `alcStats()` teď staví 90 dní. Dlaždice `alcAvgP` (ø g/den)
  a `alcSumP` (celkem) nahradily pevné `alcA7` / `alcA30`; `alcDry` má popisek `alcDryOf`.
  Graf dnů se přesunul z podrobností nahoru a řídí se obdobím. **Limit zůstává klouzavý
  průměr za 30 dní** bez ohledu na zvolené období — je to definice limitu, ne pohled na data.
- testy `test54.js`

### Novinky ve v51
- **Záložka „Víc" přejmenovaná na „Nastavení"** a rozdělená do tří skupin segmenty nahoře
  (`#setSeg`, funkce `setSetMode`, obaly `#setJa` / `#setProp` / `#setData`) — dělítko je,
  jak často se tam chodí: **Já** (cíle, klidový výdej, O mně, alkohol) · **Propojení**
  (Claude API, synchronizace, šifrování, párování) · **Data** (záloha, externí databáze,
  verze, info). Volba skupiny se drží stejně jako segmenty na Jídlech.
- Klidový výdej zůstal samostatnou kartou (uživatel to tak chtěl).
- **Pozor při psaní testů:** cokoli mimo skupinu Já je skryté, takže `click`/`fill` selže.
  Testy musí nejdřív `await p.evaluate(() => setSetMode('prop'))` nebo `'data'` a případně
  se stejně vrátit na `'ja'`. Kvůli tomu se upravovaly `audit.js`, `audit2.js`, `test.js`,
  `test3.js`, `test7.js`, `test11.js`, `test28.js`, `test45.js`, `test47.js`, `test52.js`.
- testy `test53.js`

### Novinky ve v50
- **Žádné pole není `type="password"`.** Chrome kolem takového pole hlídá celý dokument a nabízel
  ukládání hesla i při psaní čísel do úplně jiných políček. Klíč k API, token i heslo k šifrování
  jsou proto `type="text"` s třídou `.tajne` a maskováním přes `-webkit-text-security`;
  kde to prohlížeč neumí (Firefox), `tajnaPoleUi()` se vrátí k `type="password"`.
  U tokenu je tlačítko Ukázat/Skrýt (`vidTajne`), u hesla k šifrování schválně ne.
- **Rozbor období od Claude** na Statistikách: `rozborRun()` pošle `summaryText()` za zvolené
  období (7/30/90 dní) plus volný text z Nastavení → O mně (`goals.profil`) na Claude API
  přes nové `apiText()`. Odpověď se ukládá do meta `rozbor` a přežije restart (`loadRozbor`).
  Prompt je v `rozborPrompt()` — vyžaduje strukturu jak to dopadlo / co stojí za pozornost /
  na příště, zakazuje krajní doporučení a diagnostikování a nutí opírat se jen o data.
  Ruční varianta (kopírovat/stáhnout souhrn) zůstala pod rozbalovacím prvkem — kvůli tomu
  si `test7.js` musí sekci nejdřív otevřít.
- testy `test52.js`

### Novinky ve v49
- **Aktivní kcal z hodinek přesunuty z Hlavní na Pohyb** (karta „Z hodinek", nad seznamem aktivit).
  Píše se pořád přes `saveDaily()` do store `daily` a na společné `curDate`, takže se to chová
  stejně jako dřív; `renderFit()` proto volá `loadDaily()`. Na Hlavní zůstala jen váha.
  Testy `audit.js`, `test8.js`, `test30.js` si kvůli tomu musí přepnout na záložku Pohyb.
- **Kontrola smysluplnosti vstupů** (`MEZE`, `mimoMeze`): váha 25–350 kg a aktivní kcal 0–10000
  se mimo rozsah neuloží a políčko se vrátí (`onchange`, takže se to pozná až po opuštění pole);
  klidový výdej 600–5000 kcal se ukládá, ale pod polem svítí `gRmrWarn` — tam je autosave při
  psaní, kde by blokování vadilo víc, než pomohlo. Důvod: váha 1800 kg se v provozu projevila
  až o dvě obrazovky dál jako cíl 3600 g bílkovin.
- **Opraveno: odložený fokus přepisoval rozepsané pole.** Formulář „Zadat potravinu ručně" si
  120 ms po otevření přesunul kurzor do názvu; kdo mezitím psal do kódu, měl kód v názvu
  (vznikaly potraviny typu „Tvaroh Albert8590000111222" s prázdným `barcode`). Nově se fokus
  přesune, jen když uživatel mezitím nezačal psát jinam. Projevovalo se to jako nestabilita
  `test.js` — padal zhruba jednou ze šesti běhů, a to i v původní v44.
- testy `test51.js`

### Novinky ve v48
- tlačítko **⟳** v řádku s datem na Hlavní (`daySync`) — sladí bez přepínání do nastavení;
  ukazuje průběh (⟳… · ✓ · ✕) a během sladění je zablokované; skryté, dokud není sync nastavený
- **pravidelné kolo**: otevřené a viditelné okno se jednou za dvě minuty samo doptá
  (`setInterval` v initu); bez změn je to jen GET, žádný commit
- sladění i při návratu focusu do okna (starší `visibilitychange` řešil jen přepnutí aplikace)
- testy `test50.js`

### Novinky ve v47
- oprava ověření tokenu: viz `syTestZapis` níže (v46 hlásilo „token smí zapisovat" i tokenu
  bez oprávnění Contents — chyba se projevila až při zapnutí šifrování)
- srozumitelnější hláška u HTTP 403

### Novinky ve v46 — synchronizace mezi zařízeními
Rozdělena do tří vrstev, každá má vlastní testovou sadu.

**Datový základ (`test46.js`)** — DB verze 4 → 5:
- každý synchronizovaný záznam má `upd` (čas změny) a stabilní `uid` napříč zařízeními;
  `products`/`ext` používají svoje `id`, `daily` datum, `log`/`workout` vygenerované `uid`
- nový store **`tomb`** (náhrobky smazaných záznamů) — bez nich by se smazané vracelo
- razítkování je v obalu `dbPut`/`dbDel`, ne u jednotlivých volání; `dbDelLocal` maže bez náhrobku
- `nowTs()` nikdy nevrátí dvakrát stejnou hodnotu (dvě změny v téže ms by měly shodné `upd`)
- `collectState` / `mergeState` / `applyState` — model „úplný stav + náhrobky", slučování je
  idempotentní a nezávislé na pořadí; neznámé klíče z novější verze se přenášejí beze změny
- export/import nese `uid`, `upd` i náhrobky; import pozná týž záznam po opravě a nezdvojí ho
- **opraveno**: kopie jídla ze včerejška dědila `uid` předlohy (se syncem by jedna z kopií zmizela)

**Transport (`test47.js`, `test48.js`)** — GitHub Contents API:
- nastavení v Nastavení → Synchronizace: repozitář `jmeno/repo` + fine-grained token
  (Contents: Read and write), uloženo v meta klíči `sync` — **není v exportu zálohy**
- postup vždy stáhnout → sloučit → zapsat lokálně → nahrát se `sha`; při souběžném zápisu
  GitHub odmítne a kolo se zopakuje (3 pokusy)
- soubor `kalorie-sync.json`, obálka `{f:'kal-sync', v, gz, enc, salt, iv, d}`, obsah gzipovaný
- automaticky po zápisu, při návratu k aplikaci a po připojení k síti; **odstup aspoň 60 s**
  mezi automatickými koly (`syCekani`), ruční tlačítko omezené není
- ruční sladění počká na běžící kolo místo aby se vzdalo (`syRun`)
- `syTest` ověřuje právo zápisu **skutečným pokusem o zápis** (`syTestZapis`): PUT se záměrně
  neplatným `sha` na cestu `…​.zkouska` — GitHub oprávnění ověří dřív než `sha`, takže bez práva
  vrátí 403, s právem 409/422 a nic nevznikne; `permissions.push` v odpovědi o repozitáři
  **popisuje práva uživatele, ne tokenu** (vlastník tam má `true`) a nesmí se na něj spoléhat
- `wipe()` se ptá dvakrát: jen tady / i na ostatních zařízeních (`wipeVsude` rozešle náhrobky);
  při neúspěšném nahrání se náhrobky zase uklidí, aby příští sladění nesmazalo data

**Šifrování a párování (`test49.js`)**:
- heslo → PBKDF2 (200 000 iterací, SHA-256) → AES-GCM klíč, uložený v IndexedDB (meta `crypt`)
  jako **neexportovatelný CryptoKey**; sůl si nese soubor, aby druhé zařízení odvodilo týž klíč
- špatné heslo se pozná při zadání (zkušebním rozšifrováním), ne až při sladění
- po vypnutí šifrování drží `syKeyRead` starý klíč, dokud se nepodaří nahrát nezašifrovanou verzi
- klíč mizí při „Odpojit toto zařízení" a při smazání dat, jinak drží napříč spuštěními
- QR párování: `syQrShow` (BrowserQRCodeSvgWriter ze `zxing.js`), čtení `syScanToggle`/`syQrUse`;
  kód nese jen repozitář + token, **ne heslo k šifrování**

### Novinky ve v44 — Claude API (vlastní klíč)
- Víc → **Claude API**: klíč (meta `api`, NENÍ v záloze — meta se neexportuje) + model (Haiku/Sonnet), test klíče přes /v1/models
- Foto: tlačítko **„Odhadnout hned"** — fotka se zmenší na 1024 px (`shrinkPhoto`), pošle přímo na
  api.anthropic.com (`apiAsk`, hlavička `anthropic-dangerous-direct-browser-access`), odpověď jde stávajícím parserem
- etiketa: totéž tlačítko ve formuláři potraviny; starý postup přes sdílení zůstává jako fallback bez klíče
- chybové stavy: 401 neplatný klíč, 429 limit, došlý kredit, timeout 60 s; testy test45.js (mock API)

### Novinky ve v43
- Zadat: výchozí panel **Hledat**, pořadí Hledat · Kód · Foto · Ručně · Recept

### Novinky ve v42
- FIT_DB: **Kickbox** (10,3 MET), Box – sparring (7,8 MET)
- karta **Chůze s batohem** na záložce Pohyb: rychlost, zátěž, čas, terén (η 1,0–1,8),
  volitelné převýšení; výpočet **Pandolfova rovnice** (`ruckKcal` v index.html), net = gross − klidový výdej,
  sklon omezen na 25 %; vstupy se pamatují v meta klíči `ruck`; testy test44.js

### Novinky ve v41 — záložka Pohyb
- 7. záložka **Pohyb**: zápis cvičení (typ + minuty + kcal), editace klepnutím, swipe mazání s Vrátit
- vestavěná databáze **~55 aktivit s MET** hodnotami (Compendium of Physical Activities 2011, `FIT_DB` v index.html)
- odhad kcal = **(MET − 1) × váha × hodiny** — očištěno o klidový výdej, aby se nepočítal dvakrát; vždy přepsatelné ručně
- nová IndexedDB store **`workout`** (DB verze 3 → 4), index podle data; je v záloze (v exportu klíč `workout`), importu, wipe
- spálené kcal se přičítají k bazálu i hodinkám: bilance na Hlavní („Výdej rmr + hodinky + cvičení"),
  dynamické cíle (`dayTargets`), statistiky (`statsData` slučuje `daily.burn` + workout), souhrn pro Claude
- rychlé chipy nejčastějších aktivit, součty dnes/7/30, zápis na jiný den přes společné datum

### Novinky ve v40 (UX kolo podle recenze)
- mazání záznamů **swipem doleva** + toast „Vrátit" (žádná ✕ v řádcích; mazání i v editaci záznamu/nápoje)
- klepnutí na kruh kalorií přepíná **snědeno ↔ zbývá** (drží se v localStorage)
- záložka **Ručně = rychlý zápis kcal** (bez zakládání potraviny, unit „porce") + tlačítko na plný formulář
- **poslední gramáž** se pamatuje u produktu (`lastAmount`, `lastUsed`) a předvyplňuje
- panel Kód: karta **Naposledy použité**
- hledání: tlačítko ✕, odstraněn duplicitní text o OFF limitu
- záložka **Jídla** má segmenty **Moje · Hotová · Základní · ČR** (katalogy přesunuty z Hledat)
- **Alkohol pročištěn**: průměry 7/30/celkem + dní bez, limit, trend; měsíc/součty/21denní graf v `<details>`
- **Nastavení: autosave** (oninput + debounce 600 ms, funkce `gSave`), tlačítka Uložit zrušena
- Foto: návody se po prvním úspěšném zpracování sbalí (meta `fotoOk`)
- onboarding karta pro prázdnou app (meta `obDone`), oranžový banner při nepovoleném trvalém úložišti
- větší dotyková tlačítka ⧉/+, písmo 12/12.5 px, `--dim2` zesvětlen

## Vývojové prostředí

Repozitář je zároveň zdroják i nasazení: GitHub Pages servíruje kořen větve `main`,
takže **push na `main` je nasazení**. Složky `build/` a `testy/` Pages ignoruje.

```bash
git clone https://github.com/HuanCraven/kalorie.git
cd kalorie
npm install                                    # jednou (playwright + zxing, viz package.json)
python testy/make-fixtures.py                  # jednou
python -m http.server 8811 --bind 127.0.0.1    # aplikace pro testy
cd testy && bash runall.sh                     # regrese, ~20 minut
```

`package.json` v repozitáři popisuje **jen závislosti regrese** — aplikace sama žádné
nemá, běží z `index.html`. Prohlížeč se stahovat nemusí, `testy/prostredi.js` si najde
Chrome nebo Edge v systému; kdo chce Chromium od Playwrightu, nastaví
`KAL_CHROME=playwright` a doinstaluje ho přes `npx playwright install chromium`.

### Regrese v GitHub Actions

`.github/workflows/regrese.yml` pustí celou sadu při každém pushi na `main` a u pull
requestů; změny jen v `*.md` ji nespouštějí. Výpisy všech sad se ukládají jako artefakt
(`vypisy-testu`, 14 dní), takže po pádu je vidět které tvrzení a proč — i u běhu,
který spustil někdo jiný. V CI se schválně používá Chromium od Playwrightu
(`KAL_CHROME=playwright`), aby výsledek nezávisel na tom, jaký prohlížeč má runner.

Před samotnou regresí běží **kontrola verzí**: `APP_VERSION` musí končit stejným číslem,
jaké má cache v `sw.js`. Je to nejčastější opomenutí (pravidlo 1 níže) a takhle se pozná
během vteřin místo až na telefonu, který drží starou verzi.

`runall.sh` nově **končí nenulovým kódem**, když něco spadne — bez toho by CI hlásilo
úspěch vždycky.

Testy si prohlížeč i složku pro fixtures najdou samy (`testy/prostredi.js`),
takže běží na Windows, Linuxu i v cloudu. Dřív byly cesty zadrátované
na `/opt/pw-browsers` a `/home/claude` a šly spustit jen v sandboxu.
Podrobnosti a pasti při psaní testů v `testy/README.md`.

**Konce řádků:** `.gitattributes` má `* -text`, tedy žádné převádění CRLF/LF.
Soubory se servírují tak, jak leží v repu, a nechceme, aby se lišil bajt.

## Soubory v repozitáři

| soubor | co je | edituje se ručně? |
|---|---|---|
| `index.html` | celá aplikace (HTML + CSS + JS v jednom) | ano |
| `sw.js` | service worker, offline cache | ano |
| `manifest.json` | PWA manifest, ikony a zkratky jako data URI | zřídka |
| `zaklad.js` | 294 základních surovin | ano |
| `jidla.js` | 95 hotových jídel | **NE — generuje se** |
| `zxing.js` | čtečka čárových kódů (bundlovaná) | ne |
| `build/receptury.js` | receptury jídel (suroviny + výtěžnost) | ano |
| `build/extra.js` | suroviny, které nejsou v `zaklad.js` | ano |
| `build/build-jidla.js` | generátor `jidla.js` | zřídka |
| `build/ikony-zkratek.py` | generátor ikon pro zkratky v `manifest.json` | zřídka |
| `testy/` | 64 sad Playwright testů + `runall.sh` + `make-fixtures.py` | ano |
| `testy/prostredi.js` | najde prohlížeč a složku pro fixtures | zřídka |
| `README.md` | uživatelská dokumentace (nasazení i všechny funkce) | ano |
| `PROJEKT-INSTRUKCE.md` | text do Project instructions pro Claude projekt | zřídka |
| `SKILL.md` | záložní kopie skillu `kalorie-projekt` (viz níže) | ano |

### Skill `kalorie-projekt`

`SKILL.md` v kořeni je **kopie** skillu, který Claudovi říká pravidla tohoto projektu.
Ostrá verze leží mimo repozitář, v uživatelově profilu:

```
%APPDATA%\Claude\local-agent-mode-sessions\skills-plugin\<id>\<id>\skills\kalorie-projekt\SKILL.md
```

Tam se načítá; kopie v repu je pojistka, kdyby se ta složka vyčistila
(obnova = vrátit soubor zpátky do složky `kalorie-projekt`). **Mění-li se jeden,
musí se změnit i druhý** — jinak bude Claude v příští session pracovat podle starých
pravidel. Skill se načítá při startu session, takže se úprava projeví až v té příští.

## Pravidla, která se osvědčila

1. **Při každé změně `index.html` zvyš `APP_VERSION`** a zároveň číslo cache v `sw.js`.
   Jinak si telefon nechá starou verzi.
2. `jidla.js` nikdy needituj ručně. Uprav `build/receptury.js` a spusť
   `node build/build-jidla.js`. Skript kontroluje Atwaterovy faktory a výtěžnost.
3. Před nasazením (= před pushem na `main`) spustit celou regresi: `bash runall.sh`
   ve složce `testy/`, ~20 minut. V novém prostředí nejdřív jednorázová příprava
   podle sekce **Vývojové prostředí** výše.
4. **Synchronizované záznamy nikdy nezapisuj přímo přes `tx(store).put()`** — jen přes `dbPut`,
   jinak nedostanou `upd`/`uid` a sloučení je přehlédne. Výjimka je `applyState`, kde se `upd`
   schválně přebírá ze vzdáleného stavu.
5. Open Food Facts má limit **10 dotazů za minutu na IP**. Aplikace se online ptá
   jen po stisku Hledat a má vlastní hlídač (6/min) plus 24h paměť odpovědí.
   Nikdy nezavádět našeptávání proti OFF — vede k dočasnému zablokování IP.
6. Data z NutriDatabáze se importují jen do telefonu, do repozitáře nepatří.

## Jak přidat další jídla

V `build/receptury.js` přidej záznam:

```js
{ n:'Název jídla', k:'kategorie', w:1500, sur:[
  ['Hovězí přední',700],['Cibule',200],['Sůl',12],['Voda pitná',600]] },
```

- `sur` = suroviny **syrové**, v gramech, na celý hrnec
- `w` = hmotnost hotového pokrmu (po odpaření vody)
- `odkap:80` = volitelně gramy vypečeného tuku, který se slije
- názvy surovin musí přesně odpovídat `zaklad.js` nebo `build/extra.js`, jinak build zahlásí chybu

Kategorie: polévky, omáčky a maso, smažená, bezmasá, saláty, pomazánky,
studená kuchyně, moučníky.

Pak `node build/build-jidla.js` a nahraj nové `jidla.js` + zvýšenou verzi.

## Co v aplikaci vědomě chybí

- odhad promile v krvi (AlcoDroid to umí, my ne)
- řešení rozdílných hodin zařízení — o tom, čí změna vyhraje, rozhoduje čas toho zařízení,
  což se bez serveru spolehlivě vyřešit nedá
- import receptu z webové adresy — prohlížeč nesmí kvůli CORS stáhnout cizí stránku
  a aplikace nemá server; jediná cesta je vložit text ručně nebo přes Claude
- databáze hotových jídel je zatím malá (95 položek), doplňuje se postupně

## Historie zásadních rozhodnutí

- **Vlastní databáze místo scrapování** Kalorických tabulek — právní důvod.
- **Hotová jídla se počítají ze surovin**, neopisují se odjinud — proto je lze
  opravovat a proto s nimi není právní problém.
- **Dynamické cíle**: bílkoviny 2,0 g/kg a tuky 0,9 g/kg jsou pevné podle hmotnosti,
  sacharidy dopočítávají zbytek energie podle denního výdeje.
- **Limit alkoholu** je klouzavý průměr za 30 dní, ne týdenní součet.
- **Sdílení fotky na Androidu** vždy otevře nový chat mimo projekt. Proto se fotka
  ukládá do telefonu a přikládá se ručně v projektovém chatu.
