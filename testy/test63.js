/* Test v63 — cizí databáze potravin se nesynchronizuje ani nezálohuje.
   S Open Food Facts jde o desítky tisíc řádků; sladění posílá vždycky celý stav,
   takže by každý commit i každá záloha narostly o megabajty. Data uživatele to
   nejsou a dají se znovu načíst ze souboru. */
const { chromium } = require('playwright');
const zlib = require('zlib');
const PROSTREDI = require('./prostredi');

const NUTRI = ['origFdNm;ENERC [kcal];PROT [g];CHO [g];FAT [g]',
  'Mrkev syrová;41;0.9;9.6;0.2', 'Brambory vařené;87;2;20;0.1'].join('\n');
const S_KODY = ['kod;nazev;znacka;kcal;bilkoviny;sacharidy;tuky;zdroj',
  '8594001170012;Jogurt bílý;Hollandia;67;3.9;4.4;3.7;Open Food Facts'].join('\n');

const rozbal = b64 => {
  const o = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  let b = Buffer.from(o.d, 'base64');
  if (o.gz) b = zlib.gunzipSync(b);
  return JSON.parse(b.toString('utf8'));
};

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const gh = { file: null, sha: 0, puts: 0 };
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await PROSTREDI.blokujVenek(ctx);
  await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+$/, r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"private":true}' }));
  await ctx.route(/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\//, r => {
    if (r.request().url().indexOf('.zkouska') > 0)
      return r.fulfill({ status: 422, contentType: 'application/json', body: '{}' });
    if (r.request().method() === 'GET') {
      if (!gh.file) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not Found"}' });
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: gh.file, sha: 's' + gh.sha, size: gh.file.length }) });
    }
    gh.puts++;
    const b = JSON.parse(r.request().postData());
    if ((b.sha || '') !== (gh.file ? 's' + gh.sha : ''))
      return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
    gh.file = b.content; gh.sha++;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 's' + gh.sha } }) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  await p.evaluate(async t => {
    await dbPut('meta', { k: 'sync', v: { repo: 'ja/data', token: 't', path: 'kalorie-sync.json', last: Date.now(), on: true } });
    await loadSync();
    await dbPut('log', { date: curDate, ts: 1, name: 'Oběd', amount: 200, kcal: 400 });
    await dbPut('products', { id: 'p-moje', name: 'Moje potravina', unit: 'g', kcal: 100, p: 1, c: 1, f: 1 });
    await parseExt(t);
  }, NUTRI);
  await p.waitForTimeout(900);

  /* ---- 1. sdílený soubor cizí databázi neobsahuje ------------------ */
  await p.evaluate(() => syncNow(true));
  await p.waitForTimeout(1000);
  const stav = rozbal(gh.file);
  ck('cizí databáze se nesynchronizuje', !('ext' in stav), Object.keys(stav).join(','));
  ck('vlastní data se synchronizují dál', (stav.log || []).length === 1 &&
     (stav.products || []).length === 1, 'log ' + (stav.log || []).length + ', potravin ' + (stav.products || []).length);

  /* ---- 2. ani v záloze ------------------------------------------- */
  const zaloha = await p.evaluate(() => {
    let zachyceno = null;
    const puvodni = window.dl;
    window.dl = (jmeno, obsah) => { zachyceno = obsah; };
    return exportData().then(() => { window.dl = puvodni; return zachyceno; });
  });
  const z = JSON.parse(zaloha);
  ck('cizí databáze není v záloze', !('ext' in z), Object.keys(z).join(','));
  ck('ale vlastní potraviny a deník ano', (z.products || []).length === 1 && (z.log || []).length === 1);

  /* ---- 3. úklid zbytku po starší verzi ---------------------------- */
  // starší verze `ext` do souboru zapisovala; musí odtamtud zmizet, jinak by ho
  // sloučení přenášelo dokola jako „neznámý klíč z novější verze"
  const spatny = rozbal(gh.file);
  spatny.ext = [{ id: 'x-stara', n: 'Stará položka', e: 100 }];
  const zabaleno = await p.evaluate(async s => await syEncode(s), spatny);
  gh.file = Buffer.from(zabaleno, 'utf8').toString('base64'); gh.sha++;
  const putsPred = gh.puts;
  await p.evaluate(() => syncNow(true));
  await p.waitForTimeout(1200);
  const poUklidu = rozbal(gh.file);
  ck('zbytek po starší verzi se ze souboru uklidí', !('ext' in poUklidu), Object.keys(poUklidu).join(','));
  ck('a kvůli úklidu se soubor opravdu přepíše', gh.puts > putsPred, 'zápisů +' + (gh.puts - putsPred));
  ck('úklid nesmaže vlastní data', (poUklidu.log || []).length === 1);

  /* ---- 4. databáze v telefonu zůstala ----------------------------- */
  ck('cizí databáze v telefonu zůstává', (await p.evaluate(async () => (await dbAll('ext')).length)) === 2);

  /* ---- 5. v Nastavení je u každé databáze aktualizace a datum ------ */
  await p.evaluate(t => parseExt(t), S_KODY);
  await p.waitForTimeout(900);
  await p.evaluate(() => { go('set'); setSetMode('data'); });
  await p.waitForTimeout(300);
  const info = await p.evaluate(() => ({
    text: document.getElementById('extInfo').textContent.replace(/\s+/g, ' '),
    tlacitek: document.querySelectorAll('#extInfo button').length
  }));
  ck('u každé databáze je tlačítko Aktualizovat', info.tlacitek === 2, 'tlačítek: ' + info.tlacitek);
  ck('je vidět, kdy byla načtena', /načteno \d/.test(info.text), info.text.slice(0, 80));
  ck('a obě jsou vypsané jménem', info.text.indexOf('NutriDatabáze') >= 0 &&
     info.text.indexOf('Open Food Facts') >= 0, info.text.slice(0, 100));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
