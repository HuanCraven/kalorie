const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR: ' + e.message));
  const snap = async nm => { await p.screenshot({ path: OUT + '/' + nm + '.png', fullPage: true }); console.log('-> ' + nm); };

  await p.goto('http://127.0.0.1:8812/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(1200);
  await snap('01-start');

  // pruvodce
  await p.click('#uv1 button.pri'); await p.waitForTimeout(400);
  await snap('02-pruvodce-telo');
  await p.fill('#uvVek', '38'); await p.fill('#uvVyska', '175'); await p.fill('#uvVaha', '82');
  await p.waitForTimeout(300);
  await p.click('#uvBtn2'); await p.waitForTimeout(400);
  await snap('03-pruvodce-cil');
  await p.click('#uv3 button >> nth=0'); await p.waitForTimeout(800);
  await snap('04-pruvodce-hotovo');
  await p.click('#uv4 button'); await p.waitForTimeout(900);
  await snap('05-hlavni-prazdna');

  // zapis jidla
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(600);
  await snap('06-zadat');
  await p.fill('#nameQ', 'rýže'); await p.waitForTimeout(900);
  await snap('07-hledani');
  await b.close(); process.exit(0);
})();
