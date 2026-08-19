/* Test v55 — jedna cesta: věta, fotka nebo obojí; a hledání v deníku */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };
  const near = (a, b, t) => Math.abs(parseFloat(a) - b) <= t;

  let poslano = null, stav = 200;
  let odpoved = JSON.stringify({
    jidlo: 'Oběd', pozn: '',
    polozky: [
      // schválně nesmyslné hodnoty: u rýže musí prohrát s databází
      { nazev: 'Rýže bílá vařená', mn: 200, kcal: 999, b: 99, s: 99, t: 99, abv: 0 },
      { nazev: 'Naprosto vymyšlená pochoutka', mn: 50, kcal: 400, b: 10, s: 30, t: 25, abv: 0 },
      { nazev: 'Pivo světlé', mn: 500, kcal: 43, b: 0.5, s: 3.5, t: 0, abv: 5 }
    ]
  });
  await ctx.route(/api\.anthropic\.com/, r => {
    poslano = JSON.parse(r.request().postData());
    if (stav !== 200) return r.fulfill({ status: stav, contentType: 'application/json', body: '{"error":{"message":"nope"}}' });
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: '```json\n' + odpoved + '\n```' }] }) });
  });

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db && window.ZAKLAD, null, { timeout: 15000 });

  /* ---- 1. panel existuje a bez klíče neposílá --------------------- */
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(200);
  await p.click('#addSeg button[data-s="photo"]'); await p.waitForTimeout(300);
  ck('panel Popsat je vidět', await p.isVisible('#photoNote'));
  ck('samostatná záložka Větou už není', (await p.locator('#addSeg button[data-s="text"]').count()) === 0);
  await p.fill('#photoNote', 'k obědu 200 g rýže');
  ck('bez klíče se tlačítko nenabízí', !(await p.isVisible('#apiEstBtn')));
  await p.evaluate(() => apiEstimate());     // i kdyby ho někdo zavolal přímo
  await p.waitForTimeout(400);
  ck('bez klíče se nic neodešle', poslano === null);

  /* ---- 2. rozbor věty --------------------------------------------- */
  await p.evaluate(async () => {
    await dbPut('meta', { k: 'api', v: { key: 'sk-ant-test', model: 'claude-sonnet-4-6' } });
    await loadApi();
  });
  await p.evaluate(() => apiUi());
  await p.click('#apiEstBtn');
  await p.waitForFunction(() => document.querySelectorAll('#aiList .item').length > 0, null, { timeout: 15000 });
  const polozek = await p.locator('#aiList .item').count();
  ck('věta se rozebrala na tři položky', polozek === 3, 'položek: ' + polozek);
  ck('věta se opravdu poslala', poslano.messages[0].content[0].text.indexOf('k obědu 200 g rýže') > 0);
  ck('prompt žádá jen JSON', poslano.messages[0].content[0].text.indexOf('POUZE tímto JSON blokem') > 0);

  const vypis = await p.textContent('#aiCard');
  ck('co je v databázi, je označené jako z databáze', vypis.indexOf('základní potravina') > 0, vypis.slice(0, 200));
  ck('co v databázi není, je označené jako odhad', vypis.indexOf('odhad') > 0);
  ck('ukazuje se součet', vypis.indexOf('Celkem') > 0);

  /* ---- 3. nic se neuloží bez potvrzení ---------------------------- */
  ck('do deníku se zatím nic nezapsalo',
    (await p.evaluate(async () => (await dbAll('log')).length)) === 0);

  /* ---- 4. úprava množství a odznačení ----------------------------- */
  await p.fill('#aiList input[type=number] >> nth=0', '300'); await p.waitForTimeout(300);
  await p.click('#aiList button.dan >> nth=1'); await p.waitForTimeout(300);   // vymyšlenou položku pryč
  await p.click('text=Přidat po položkách'); await p.waitForTimeout(900);
  const zapsano = await p.evaluate(async () => (await dbAll('log')).map(r =>
    ({ n: r.name, mn: r.amount, kcal: Math.round(r.kcal), alc: r.alc ? Math.round(r.alc * 10) / 10 : 0, meal: r.meal })));
  ck('zapsaly se jen vybrané položky', zapsano.length === 2, JSON.stringify(zapsano));
  ck('odebraná položka chybí', !zapsano.some(x => x.n.indexOf('vymyšlená') >= 0), JSON.stringify(zapsano));
  const ryze = zapsano.find(x => x.n.toLowerCase().indexOf('rýže') >= 0);
  ck('upravené množství se použilo', ryze && ryze.mn === 300, JSON.stringify(ryze));
  // v databázi má rýže bílá vařená 130 kcal/100 g → 300 g = 390 kcal; odhad by dal 2997
  ck('hodnoty se vzaly z databáze, ne z odhadu', ryze && ryze.kcal === 390, JSON.stringify(ryze));
  const pivo = zapsano.find(x => x.n.toLowerCase().indexOf('pivo') >= 0);
  ck('pivo se započítalo i jako alkohol', pivo && near(pivo.alc, 19.7, 0.5), JSON.stringify(pivo));
  ck('položky mají chod', zapsano.every(x => x.meal));
  ck('pole se po zápisu vyprázdní', (await p.inputValue('#photoNote')) === '');

  /* ---- 5. chyba API ----------------------------------------------- */
  stav = 401;
  await p.fill('#photoNote', 'něco'); await p.click('#apiEstBtn'); await p.waitForTimeout(1500);
  ck('chyba se ohlásí', (await p.textContent('#apiEstMsg')).indexOf('neplatný klíč') > 0, await p.textContent('#apiEstMsg'));
  ck('tlačítko se odblokuje', await p.evaluate(() => !document.getElementById('apiEstBtn').disabled));
  stav = 200;
  odpoved = 'tohle není JSON';
  await p.click('#apiEstBtn'); await p.waitForTimeout(1500);
  ck('nesmyslná odpověď nespadne', (await p.textContent('#aiList')).indexOf('Nerozpoznal') >= 0,
     (await p.textContent('#aiList')).slice(0, 80));

  /* ---- 6. hledání v deníku ---------------------------------------- */
  await p.evaluate(async () => {
    const d = new Date();
    for (let i = 1; i <= 5; i++) {
      const x = new Date(d); x.setDate(x.getDate() - i * 3);
      await dbPut('log', { date: dstr(x), ts: 500 + i, name: 'Svíčková na smetaně', amount: 350, kcal: 620, p: 30, c: 60, f: 25 });
    }
  });
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(800);
  ck('karta hledání je na Statistikách', await p.isVisible('#denikQ'));
  await p.fill('#denikQ', 's'); await p.waitForTimeout(500);
  ck('jedno písmeno nehledá', (await p.textContent('#denikOut')).indexOf('dvě písmena') > 0);
  await p.fill('#denikQ', 'svíčk'); await p.waitForTimeout(600);
  const vysl = await p.textContent('#denikOut');
  ck('najde záznam podle části názvu', vysl.indexOf('Svíčková') >= 0, vysl.slice(0, 150));
  ck('uvádí, kolikrát to bylo', vysl.indexOf('5×') > 0, vysl.slice(0, 200));
  ck('uvádí, kdy naposledy', vysl.indexOf('naposledy') > 0);
  await p.fill('#denikQ', 'svickova'); await p.waitForTimeout(600);
  ck('hledá i bez diakritiky', (await p.textContent('#denikOut')).indexOf('Svíčková') >= 0);
  await p.fill('#denikQ', 'krokodýl'); await p.waitForTimeout(600);
  ck('na nesmysl řekne, že nic není', (await p.textContent('#denikOut')).indexOf('nezapsal') > 0);
  await p.click('#denikOut >> xpath=../div[1]/button'); await p.waitForTimeout(400);
  ck('křížek pole vyprázdní', (await p.inputValue('#denikQ')) === '');

  // v73: kartě se stejným nadpisem stavěly na Statistikách dvě, jedna šla pryč
  ck('karta hledání je na Statistikách jen jednou',
     (await p.evaluate(() => [...document.querySelectorAll('#p-stats h3')]
       .filter(h => h.textContent.indexOf('Hledat v deníku') >= 0).length)) === 1);

  // proklik na den po zrušené kartě zbyl — skáče na poslední výskyt (dnes − 3 dny)
  await p.fill('#denikQ', 'svíčk'); await p.waitForTimeout(600);
  await p.click('#denikOut .item'); await p.waitForTimeout(600);
  const skok = await p.evaluate(() => {
    const x = new Date(); x.setDate(x.getDate() - 3);
    return { kde: curDate, cekano: dstr(x), naDni: $('p-day').classList.contains('on') };
  });
  ck('klik na výsledek skočí na poslední výskyt', skok.kde === skok.cekano, JSON.stringify(skok));
  ck('a přepne na Hlavní', skok.naDni, JSON.stringify(skok));
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(600);

  /* ---- 7. dohledávání v databázi je opatrné ----------------------- */
  const shody = await p.evaluate(() => ({
    presne: (aiMatch('Rýže bílá vařená') || {}).name || null,
    volne: (aiMatch('Rýže') || {}).name || null,
    presneJine: (aiMatch('Kuřecí prsa bez kůže') || {}).name || null,
    sPrivlastkem: (aiMatch('kuřecí prsa bez kůže grilovaná') || {}).name || null,
    nesmysl: (aiMatch('naprosto vymyšlená pochoutka') || {}).name || null
  }));
  ck('přesný název se napojí', shody.presne === 'Rýže bílá vařená', JSON.stringify(shody));
  ck('obecné „Rýže" se raději nenapojí na nic', shody.volne === null, JSON.stringify(shody));
  ck('jiný přesný název se taky napojí', shody.presneJine === 'Kuřecí prsa bez kůže', JSON.stringify(shody));
  // přívlastek navíc shodu zruší — raději odhad než tichá záměna za jinou položku
  ck('název s přívlastkem navíc zůstane odhadem', shody.sPrivlastkem === null, JSON.stringify(shody));
  ck('neznámá věc zůstane odhadem', shody.nesmysl === null, JSON.stringify(shody));

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
