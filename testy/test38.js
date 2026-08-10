const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async()=>{
  const b=await chromium.launch({executablePath:PROSTREDI.EXE});
  const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);
  const n = await p.evaluate(()=>window.JIDLA?window.JIDLA.length:0);
  console.log('1) jidla.js načteno, jídel =', n, '| ✓', n===95);

  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','svickova'); await p.waitForTimeout(600);
  let t=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log('2) hledání bez diakritiky:', t.slice(0,120));
  console.log('   ✓ našlo svíčkovou:', /Svíčková/.test(t), '| ✓ odznak jídlo:', /jídlo/.test(t));

  // zapsat do deníku
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(700);
  console.log('3) panel porce:', await p.textContent('#poName'), '|', await p.textContent('#poSub'));
  await p.fill('#poAmt','350'); await p.waitForTimeout(300);
  console.log('   350 g =', await p.textContent('#poK'), '| makra', await p.textContent('#poM'));
  await p.click('#poAdd'); await p.waitForTimeout(700);
  console.log('4) v deníku, den =', await p.textContent('#kcalNow'), 'kcal');

  // kategorie
  await p.click('nav button[data-p="db"]'); await p.click('#dbSeg button[data-d="jidla"]');   // v40: katalog v záložce Jídla
  const cats = await p.locator('#jidCats button').allTextContents();
  console.log('5) kategorie jídel:', cats.join(' · '));
  await p.click('#jidCats button >> nth=3'); await p.waitForTimeout(400);
  const rows = await p.locator('#jidList .item').count();
  console.log('   po kliku na kategorii řádků:', rows, '| ✓', rows>0);
  console.log('   první:', (await p.locator('#jidList .item').first().textContent()).replace(/\s+/g,' ').trim());

  // přežije reload (uložilo se do mé databáze)
  await p.reload(); await p.waitForTimeout(900);
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  console.log('6) po reloadu databáze:', await p.textContent('#dbCount'));

  // recepturník musí umět použít hotové jídlo jako surovinu
  await p.evaluate(() => { go('db'); setDbMode('rec'); });
  await p.fill('#recQ','gulas'); await p.waitForTimeout(500);
  const rr=(await p.textContent('#recRes')).replace(/\s+/g,' ').trim();
  console.log('7) recepturník najde jídlo:', rr.slice(0,90), '| ✓', /guláš|Guláš/i.test(rr));

  // statistiky / info
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);
  const inf=(await p.textContent('body')).replace(/\s+/g,' ');
  console.log('8) info o databázích obsahuje počet jídel:', /Hotových jídel: 95/.test(inf));

  console.log('\nCHYBY:', errs.length?errs.join(' | '):'žádné');
  await b.close();
})();
