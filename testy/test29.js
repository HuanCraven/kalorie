const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);
  console.log('0. tabulka =', await p.evaluate(()=>ZAKLAD.length),
              '| z toho pečivo =', await p.evaluate(()=>ZAKLAD.filter(z=>z.k==='pečivo').length));

  await p.click('nav button[data-p="set"]');
  await p.setInputFiles('#extFile',PROSTREDI.DIR+'/nutri.csv'); await p.waitForTimeout(7000);
  const t = (await p.textContent('#extRes')).replace(/\s+/g,' ').trim();
  console.log('1. import:', t.slice(-160));

  // dopočet chybějících sacharidů
  const chk = await p.evaluate(async()=>{
    const all = await dbAll('ext');
    const f = nm => all.find(x=>x.n.startsWith(nm));
    return {rohlik:f('Rohlík bílý'), langos:f('Langoš'), burger:f('Hamburger'),
            dopo: all.filter(x=>x.x).length};
  });
  console.log('2. dopočteno u', chk.dopo, 'položek');
  console.log('3. Rohlík bílý:', JSON.stringify(chk.rohlik));
  console.log('   kontrola: (351 − 4·11.4 − 9·1.4) / 4 = ' + ((351-4*11.4-9*1.4)/4).toFixed(1));
  console.log('4. Hamburger:', JSON.stringify(chk.burger));
  console.log('   kontrola: (248 − 4·13 − 9·7.4) / 4 = ' + ((248-4*13-9*7.4)/4).toFixed(1));

  // pečivo v našeptávači
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  for (const q of ['rustikalni','slunecnicovy chleb','baget','vicezrnny']) {
    await p.fill('#nameQ', q); await p.waitForTimeout(450);
    const r = (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log(`5. "${q}": ${r.slice(0,110)}`);
  }
  // kategorie pečivo (v40: v záložce Jídla)
  await p.click('nav button[data-p="db"]'); await p.click('#dbSeg button[data-d="zaklad"]');
  await p.click('#zakCats button[data-c="pečivo"]'); await p.waitForTimeout(400);
  console.log('6. kategorie pečivo:', await p.locator('#zakList .item').count(), 'položek');
  const names = (await p.locator('#zakList .nm').allTextContents()).slice(0,10);
  console.log('   ', names.join(' · '));

  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');   // v40: zpět na hledání
  await p.fill('#nameQ','rustikalni'); await p.waitForTimeout(500);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(500);
  await p.fill('#poAmt','80'); await p.waitForTimeout(200);
  console.log('7. 80 g rustikální bagety =', await p.textContent('#poK'), '(262·0.8 = 210)');
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
