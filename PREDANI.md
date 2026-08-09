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

Aktuální verze: **2026.08.09-57** (`APP_VERSION` v `index.html`, cache `kaltrack-v57` v `sw.js`).

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
npm install playwright @zxing/library@0.21.3   # jednou
python testy/make-fixtures.py                  # jednou
python -m http.server 8811 --bind 127.0.0.1    # aplikace pro testy
cd testy && bash runall.sh                     # regrese, ~20 minut
```

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
| `testy/` | 58 sad Playwright testů + `runall.sh` + `make-fixtures.py` | ano |
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
