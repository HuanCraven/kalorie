const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);
  console.log('0. tabulka =', await p.evaluate(()=>ZAKLAD.length), 'položek');

  await p.click('nav button[data-p="scan"]');
  console.log('1. podzáložek =', await p.locator('#addSeg button').count(),
              '|', (await p.locator('#addSeg button').allTextContents()).join(' · '));
  await p.evaluate(() => { go('db'); setDbMode('rec'); }); await p.waitForTimeout(300);

  await p.fill('#recName','Guláš s knedlíkem');
  // hovězí zadní 300 g (131 kcal/100) + cibule 100 (40) + olej 20 (884) + knedlík 200 (214)
  for (const [q, g] of [['hovezi zadni',300],['cibule',100],['olej repkovy',20],['knedlik houskovy',200]]) {
    await p.fill('#recQ', q); await p.waitForTimeout(400);
    const c = await p.locator('#recRes .item').count();
    if (!c) { console.log('   ✗ nenalezeno:', q); continue; }
    await p.click('#recRes .item .grow >> nth=0'); await p.waitForTimeout(300);
    const i = (await p.locator('#recList .item').count())-1;
    await p.fill(`#recList .item:nth-child(${i+1}) input`, String(g)); await p.waitForTimeout(200);
  }
  console.log('2. surovin =', await p.locator('#recList .item').count());
  const names = await p.locator('#recList .nm').allTextContents();
  console.log('   ', names.join(' · '));
  console.log('3. celkem:', await p.textContent('#recTotK'), '|', await p.textContent('#recTotM'));
  console.log('   ruční kontrola: 131·3 + 40·1 + 884·0.2 + 214·2 = 393+40+177+428 = 1038 kcal');
  console.log('4. na 100 g (620 g surovin):', await p.textContent('#rec100'));

  // hmotnost po uvaření
  await p.fill('#recW','520'); await p.waitForTimeout(300);
  console.log('5. po zadání 520 g hotového:', await p.textContent('#rec100'), '(1038/520·100 = 200 kcal)');

  await p.click('text=Uložit a přidat do dneška'); await p.waitForTimeout(700);
  console.log('6. panel porce:', await p.textContent('#poName'), '| porce =', await p.inputValue('#poAmt'),
              'g →', await p.textContent('#poK'));
  await p.fill('#poAmt','250'); await p.waitForTimeout(200);
  console.log('7. 250 g =', await p.textContent('#poK'), '(200·2.5 = 500)');
  await p.click('#poAdd'); await p.waitForTimeout(700);
  console.log('8. zapsáno, kcal dne =', await p.textContent('#kcalNow'));

  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  console.log('9. v databázi:', (await p.textContent('#dbList')).replace(/\s+/g,' ').trim().slice(0,80));
  const rec = await p.evaluate(async()=>{const r=(await dbAll('products')).find(x=>x.source==='recipe');
    return {n:r.name, kcal:r.kcal, serving:r.serving, ing:r.ing.map(i=>i.nazev+' '+i.mn+'g').join(', ')};});
  console.log('10. uložený recept:', JSON.stringify(rec));

  // ochrany
  await p.evaluate(() => { go('db'); setDbMode('rec'); });
  await p.click('text=Jen uložit do databáze'); await p.waitForTimeout(300);
  console.log('11. prázdný recept:', (await p.textContent('#toast')).trim());
  await p.fill('#recQ','rajce'); await p.waitForTimeout(400);
  await p.click('#recRes .item .grow >> nth=0'); await p.waitForTimeout(300);
  await p.click('text=Jen uložit do databáze'); await p.waitForTimeout(300);
  console.log('12. bez názvu:', (await p.textContent('#toast')).trim());

  await p.screenshot({path:PROSTREDI.DIR+'/s10-rec.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
