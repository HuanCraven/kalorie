const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);

  console.log('1. tabulka načtena =', await p.evaluate(()=>window.ZAKLAD ? ZAKLAD.length : 0), 'položek');
  await p.click('nav button[data-p="db"]'); await p.click('#dbSeg button[data-d="zaklad"]');   // v40: katalog v záložce Jídla
  const cats = await p.locator('#zakCats button').allTextContents();
  console.log('2. kategorie:', cats.join(' · '));

  await p.click('#zakCats button >> nth=0'); await p.waitForTimeout(300);
  console.log('3. zelenina: položek =', await p.locator('#zakList .item').count());
  console.log('   první:', (await p.textContent('#zakList .item')).replace(/\s+/g,' ').trim());

  // hledání bez diakritiky (v40: zpět na Zadat → Hledat)
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','rajce'); await p.waitForTimeout(400);
  const r = (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log('4. hledání "rajce" (bez háčků):', r.slice(0,100));
  await p.fill('#nameQ','kureci'); await p.waitForTimeout(400);
  console.log('5. hledání "kureci":', (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim().slice(0,110));

  // výběr → zápis
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(500);
  console.log('6. otevřen panel:', await p.textContent('#poName'), '|', await p.textContent('#poSub'));
  await p.fill('#poAmt','150'); await p.waitForTimeout(200);
  console.log('7. 150 g kuřecích prsou =', await p.textContent('#poK'), '(120·1.5=180)',
              '| makra', await p.textContent('#poM'));
  await p.click('#poAdd'); await p.waitForTimeout(700);
  console.log('8. zapsáno, kcal dne =', await p.textContent('#kcalNow'));

  // uloží se do databáze jako běžná položka
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  console.log('9. v databázi:', (await p.textContent('#dbList')).replace(/\s+/g,' ').trim().slice(0,90));

  // podruhé se nesmí duplikovat
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','kureci prsa'); await p.waitForTimeout(400);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(500);
  await p.click('#poAdd'); await p.waitForTimeout(700);
  const cnt = await p.evaluate(async()=>(await dbAll('products')).filter(x=>x.source==='zaklad').length);
  console.log('10. položek "základní" v databázi =', cnt, '(má být 1)');

  // vláknina se propíše
  console.log('11. vláknina dne =', await p.textContent('#fibTxt'));

  // offline
  await p.context().setOffline(true); await p.reload().catch(()=>{}); await p.waitForTimeout(1200);
  console.log('12. offline: tabulka dostupná =', await p.evaluate(()=>!!window.ZAKLAD),
              '| položek =', await p.evaluate(()=>window.ZAKLAD?ZAKLAD.length:0));
  await p.context().setOffline(false);

  await p.click('nav button[data-p="db"]'); await p.click('#dbSeg button[data-d="zaklad"]');   // v40: katalog v záložce Jídla
  await p.click('#zakCats button >> nth=2'); await p.waitForTimeout(400);
  await p.screenshot({path:PROSTREDI.DIR+'/s9-zak.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
