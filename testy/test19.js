/* Test v67 — zadání pro Claude API.
   Dřív se tu zkoušelo promptFor() a režim projektu (ruční posílání do chatu);
   od v67 se do chatu nic neposílá a zůstalo jen apiPrompt() pro API cestu. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.click('nav button[data-p="scan"]');
  await p.click('#addSeg button[data-s="photo"]');

  /* ---- zadání pro fotku jídla -------------------------------------- */
  let T = await p.evaluate(() => apiPrompt('meal'));
  ck('zadání pro jídlo nese schéma odpovědi', T.indexOf('"polozky"') > 0);
  ck('bez popisu se nic nepřilepuje', T.indexOf('Doplňující') < 0);

  await p.fill('#photoNote', 'na talíři je i 10Kč mince pro měřítko');
  T = await p.evaluate(() => apiPrompt('meal'));
  ck('popis od uživatele se do zadání přidá', T.indexOf('10Kč mince') > 0);
  ck('a je označený jako doplněk', T.indexOf('Doplňující') > 0);

  /* ---- zadání pro etiketu ------------------------------------------ */
  const L = await p.evaluate(() => apiPrompt('label'));
  ck('zadání pro etiketu má plné názvy živin',
     L.indexOf('bilkoviny') > 0 && L.indexOf('tuky') > 0 && L.indexOf('sacharidy') > 0);
  ck('a pořadí podle české tabulky', L.indexOf('"tuky"') < L.indexOf('"bilkoviny"'),
     'tuky na ' + L.indexOf('"tuky"') + ', bílkoviny na ' + L.indexOf('"bilkoviny"'));
  ck('zná i možnost „nepřečetl jsem to"', L.indexOf('necitelne') > 0);
  ck('popis k fotce se do etikety neplete', L.indexOf('10Kč mince') < 0);

  /* ---- ruční cesta přes chat je pryč -------------------------------- */
  const zbytky = await p.evaluate(() => ['promptFor', 'shareToClaude', 'shareLabel', 'copyPrompt',
    'savePhoto', 'saveProj', 'projUi', 'pasteAI', 'pasteLabel']
    .filter(f => typeof window[f] === 'function'));
  ck('funkce ručního posílání do chatu už neexistují', zbytky.length === 0, zbytky.join(', '));
  const prvky = await p.evaluate(() => ['aiIn', 'labIn', 'gProj', 'rucniCesta', 'shareBtn', 'projOn']
    .filter(id => !!document.getElementById(id)));
  ck('ani jejich ovládací prvky', prvky.length === 0, prvky.join(', '));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
