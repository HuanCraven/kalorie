/* Test v49 — výdej z hodinek na záložce Pohyb a kontrola smysluplnosti vstupů */
const PROSTREDI = require('./prostredi');
const { chromium } = require('playwright');

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

  /* ---- 1. umístění polí ------------------------------------------- */
  ck('váha zůstala na hlavní stránce', await p.evaluate(() => !!document.querySelector('#p-day #dWeight')));
  ck('výdej z hodinek je na Pohybu', await p.evaluate(() => !!document.querySelector('#p-fit #dBurn')));
  ck('výdej už na hlavní stránce není', await p.evaluate(() => !document.querySelector('#p-day #dBurn')));

  /* ---- 2. zápis výdeje na Pohybu se projeví na Hlavní ------------- */
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(200);
  await p.fill('#gRmr', '1800'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.fill('#dWeight', '69'); await p.locator('#dWeight').blur(); await p.waitForTimeout(600);
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(400);
  await p.fill('#dBurn', '800'); await p.locator('#dBurn').blur(); await p.waitForTimeout(700);
  const ulozeno = await p.evaluate(async () => await dbGet('daily', curDate));
  ck('výdej se uloží ke stejnému dni', ulozeno && ulozeno.burn === 800 && ulozeno.weight === 69, JSON.stringify(ulozeno));
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  ck('a promítne se do bilance na Hlavní',
    (await p.textContent('#balExp')).indexOf('800') > 0, await p.textContent('#balExp'));

  /* ---- 3. cíle z rozumné váhy ------------------------------------- */
  await p.evaluate(async () => { await setMode(true); });
  await p.waitForTimeout(500);
  const cile = await p.evaluate(() => ({ p: document.getElementById('pTxt').textContent, f: document.getElementById('fTxt').textContent }));
  ck('bílkoviny 2,0 g/kg ze 69 kg = 138 g', cile.p.indexOf('138') > 0, cile.p);
  ck('tuky 0,9 g/kg ze 69 kg = 62 g', cile.f.indexOf('62') > 0, cile.f);

  /* ---- 4. nesmyslná váha se neuloží -------------------------------- */
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.fill('#dWeight', '1800'); await p.locator('#dWeight').blur(); await p.waitForTimeout(700);
  const poNesmyslu = await p.evaluate(async () => await dbGet('daily', curDate));
  ck('váha 1800 kg se neuloží', poNesmyslu.weight === 69, 'uloženo: ' + poNesmyslu.weight);
  ck('a políčko se vrátí na původní hodnotu', (await p.inputValue('#dWeight')) === '69', await p.inputValue('#dWeight'));
  ck('cíle zůstaly rozumné', (await p.textContent('#pTxt')).indexOf('138') > 0, await p.textContent('#pTxt'));
  await p.fill('#dWeight', '3'); await p.locator('#dWeight').blur(); await p.waitForTimeout(600);
  ck('ani tři kila neprojdou', (await p.evaluate(async () => (await dbGet('daily', curDate)).weight)) === 69);
  await p.fill('#dWeight', '69.5'); await p.locator('#dWeight').blur(); await p.waitForTimeout(600);
  ck('rozumná změna váhy projde', (await p.evaluate(async () => (await dbGet('daily', curDate)).weight)) === 69.5);

  /* ---- 5. nesmyslný výdej se neuloží ------------------------------ */
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(300);
  await p.fill('#dBurn', '80000'); await p.locator('#dBurn').blur(); await p.waitForTimeout(700);
  ck('výdej 80000 kcal se neuloží', (await p.evaluate(async () => (await dbGet('daily', curDate)).burn)) === 800);
  ck('a políčko se vrátí', (await p.inputValue('#dBurn')) === '800', await p.inputValue('#dBurn'));
  await p.fill('#dBurn', '1200'); await p.locator('#dBurn').blur(); await p.waitForTimeout(600);
  ck('rozumný výdej projde', (await p.evaluate(async () => (await dbGet('daily', curDate)).burn)) === 1200);

  /* ---- 6. varování u klidového výdeje ----------------------------- */
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  await p.fill('#gRmr', '18000'); await p.waitForTimeout(1200);
  ck('nesmyslný klidový výdej se označí',
    await p.evaluate(() => document.getElementById('gRmrWarn').style.display !== 'none' &&
      document.getElementById('gRmrWarn').textContent.indexOf('mimo rozsah') > 0),
    await p.textContent('#gRmrWarn'));
  await p.fill('#gRmr', '1800'); await p.waitForTimeout(1200);
  ck('po opravě varování zmizí',
    await p.evaluate(() => document.getElementById('gRmrWarn').style.display === 'none'));

  /* ---- 7. kurzor neuteče z rozepsaného pole ----------------------- */
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(200);
  await p.click('#addSeg button[data-s="man"]'); await p.waitForTimeout(200);
  await p.click('text=+ Zadat potravinu ručně');
  await p.fill('#edName', 'Zkouška fokusu');
  await p.fill('#edCode', '8590000111222');       // hned po otevření, dokud běží odložený fokus
  await p.waitForTimeout(400);
  ck('psaní do kódu nepřeteče do názvu', (await p.inputValue('#edName')) === 'Zkouška fokusu',
    await p.inputValue('#edName'));
  ck('kód zůstal v poli pro kód', (await p.inputValue('#edCode')) === '8590000111222',
    await p.inputValue('#edCode'));
  await p.click('#modEdit >> text=Zrušit');

  console.log(errs.length ? '\nERRORS: ' + errs.join(' | ') : '');
  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
