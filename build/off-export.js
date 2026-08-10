#!/usr/bin/env node
/* Z hromadného exportu Open Food Facts vytáhne české produkty s čárovým kódem
   a udělá z nich CSV pro aplikaci (Nastavení → Data → Externí databáze potravin).

   Tohle je náhrada za build/off-cz.js: stahování po stránkách přes API se
   v provozu neosvědčilo — server po pár desítkách dotazů odmítá (503, 401)
   a na hromadné výběry sám odkazuje na exporty. Cenou je velikost souboru,
   výhodou spolehlivost: stáhne se jednou a zbytek běží na disku.

   Export má ~1,3 GB komprimovaně a přes 13 GB po rozbalení, proto se čte
   proudem — na disk se nic velkého neukládá a v paměti drží jen jeden řádek.

   Použití:
     node build/off-export.js --stahni          # stáhne export (umí navázat) a zpracuje
     node build/off-export.js soubor.csv.gz     # zpracuje už stažený export
     node build/off-export.js --stahni --nechat # po zpracování export nemaže
     node build/off-export.js --zeme france     # jiná země

   Data jsou pod licencí ODbL: volně použitelná při uvedení zdroje. Výsledné CSV
   ani stažený export do repozitáře nepatří (jsou v .gitignore).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const { pipeline } = require('stream');

const arg = (jm, vych) => {
  const i = process.argv.indexOf('--' + jm);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : vych;
};
const ma = jm => process.argv.indexOf('--' + jm) > 0;

const ZEME = 'en:' + arg('zeme', 'czech-republic');
const VEN = path.resolve(arg('ven', path.join(__dirname, '..', 'off-cz.csv')));
const EXPORT_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
const STAZENY = path.join(__dirname, '..', 'off-export.csv.gz');

/* Stahování s navázáním: při přerušení se pokračuje od toho, co je na disku
   (hlavička Range). Slabá síť tak nevadí, jen to trvá déle. */
