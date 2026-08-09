# Kalorie — nasazení na GitHub Pages

Cíl: dostat aplikaci na `https://…` adresu, protože **prohlížeč pustí kameru jen přes HTTPS**.
Data zůstávají výhradně v telefonu (IndexedDB), na server se nic neukládá.

## 1. Vytvoř repozitář (jednou, ~5 minut)

1. `github.com` → přihlas se (nebo si založ účet zdarma)
2. vpravo nahoře **+** → **New repository**
3. Name: `kalorie` · Public · **Create repository**

## 2. Nahraj soubory

1. V prázdném repu klikni **uploading an existing file**
2. Vyber **všech 6 souborů** naráz:
   - `index.html`
   - `sw.js`
   - `manifest.json`
   - `zxing.js`
   - `zaklad.js`
   - `jidla.js`
3. **Commit changes**

> Soubory musí ležet v kořeni repa, ne ve složce. Složky `build/` a `testy/`
> se nahrávat nemusí — aplikaci k běhu nepotřebuje, jsou to zdroje a testy.

Kdo pracuje přes git, nahraje rovnou celý repozitář; **push na `main` je nasazení**.
Postup pro vývoj je v `PREDANI.md`, sekce *Vývojové prostředí*.

## 3. Zapni Pages

1. **Settings** → vlevo **Pages**
2. Source: **Deploy from a branch** · Branch: **main** · složka **/ (root)** → **Save**
3. Počkej 1–2 minuty, nahoře se objeví adresa:
   `https://TVUJ-NICK.github.io/kalorie/`

## 4. Nainstaluj do telefonu

Otevři tu adresu v **Chrome na Androidu** → menu ⋮ → **Přidat na plochu**.
Aplikace pak jede na celou obrazovku a **funguje i offline** (kromě dotazů na Open Food Facts).

Na iPhonu: Safari → Sdílet → **Přidat na plochu**.

## 5. První spuštění

1. **Nastavení → Já** → nastav denní cíle a klidový výdej (ukládá se samo, žádné tlačítko)
2. **Zadat → Kód** → *Spustit kameru* → povol přístup ke kameře
3. Namiř na čárový kód

## Jak to funguje

```
naskenuješ kód
   ↓
1. hledá v TVOJÍ lokální databázi   → okamžitě, i offline
   ↓ (není tam)
2. dotaz na Open Food Facts          → nalezeno = automaticky uloží k tobě
   ↓ (není ani tam)
3. formulář: opíšeš hodnoty z etikety → uloží se natrvalo
```

Každý produkt zadáváš **maximálně jednou**. Po pár týdnech pokryje databáze
většinu toho, co reálně jíš, a Open Food Facts už skoro nepotřebuješ.

Hledání podle názvu jde přes čtyři vrstvy, první tři fungují offline a bez limitu:

| vrstva | co obsahuje | odznak |
|---|---|---|
| moje databáze | co jsi kdy zadal nebo naskenoval | moje |
| hotová jídla | 95 českých pokrmů (svíčková, guláš, řízek, buchty) | jídlo |
| základní potraviny | 294 surovin — zelenina, maso, obiloviny | základní |
| NutriDatabáze ČR | 1136 položek, po ručním importu v Nastavení | ČR |
| Open Food Facts | balené výrobky, jen po stisku Hledat | OFF |

### Hotová jídla

Nejsou opsaná z žádné cizí databáze — jsou **spočítaná ze surovin**. Zdroj je
`build/receptury.js`: seznam surovin v syrovém stavu plus hmotnost hotového
pokrmu. `node build/build-jidla.js` z toho vygeneruje `jidla.js` a cestou ověří
Atwaterovými faktory, že energie sedí se živinami. Když chceš jídlo přidat nebo
opravit poměry, uprav recepturu a přegeneruj — ne `jidla.js` ručně.

Hodnoty jsou **na 100 g hotového pokrmu**. Kolik sníš, zadáváš sám.

## Foto jídla → odhad přes Claude

Pro vařená jídla, kde není čárový kód (restaurace, návštěva, vlastní vaření).

### Rychlá cesta: vlastní API klíč (doporučeno)

Když si v **Nastavení → Propojení → Claude API** uložíš svůj klíč, celé kolečko odpadne:

