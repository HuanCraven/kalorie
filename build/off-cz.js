#!/usr/bin/env node
/* Stáhne z Open Food Facts české produkty s čárovým kódem a udělá z nich CSV,
   které se v aplikaci naimportuje v Nastavení → Data → Externí databáze potravin.
   Pak funguje skenování kódů offline a bez čekání na internet.

   Proč po stránkách a ne z hromadného exportu: export má 1,3 GB, tohle přenese
   kolem 30 MB. Cenou je čas — Open Food Facts pouští asi deset dotazů za minutu,
   takže to trvá zhruba tři čtvrtě hodiny. Skript se dá kdykoli přerušit
   (Ctrl+C) a při dalším spuštění naváže, kde skončil.

   Data jsou pod licencí ODbL: volně použitelná, když se uvede zdroj. Výsledné
   CSV proto do repozitáře nepatří — zůstává na disku a v telefonu, stejně jako
   se to má s NutriDatabází.

   Použití:
     node build/off-cz.js                 # stáhne a uloží off-cz.csv vedle sebe
     node build/off-cz.js --zeme fr       # jiná země (kód podle Open Food Facts)
     node build/off-cz.js --ven data.csv  # jiný výstupní soubor
     node build/off-cz.js --stranek 2     # jen pár stránek (na vyzkoušení)
*/
'use strict';
const fs = require('fs');
const path = require('path');

const arg = (jm, vych) => {
  const i = process.argv.indexOf('--' + jm);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : vych;
};

const ZEME = arg('zeme', 'czech-republic');
const VEN = path.resolve(arg('ven', path.join(__dirname, '..', 'off-cz.csv')));
const ROZDELANE = VEN + '.rozdelane.json';   // aby šlo navázat po přerušení
const NA_STRANKU = 50;        // 100 server odmítá (503), 50 projde
const ODSTUP = 6500;          // ms mezi dotazy — pod deset za minutu
const POKUSU = 5;
const STRANEK_MAX = parseInt(arg('stranek', '0'), 10) || 0;   // 0 = všechny

const spi = ms => new Promise(r => setTimeout(r, ms));
const UA = 'KalorieApp/1.0 (osobni offline databaze; https://huancraven.github.io/kalorie)';

async function stranka(n) {
  const url = 'https://world.openfoodfacts.org/api/v2/search'
    + '?countries_tags_en=' + encodeURIComponent(ZEME)
    + '&fields=code,product_name,brands,nutriments'
    + '&page_size=' + NA_STRANKU + '&page=' + n;
  let cekej = 8000;
  for (let pokus = 1; pokus <= POKUSU; pokus++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      if (r.status === 503 || r.status === 429) throw new Error('server je zahlcený (' + r.status + ')');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (pokus === POKUSU) throw new Error('stránka ' + n + ' se nepovedla: ' + e.message);
      process.stdout.write('   ⟳ ' + e.message + ', zkusím znovu za ' + Math.round(cekej / 1000) + ' s\n');
      await spi(cekej);
      cekej = Math.min(cekej * 2, 60000);
    }
  }
}

/* Z produktu vytáhne jen to, co aplikace potřebuje. Vrací null, když chybí
   kód, název nebo kalorie — bez nich by položka byla v databázi k ničemu. */
function vytez(p) {
  const kod = String(p.code || '').replace(/\D/g, '');
  const nazev = String(p.product_name || '').replace(/\s+/g, ' ').trim();
  const n = p.nutriments || {};
  const kcal = n['energy-kcal_100g'];
  if (!kod || kod.length < 8 || !nazev || kcal == null || !isFinite(kcal)) return null;
  const c = (v, des) => { const x = Number(v); return isFinite(x) && x >= 0 ? Number(x.toFixed(des)) : 0; };
  return {
    kod,
    nazev: nazev.slice(0, 60),
    znacka: String(p.brands || '').split(',')[0].trim().slice(0, 24),
    kcal: c(kcal, 1), b: c(n.proteins_100g, 1), s: c(n.carbohydrates_100g, 1),
    t: c(n.fat_100g, 1), v: c(n.fiber_100g, 1), sul: c(n.salt_100g, 2)
  };
}

