/* Test v51 — Nastavení rozdělené do tří skupin */
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

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);

  ck('záložka se jmenuje Nastavení',
    (await p.textContent('nav button[data-p="set"]')).indexOf('Nastavení') >= 0,
    await p.textContent('nav button[data-p="set"]'));
  ck('nahoře jsou tři skupiny', (await p.locator('#setSeg button').count()) === 3);
  ck('výchozí je Já', await p.evaluate(() =>
    document.querySelector('#setSeg button[data-t="ja"]').classList.contains('on')));

  /* každá karta má být právě v jedné skupině a nikde jinde */
  const rozdeleni = await p.evaluate(() => {
    const kde = nadpis => {
      const h = [...document.querySelectorAll('#p-set h3')].find(x => x.textContent.indexOf(nadpis) === 0);
      if (!h) return 'CHYBÍ';
      for (const id of ['setJa', 'setProp', 'setData'])
        if (document.getElementById(id).contains(h)) return id;
      return 'MIMO';
    };
    return {
      cile: kde('Jak počítat cíle'), rmr: kde('Klidový výdej'), omne: kde('O mně'), alk: kde('Alkohol'),
      api: kde('Claude API'), sync: kde('Synchronizace'), sifr: kde('Šifrování'), par: kde('Párování'),
      data: kde('Data'), ext: kde('Externí databáze'), verze: kde('Verze'), info: kde('Info')
    };
  });
  ck('Já: cíle, klidový výdej, O mně, alkohol',
    ['cile', 'rmr', 'omne', 'alk'].every(k => rozdeleni[k] === 'setJa'), JSON.stringify(rozdeleni));
  ck('Propojení: API, synchronizace, šifrování, párování',
    ['api', 'sync', 'sifr', 'par'].every(k => rozdeleni[k] === 'setProp'), JSON.stringify(rozdeleni));
  ck('Data: data, externí databáze, verze, info',
    ['data', 'ext', 'verze', 'info'].every(k => rozdeleni[k] === 'setData'), JSON.stringify(rozdeleni));
  ck('klidový výdej zůstal samostatnou kartou', rozdeleni.rmr === 'setJa');

  /* jen jedna skupina je vidět */
  const vidi = async () => await p.evaluate(() => ['setJa', 'setProp', 'setData']
    .filter(id => getComputedStyle(document.getElementById(id)).display !== 'none'));
  ck('vidět je jen jedna skupina', (await vidi()).length === 1);
  ck('a je to Já', (await vidi())[0] === 'setJa');

  await p.click('#setSeg button[data-t="prop"]'); await p.waitForTimeout(300);
  ck('přepnutí na Propojení ukáže token', await p.isVisible('#syTok'));
  ck('a schová cíle', !(await p.isVisible('#gKcal')));
  await p.click('#setSeg button[data-t="data"]'); await p.waitForTimeout(300);
  ck('Data ukážou zálohu', await p.isVisible('text=Export zálohy (JSON)'));
  ck('a schovají token', !(await p.isVisible('#syTok')));
  ck('zvýrazněné je jen jedno tlačítko',
    (await p.locator('#setSeg button.on').count()) === 1);

  /* volba přežije odchod a návrat, jako u ostatních segmentů v aplikaci */
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  ck('volba skupiny se drží', (await vidi())[0] === 'setData');

  /* funkce uvnitř skupin dál fungují */
  await p.click('#setSeg button[data-t="ja"]'); await p.waitForTimeout(300);
  await p.fill('#gRmr', '1750'); await p.waitForTimeout(1000);
  ck('nastavení ve skupině Já se ukládá', await p.evaluate(async () => {
    const m = await dbGet('meta', 'goals'); return m && m.v && m.v.rmr === 1750;
  }));
  await p.click('#p-set summary'); await p.waitForTimeout(200);
  ck('kalkulačka klidového výdeje se rozbalí', await p.isVisible('#cW'));

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