1. **Zadat → Foto → Vyfotit**, volitelně doplň **Popis**
2. **✨ Odhadnout hned** — fotka se zmenší, odešle přímo Claudovi a rozpis surovin
   se za pár vteřin sám objeví v aplikaci
3. Uprav gramáže → **Přidat do dneška**

Klíč si vytvoříš na `console.anthropic.com` → *Billing* (dobij kredit) → *API Keys* → *Create Key*.
Platí se za použití, ne měsíčně: jedna fotka s modelem **Haiku** stojí kolem deseti haléřů,
se **Sonnetem** (přesnější) do koruny. Klíč zůstává jen v telefonu a **není součástí zálohy** —
po obnově zálohy na novém telefonu ho zadáš znovu.

Stejné tlačítko je i u fotky etikety ve formuláři nové potraviny.

### Původní cesta: přes chat (funguje bez klíče i offline-first)

1. **Foto → Vyfotit** — talíř shora nebo pod 45°, ideálně s příborem/sklenicí na měřítko
2. **Odeslat fotku do Claude** — otevře se nabídka sdílení, vyber aplikaci Claude.
   Fotka i zadání se pošlou naráz. (Zadání se zároveň zkopíruje do schránky pro jistotu.)
3. Claude odpoví JSON blokem → **zkopíruj celou odpověď**
4. Zpátky v aplikaci → **Vložit ze schránky** → **Zpracovat**
5. Objeví se rozpis surovin. **Uprav gramáže**, co je zjevně mimo, nepotřebné smaž.
6. **Přidat do dneška**, nebo **Přidat + uložit jako recept**

Recept se uloží do databáze jako jedna položka s vlastní porcí — příště ho přidáš
jedním klepnutím v sekci Databáze nebo z „Časté" na hlavní obrazovce, bez focení.