const bezStredniku = s => String(s).replace(/[;\r\n]/g, ' ').trim();

(async () => {
  let hotovo = { stranka: 0, polozky: [] };
  if (fs.existsSync(ROZDELANE)) {
    try {
      hotovo = JSON.parse(fs.readFileSync(ROZDELANE, 'utf8'));
      console.log('Navazuji na přerušené stahování: ' + hotovo.polozky.length +
                  ' položek, naposledy stránka ' + hotovo.stranka + '.');
    } catch (e) { console.log('Rozdělaný soubor je poškozený, začínám znovu.'); }
  }

  const prvni = await stranka(hotovo.stranka + 1);
  const celkem = prvni.count || 0;
  let stranek = Math.ceil(celkem / NA_STRANKU);
  if (STRANEK_MAX) stranek = Math.min(stranek, hotovo.stranka + STRANEK_MAX);
  console.log('Země: ' + ZEME + ' · produktů celkem: ' + celkem + ' · stránek: ' + stranek);
  console.log('Odhad času: ' + Math.ceil((stranek - hotovo.stranka) * ODSTUP / 60000) + ' minut.');
  console.log('Můžeš to kdykoli přerušit (Ctrl+C), příště naváže.\n');

  // POZOR: hotovo.stranka se v cyklu mění, takže se z něj nesmí počítat, kdy
  // stahovat dál — jinak se první stránka zpracuje dokola a nic nepřibude.
  const zacatek = hotovo.stranka + 1;
  let data = prvni;
  for (let n = zacatek; n <= stranek; n++) {
    if (n > zacatek) { await spi(ODSTUP); data = await stranka(n); }
    for (const p of (data.products || [])) {
      const z = vytez(p);
      if (z) hotovo.polozky.push(z);
    }
    hotovo.stranka = n;
    fs.writeFileSync(ROZDELANE, JSON.stringify(hotovo));
    const pct = Math.round(n / stranek * 100);
    process.stdout.write('\r   stránka ' + n + '/' + stranek + ' (' + pct + ' %) · použitelných '
      + hotovo.polozky.length + '   ');
  }
  console.log('\n');

  // stejný kód se v databázi objevuje víckrát — necháme ten první
  const videno = new Set(), radky = [];
  for (const z of hotovo.polozky) {
    if (videno.has(z.kod)) continue;
    videno.add(z.kod);
    radky.push([z.kod, bezStredniku(z.nazev), bezStredniku(z.znacka),
                z.kcal, z.b, z.s, z.t, z.v, z.sul, 'Open Food Facts'].join(';'));
  }
  // sloupec zdroj říká aplikaci, kterou databázi nahradit — vedle něj může být
  // načtená ještě NutriDatabáze a import se jí nedotkne
  const hlavicka = 'kod;nazev;znacka;kcal;bilkoviny;sacharidy;tuky;vlaknina;sul;zdroj';
  fs.writeFileSync(VEN, '﻿' + hlavicka + '\n' + radky.join('\n') + '\n', 'utf8');
  fs.unlinkSync(ROZDELANE);

  const mb = (fs.statSync(VEN).size / 1e6).toFixed(2);
  console.log('Hotovo: ' + radky.length + ' potravin s čárovým kódem, ' + mb + ' MB');
  console.log('Soubor: ' + VEN);
  console.log('\nNaimportuj ho v aplikaci: Nastavení → Data → Externí databáze potravin.');
  console.log('Zdroj dat: Open Food Facts, licence ODbL (https://openfoodfacts.org).');
})().catch(e => {
  console.error('\nSkončilo chybou: ' + e.message);
  console.error('Spusť skript znovu — naváže tam, kde přestal.');
  process.exit(1);
});