async function stahni(cil) {
  for (let pokus = 1; pokus <= 20; pokus++) {
    const mam = fs.existsSync(cil) ? fs.statSync(cil).size : 0;
    const hlavicky = { 'User-Agent': 'KalorieApp/1.0 (https://huancraven.github.io/kalorie)' };
    if (mam) hlavicky.Range = 'bytes=' + mam + '-';
    try {
      const r = await fetch(EXPORT_URL, { headers: hlavicky });
      if (mam && r.status === 416) { console.log('\nExport je celý stažený.'); return; }
      if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
      const celkem = mam + Number(r.headers.get('content-length') || 0);
      const out = fs.createWriteStream(cil, { flags: mam ? 'a' : 'w' });
      let mame = mam, tik = Date.now();
      for await (const kus of r.body) {
        out.write(kus); mame += kus.length;
        if (Date.now() - tik > 1000) {
          tik = Date.now();
          process.stdout.write('\r   staženo ' + (mame / 1e6).toFixed(0) + ' / ' +
            (celkem / 1e6).toFixed(0) + ' MB (' + Math.round(mame / celkem * 100) + ' %)   ');
        }
      }
      await new Promise(res => out.end(res));
      console.log('\n   staženo celé (' + (mame / 1e6).toFixed(0) + ' MB)');
      return;
    } catch (e) {
      console.log('\n   ⟳ ' + e.message + ' — navazuji za 10 s (pokus ' + pokus + '/20)');
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  throw new Error('stažení se nepovedlo ani na dvacátý pokus');
}

const bezStredniku = s => String(s).replace(/[;\r\n\t]/g, ' ').trim();
const cislo = (v, des) => {
  const x = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(x) && x >= 0 ? Number(x.toFixed(des)) : 0;
};

async function zpracuj(vstup) {
  console.log('Čtu ' + path.basename(vstup) + ' (proudem, na disk se nic nerozbaluje)…');
  const rl = readline.createInterface({
    input: fs.createReadStream(vstup).pipe(zlib.createGunzip()),
    crlfDelay: Infinity
  });

  let sloupce = null, i = {}, radku = 0, ceskych = 0;
  const videno = new Set();
  const out = fs.createWriteStream(VEN, { encoding: 'utf8' });
  out.write('﻿kod;nazev;znacka;kcal;bilkoviny;sacharidy;tuky;vlaknina;sul;zdroj\n');
  const tik0 = Date.now(); let tik = tik0;

  for await (const radek of rl) {
    if (!sloupce) {
      sloupce = radek.split('\t');
      for (const s of ['code', 'product_name', 'brands', 'countries_tags', 'energy-kcal_100g',
                       'proteins_100g', 'carbohydrates_100g', 'fat_100g', 'fiber_100g', 'salt_100g']) {
        i[s] = sloupce.indexOf(s);
        if (i[s] < 0) throw new Error('v exportu chybí sloupec ' + s);
      }
      continue;
    }
    radku++;
    // levná předběžná zkouška, ať se nerozdělují řádky, které stejně vypadnou
    if (radek.indexOf(ZEME) < 0) continue;
    const c = radek.split('\t');
    if (c[i.countries_tags] === undefined || c[i.countries_tags].split(',').indexOf(ZEME) < 0) continue;

    const kod = String(c[i.code] || '').replace(/\D/g, '');
    const nazev = String(c[i.product_name] || '').replace(/\s+/g, ' ').trim();
    const kcal = c[i['energy-kcal_100g']];
    if (kod.length < 8 || !nazev || kcal === '' || kcal == null) continue;
    const e = cislo(kcal, 1);
    if (!(e > 0)) continue;
    if (videno.has(kod)) continue;
    videno.add(kod);
    ceskych++;
    out.write([kod, bezStredniku(nazev).slice(0, 60),
      bezStredniku(String(c[i.brands] || '').split(',')[0]).slice(0, 24), e,
      cislo(c[i.proteins_100g], 1), cislo(c[i.carbohydrates_100g], 1), cislo(c[i.fat_100g], 1),
      cislo(c[i.fiber_100g], 1), cislo(c[i.salt_100g], 2), 'Open Food Facts'].join(';') + '\n');

    if (Date.now() - tik > 2000) {
      tik = Date.now();
      process.stdout.write('\r   prošlo ' + (radku / 1e6).toFixed(2) + ' mil. výrobků · českých s kódem: ' + ceskych + '   ');
    }
  }
  await new Promise(res => out.end(res));
  const mb = (fs.statSync(VEN).size / 1e6).toFixed(2);
  console.log('\n\nHotovo: ' + ceskych + ' českých potravin s čárovým kódem, ' + mb + ' MB');
  console.log('Prošlo se ' + radku.toLocaleString('cs-CZ') + ' výrobků za ' +
    Math.round((Date.now() - tik0) / 1000) + ' s.');
  console.log('Soubor: ' + VEN);
  console.log('\nNaimportuj ho v aplikaci: Nastavení → Data → Externí databáze potravin.');
  console.log('Zdroj dat: Open Food Facts, licence ODbL (https://openfoodfacts.org).');
}

(async () => {
  let vstup = process.argv.slice(2).find(a => !a.startsWith('--') &&
    /\.gz$/i.test(a) && fs.existsSync(a));
  if (!vstup && ma('stahni')) {
    console.log('Stahuji export Open Food Facts (~1,3 GB). Jde přerušit, příště naváže.');
    await stahni(STAZENY);
    vstup = STAZENY;
  }
  if (!vstup) {
    console.error('Chybí vstup. Buď dej --stahni, nebo cestu k už staženému exportu:');
    console.error('   node build/off-export.js --stahni');
    console.error('   node build/off-export.js en.openfoodfacts.org.products.csv.gz');
    process.exit(1);
  }
  await zpracuj(vstup);
  if (vstup === STAZENY && !ma('nechat')) {
    fs.unlinkSync(STAZENY);
    console.log('\nStažený export (1,3 GB) jsem smazal. Nech si ho příště přes --nechat.');
  }
})().catch(e => {
  console.error('\nSkončilo chybou: ' + e.message);
  process.exit(1);
});