Parser zvládne i odpověď s textem okolo, s ```json blokem i s přebytečnou čárkou.
Když Claude odpoví jinak, prostě mu napiš „vrať to znovu jen jako ten JSON".

**Přesnost:** rozpoznání surovin je spolehlivé, odhad hmotnosti ne — běžně ±20–30 %,
u tuků a omáček víc. Co můžeš zvážit, važ. Fotku ber jako odhad, ne jako měření.

## Foto etikety → automatické vyplnění

Když produkt není v Open Food Facts, nemusíš hodnoty opisovat ručně.

V formuláři nové potraviny je nahoře box **Vyplnit z fotky etikety**:
**Vyfotit tabulku** → **Poslat Claudeovi** → zkopírovat odpověď → **📋** → **OK**.

Formulář se vyplní sám (název, značka, kcal, B/S/T, vláknina, sůl, velikost porce).
Zkontroluj a ulož. Tohle je přesné — čtu konkrétní čísla z tabulky, nic neodhaduji.
Když je na obalu jen kJ, přepočítám na kcal (÷ 4,184).

## Alkohol

Vede se v **gramech čistého alkoholu**. Přepočet: `objem × % obj. × 0,789`.

Kalorie se započítávají do denního příjmu jako `etanol × 7,1 + sacharidy × 4`.
Sacharidy ze zbytkového cukru jdou i do denního součtu sacharidů — proto má každý
nápoj v nastavení sloupec `g sacharidů / 100 ml`.

Kontrola modelu: desítka vyjde na ~36 kcal/100 ml, dvanáctka na ~44, panák 40 ml
na ~90 kcal, bílé suché víno na ~70 kcal/100 ml. To odpovídá reálným hodnotám.

**Zadání:** rychlá tlačítka na hlavní obrazovce (pivo 10°, pivo 12°, víno 2 dl,
panák, sekt). Cokoli jiného přes **+ Jiný nápoj** — zadáš objem, % a sacharidy,
a můžeš si to rovnou uložit mezi tlačítka.

**Přehled** (tlačítko u karty Alkohol): součty za 7 a 30 dní, počet dnů bez alkoholu,
sloupcový graf posledních 21 dní a plnění týdenního limitu.

**Limit** nastavíš v Nastavení → Alkohol (0 = vypnuto). Slouží jen jako tvoje
vlastní referenční hodnota — aplikace nic nedoporučuje ani nehodnotí.

Tlačítka i limit jsou součástí zálohy a v CSV exportu přibyl sloupec `alkohol_g`.

## Pohyb a cvičení

Záložka **Pohyb** eviduje spálené kalorie, které se přičítají ke klidovému výdeji
a ke kaloriím z hodinek.

**Zápis aktivity**: napiš název (našeptávač nabízí ~55 aktivit s MET hodnotami podle
*Compendium of Physical Activities*) a délku — aplikace navrhne kalorie podle tvé poslední váhy.
Návrh je vždy přepsatelný a aktivitu můžeš zadat i úplně vlastní, jen s kalorií.

```
kcal = (MET − 1) × váha v kg × hodiny
```

Mínus jedno MET proto, že klidový výdej za tu dobu je už započtený v bazálu — jinak by se
počítal dvakrát.

**Chůze s batohem** má vlastní kalkulačku: zadáš rychlost, hmotnost batohu, čas, terén
(silnice / lesní cesta / náročný terén / písek a sníh) a nepovinně převýšení. Počítá to
**Pandolfova rovnice**, armádní model pro pochod se zátěží — přesnější než paušální MET.
Rychlost, zátěž a terén si aplikace pamatuje, příště doplníš jen minuty.

Nejčastější aktivity se nabízejí jako tlačítka. Klepnutí na záznam ho otevře k úpravě,
swipe doleva ho smaže (s možností vrátit).

Pod aktivitami je karta **Z hodinek** — sem patří aktivní kcal za celý den, jak je ukazují
hodinky nebo fitness aplikace. Zapisuje se to na den nastavený nahoře, stejně jako aktivity.

**Alkohol u potravin**: když u potraviny vyplníš **Alkohol (% obj.)**, započítá se zapsaná porce
i do alkoholu — pivo si tak můžeš uložit jako běžnou potravinu a nemusíš ho zadávat zvlášť
na záložce Alkohol. Objevi se v denním součtu, v seznamu na Alkoholu i ve statistikách.

**Pozor na dvojí započtení**: když trénink změří i hodinky a zapíšeš ho navíc jako aktivitu,
sečte se dvakrát. Buď opisuj denní číslo z hodinek, nebo zapisuj jednotlivé aktivity — ne obojí.

## Výdej, váha a bilance

**Váha** je na hlavní obrazovce v kartě **Váha a bilance** — zadává se kdykoli, nemusíš každý den.
**Aktivní kcal z hodinek** najdeš na záložce **Pohyb**.

Aplikace hlídá, jestli číslo dává smysl: váhu bere v rozmezí 25–350 kg, aktivní kcal 0–10 000
a klidový výdej 600–5 000. Mimo rozsah hodnotu neuloží a řekne to — překlep ve váze by se totiž
jinak projevil až o dvě obrazovky dál jako nesmyslné cíle pro bílkoviny a tuky.

Aby šla spočítat bilance, musíš jednou nastavit **klidový výdej** (Nastavení → Já → Denní cíle).
Když ho neznáš, je tam kalkulačka podle Mifflin–St Jeor: zadáš pohlaví, věk, výšku a váhu.

```
bilance = příjem − (klidový výdej + aktivní kcal z hodinek + zapsané cvičení)
```

## Zápis popisem (a fotkou)

V panelu **Zadat → Popsat** napíšeš běžnou větou, co jsi jedl — třeba „k obědu 150 g kuřecích
prsou, 200 g rýže a lžíce oleje". K tomu můžeš **nepovinně přiložit fotku**; hodí se tam, kde
neznáš gramáž. Funguje samotná věta, samotná fotka i obojí — dohromady je to nejpřesnější,
protože věta doplní to, co z obrázku poznat nejde.

Claude to rozebere na jednotlivé suroviny a aplikace je zkusí najít ve tvé databázi. Co najde
**s jistotou**, vezme odtamtud (přesnější než odhad); zbytek zůstane jako **odhad** a je tak
i označený. Napojení je schválně opatrné: obecná rýže se nenapojí na nic, protože mezi vařenou
a syrovou je trojnásobný rozdíl v kaloriích — raději odhad než tichá záměna za jinou položku.

Návrh se ti nejdřív ukáže: můžeš přepsat množství i položku smazat. Pak vybereš, jestli to zapsat
**po položkách** (každá surovina zvlášť, dá se příště použít samostatně), nebo **jako jedno jídlo**.
**Nic se neuloží samo.** Potřebuje klíč ke Claude API.

## Hledání v deníku

Na Statistikách je pole **Hledat v deníku**. Napíšeš část názvu a uvidíš, kdy jsi to naposledy
jedl, kolikrát celkem, jakou porci obvykle a kolik to dalo dohromady kalorií. Prohledává se celý
deník bez ohledu na zvolené období a nezáleží na diakritice.

## Rozbor od Claude

Na Statistikách je tlačítko **✨ Vyhodnotit období**. Pošle souhrn za zvolený úsek (7, 30 nebo
90 dní) na Claude API a vrátí rozbor ve třech částech: jak to dopadlo, co stojí za pozornost,
co dělat příště. Potřebuje vlastní API klíč (Nastavení → Propojení → Claude API), stejně jako odhad z fotky.

V **Nastavení → Já → O mně** si můžeš jednou napsat, kdo jsi a čeho chceš dosáhnout — věk, výška,
jak se hýbeš, co řešíš. Připojí se to k číslům, takže to nemusíš psát pokaždé znovu.
Odesílá se jen tenhle text a souhrn čísel, nic jiného, a jen když si rozbor sám vyžádáš.
Poslední rozbor zůstane v aplikaci i po zavření.

Rozbor je názor podle čísel, ne lékařská rada. Když nemáš API klíč, souhrn si můžeš pořád
zkopírovat nebo stáhnout a vložit do chatu s Claudem ručně.

## Statistiky

Záložka **Staty**, přepínač 7 / 30 / 90 dní.

- **Tři čísla nahoře**: průměrný příjem, průměrný výdej, průměrná bilance
- **Denní příjem** — sloupce s čárou cíle. Klepnutím na sloupec zobrazíš detail dne.
- **Denní bilance** — sloupce nad/pod nulou (modrá = deficit, červená = přebytek)
- **Váha** — klouzavý 7denní průměr jako čára, jednotlivá vážení jako body
- **Makroživiny** — průměry proti cílům včetně podílu na energii (%E)
- **Postřehy** — automatické, offline, bez AI
- **Nejčastější zdroje kalorií** — kde se ti energie reálně bere

### Nejužitečnější číslo: reálný výdej

Když máš vážení rozložená aspoň přes 10 dní, aplikace dopočte, kolik doopravdy pálíš:

```
reálný výdej = průměrný příjem − (změna váhy v kg × 7700 / počet dní)
```

Tohle číslo je spolehlivější než hodinky, protože vychází ze skutečné změny hmotnosti.
Aplikace ho rovnou porovná s tím, co hlásí hodinky. Když se liší o víc než 200 kcal,
buď hodinky výdej nadsazují, nebo se ti do deníku nedostává všechno jídlo.

Zdroj nepřesností je hlavně vážení: važ se ráno po probuzení, nalačno, ve stejném
oblečení. Denní výkyvy ±1 kg jsou voda, ne tuk — proto se pracuje se 7denním průměrem.

## Claude projekt — ať nemusíš pokaždé posílat zadání

Zadání se ke každé fotce posílá znovu a Android ho navíc někdy zahodí. Řešení:
**Claude projekt s vlastními instrukcemi**. Nový chat se sice pokaždé založí, ale
uvnitř projektu už Claude ví, co má dělat.

1. V Claude **Projects** → **Create project** → název třeba „Kalorie" (zdarma až 5 projektů)
2. **Project instructions** → vlož obsah souboru `PROJEKT-INSTRUKCE.md`
3. V aplikaci **Foto** zaškrtni *„Mám projekt v Claude s instrukcemi"*

**Důležité:** tlačítko *Odeslat fotku do Claude* použít nelze — systémové sdílení
na Androidu vždy otevře **nový chat mimo projekt**, kde instrukce neplatí, a text
zprávy navíc často zahodí. Správný postup je opačný:

1. **Foto → Uložit fotku do telefonu**
2. Claude → tvůj projekt → **nový chat**
3. přilož fotku z galerie a odešli — **bez psaní**

Odpověď přijde ve správném formátu, protože instrukce má projekt. Sdílet přímo do
konkrétního existujícího chatu nejde vůbec — sdílení míří na aplikaci, ne na konverzaci.

## Popis k fotce

Nad tlačítkem sdílení je pole **Popis**. Napiš, co z fotky nejde poznat:
velikost („dlouhý asi 15 cm"), čím je to plněné, kolik oleje šlo do pánve,
co leží vedle na měřítko. Připojí se ke zprávě jako „Doplňující informace ode mě"
a Claude to bere jako přesnější než vlastní odhad z obrázku.

Tohle zpřesní odhad víc než jakákoli úprava aplikace — hmotnost je největší
zdroj chyby a z fotky se odhaduje nejhůř.

## Hledání v deníku

Na Statistikách je pole **Hledat v deníku**. Napíšeš část názvu a uvidíš, kdy jsi to naposledy
jedl, kolikrát celkem, jakou porci obvykle a kolik to dalo dohromady kalorií. Prohledává se celý
deník bez ohledu na zvolené období a nezáleží na diakritice.

## Rozbor od Claude

Dole ve statistikách je **Zkopírovat souhrn do schránky**. Vloží se textový souhrn
s průměry, bilancí, vývojem váhy, dopočteným reálným výdejem a denní řadou dat.
Vlož ho do chatu a zeptej se na cokoli — proč se váha nehýbe, jestli je deficit
rozumný, kde ubrat. Souhrn neobsahuje nic nad rámec těchhle čísel.

Alternativa **Stáhnout jako soubor** dá `.txt`, který můžeš přiložit.

## Uspořádání aplikace

Spodní lišta: **Hlavní · Zadat · Alkohol · Pohyb · Jídla · Staty · Nastavení**

Nastavení je rozdělené do tří skupin podle toho, jak často je potřebuješ:
**Já** (cíle, klidový výdej, limit alkoholu, O mně) · **Propojení** (Claude API, synchronizace,
šifrování, párování telefonu) · **Data** (záloha, import, externí databáze, verze, smazání).

Stránka **Zadat** má nahoře přepínač **Hledat · Kód · Foto · Ručně · Recept** a pod ním volbu data.
Otevírá se rovnou na Hledání.

Záložka **Jídla** má segmenty **Moje · Hotová · Základní · ČR** — tady se procházejí všechny databáze.

## Jídla dne

Záznam se dělí na **snídani, svačinu, oběd, odpolední svačinu, večeři a večerní svačinu**.
Jídlo se navrhne podle času, ale v panelu s množstvím ho můžeš přepnout.

- **Úprava záznamu**: klepni na položku v deníku — přepíšeš gramáž i zařazení.
- **Smazání**: přejeď po položce **doleva**. Objeví se toast s tlačítkem *Vrátit*,
  takže omylem smazaný záznam vrátíš jedním klepnutím. Mazat jde i z okna úpravy.
- **⧉ u názvu jídla**: zkopíruje to samé jídlo ze včerejška.
- **+ u názvu jídla**: přepne na Zadat s předvolbou toho jídla i data.

Na hlavní stránce je vždycky vidět všech šest jídel, i prázdných — přidáváš tak
jedním klepnutím na správné místo.

### Zápis na jiný den

Na stránce Zadat je nahoře pole s datem. Když ho přepneš, objeví se oranžové
varování a na tenhle den se zapisuje, dokud ho nepřepneš zpátky (tlačítko **dnes**).
Datum jde změnit i přímo v panelu s množstvím. Prohlížený den na hlavní stránce
a den zápisu jsou vždycky stejné, takže se nemůže stát, že bys zapsal jinam, než vidíš.

### Zpětný zápis alkoholu

Stránka **Alkohol** má nahoře stejné pole s datem jako Zadat. Přepneš datum,
klepneš na tlačítko nápoje a zapíše se na ten den — nadpis seznamu i konec grafu
se přejmenují, ať je jasné, kam píšeš. Toast po zápisu datum připomene.

### Úprava nápoje

Klepnutí na zapsaný nápoj — v deníku na hlavní stránce i v seznamu na stránce Alkohol — otevře editor — objem, procenta, sacharidy
i zařazení k jídlu. Alkohol i kalorie se přepočítají.
Přednastavená tlačítka se upravují na stránce **Alkohol → Upravit přednastavené nápoje**.

## Hledání podle názvu

*Zadat → Hledat*. Pro věci bez čárového kódu — rajče, rohlík, kuřecí prsa.
Napřed prohledá tvou databázi, pak Open Food Facts. Přepínač „jen produkty prodávané
v Česku" filtruje výsledky na české trhy; když nic nenajde, zkus ho vypnout.
Produkty bez uvedené energie se zahazují.

## Vláknina a sůl

Sčítají se pod makry na hlavní obrazovce. Cíle nastavíš v Nastavení (výchozí 30 g
vlákniny, strop 5 g soli). U produktů z Open Food Facts často chybí — pak se počítá nula,
takže ber součet jako spodní odhad. U ručně zadaných produktů si to doplníš z etikety.

## Připomínka zálohy

Když zapisuješ víc než týden a nikdy jsi nezálohoval, nebo je poslední záloha starší
než 30 dní, objeví se nahoře oranžový pruh s tlačítkem. Zmizí hned po stažení zálohy.

## Synchronizace mezi telefonem a počítačem

Aplikace umí běžet na obou zařízeních zároveň a data si srovnávat. Nepotřebuje k tomu
žádnou cizí službu — všechno leží v **jednom souboru v tvém privátním repozitáři** na GitHubu.

### Nastavení (jednou, ~5 minut)

1. Na GitHubu založ **privátní** repozitář, třeba `kalorie-data`. Prázdný stačí.
2. Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
   Generate new token. U *Expiration* můžeš dát **No expiration**.
3. *Repository access* → Only select repositories → vyber ten nový repozitář.
4. *Permissions* → Repository permissions → **Contents: Read and write**.
5. Token vlož v aplikaci do **Nastavení → Propojení** spolu s názvem repozitáře (`jmeno/kalorie-data`)
   a klepni na **Vyzkoušet spojení**. Hláška ti rovnou řekne, jestli je repozitář privátní
   a jestli token opravdu smí zapisovat.

### Druhé zařízení bez opisování tokenu

Na tom zařízení, kde už je nastaveno, klepni na **Zobrazit kód pro spárování**. Na druhém
zařízení pak **Načíst nastavení z kódu** a namiř kameru. Kód nese repozitář a token, nic víc.
Nefoť ho a nenech si ho přečíst přes rameno — kdo ho má, dostane se k tvému repozitáři.

### Šifrování

Do políčka **Heslo** zadej aspoň osmiznakové heslo, na obou zařízeních stejné. Data se pak do
repozitáře ukládají zašifrovaná (AES-GCM, klíč z hesla přes PBKDF2) a bez hesla je nikdo
nepřečte. Heslo zadáváš na každém zařízení **jednou**; znovu až po *Odpojit toto zařízení*
nebo po smazání dat. **Heslo si zapiš** — nedá se obnovit a bez něj se k zašifrovanému
souboru nedostaneš.

### Jak se to chová

- Sladí se automaticky po zápisu, po návratu k aplikaci nebo do okna, po připojení k síti a
  jednou za dvě minuty, dokud se na aplikaci díváš. Ručně tlačítkem **⟳** vedle data na hlavní
  stránce nebo **Synchronizovat teď** v nastavení. Mezi automatickými koly je odstup aspoň
  minuta, aby v repozitáři nevznikala záplava commitů; když se nic nezměnilo, proběhne jen
  dotaz bez commitu.
- **Tlačítko neprosazuje tvoji verzi.** Slučuje se po jednotlivých záznamech, takže je jedno,
  na kterém zařízení ho zmáčkneš — sejde se všechno odevšad.
- Slučuje se po jednotlivých záznamech, ne celý soubor: když zapíšeš oběd na počítači
  a svačinu v telefonu, sejde se obojí. Když je upravená stejná položka na obou, vyhraje
  novější změna.
- **Mazání se přenáší.** Smazaný záznam se z druhého zařízení nevrátí.
- Když píšou obě zařízení naráz, GitHub druhý zápis odmítne a aplikace kolo zopakuje.
  Prohrát se tím nedá — sloučení proběhne v telefonu dřív, než se cokoli posílá.
- Offline se nic neztratí, jen se sladí při dalším připojení.

### Smazání dat při zapnuté synchronizaci

**Nastavení → Data → Smazat všechna data** se tě zeptá dvakrát. Druhá otázka rozhoduje, jestli se data
smažou **jen tady** (druhé zařízení je má dál a po připojení je pošle zpátky), nebo
**i na ostatních zařízeních**. Po smazání se zařízení vždy odpojí od synchronizace.

## Bezpečnost a soukromí

- Data jsou jen v tomhle telefonu, v IndexedDB pod adresou aplikace. Jiný web se k nim nedostane.
- Ven odchází tři věci, všechny jen na tvoje vyžádání:
  **(a)** dotaz na Open Food Facts při skenu nebo hledání — pošle se hledaný výraz nebo číslo kódu;
  **(b)** fotka jídla nebo etikety na Claude API, když si nastavíš vlastní klíč a klepneš na *Odhadnout hned*;
  **(c)** celý deník do **tvého privátního repozitáře** na GitHubu, pokud si zapneš synchronizaci
  (viz níže). Dokud ji nezapneš, data z telefonu neodcházejí vůbec.
- **Token k GitHubu ani heslo k šifrování nejsou v exportu zálohy** a neputují do synchronizovaného
  souboru. Klíč od šifrování je v telefonu uložený tak, že ho ani prohlížeč neumí vypsat.
- **API klíč** je uložený jen v tomhle telefonu a záměrně **není v exportu zálohy**, aby neunikl
  spolu s daty. Když klíč smažeš z Nastavení, aplikace se vrátí k původnímu postupu přes chat.
- Kamera se zapíná jen na tvoje klepnutí, snímky se zpracovávají v telefonu a neodcházejí.
- V kódu není `eval` ani `document.write`; texty z Open Food Facts i z odpovědí Claude
  se escapují a ID se sanitizují, takže podvržená záloha nemůže spustit kód.
- `zxing.js` je oficiální build knihovny `@zxing/library` z npm. Nebyl auditován řádek po řádku.
- Aplikace si vyžádá **trvalé úložiště**, aby prohlížeč data nesmazal při nedostatku místa.
  Stav vidíš v Nastavení → Info. I tak zálohuj.

## Zálohování — dělej to

**Nastavení → Data → Export zálohy (JSON)**. Data žijí jen v úložišti prohlížeče.
Synchronizace zálohu **nenahrazuje**: co smažeš, smaže se všude, a zašifrovaný soubor
bez hesla nepřečteš. Export dělej dál.
Když si vyčistíš data prohlížeče nebo přejdeš na nový telefon, bez zálohy o všechno přijdeš.
Zálohu vrátíš přes **Import zálohy**.

Zálohu můžeš taky poslat do chatu Claudeovi — umí z ní udělat analýzu trendů,
týdenní průměry, nebo doplnit chybějící hodnoty u položek.

## Poznámky

- **Skener**: na Chrome/Androidu se použije nativní `BarcodeDetector`.
  Ve Firefoxu a jinde se použije přibalená knihovna `zxing.js` — je součástí aplikace,
  nestahuje se z internetu a funguje offline hned od prvního spuštění.
  Naměřeno: rozpoznání EAN-13 do 0,6 s.
- **Firefox**: skener funguje. Nefunguje sdílení fotky přes tlačítko (Firefox neumí
  sdílet soubory) a tlačítko „Vložit ze schránky" — odpověď vlož dlouhým stiskem do pole.
  Zadání pro Claude se do schránky kopíruje normálně.
- **kJ vs kcal**: pokud Open Food Facts nemá kcal, přepočítá se z kJ (÷ 4,184).
- **Kontrola dat**: hodnoty z Open Food Facts zadávají uživatelé a někdy jsou špatně.
  U položky, kterou jíš často, si je porovnej s etiketou — v Databázi ji můžeš kdykoli opravit (✎).
- **Aktualizace aplikace**: nahraj nový `index.html` a `sw.js` do repa (v obou je zvýšené číslo verze).
  V aplikaci pak **Nastavení → Data → Zkontrolovat aktualizaci** — stáhne novou verzi a restartuje se. Data zůstanou.
