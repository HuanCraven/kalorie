const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const OFF_SEARCH = {products:[
 {code:'3017620422003',product_name:'Nutella',brands:'Ferrero',serving_quantity:'15',
  nutriments:{'energy-kcal_100g':539,proteins_100g:6.3,carbohydrates_100g:57.5,fat_100g:30.9,fiber_100g:3.4,salt_100g:0.107}},
 {code:'8594001111111',product_name:'Rohlík tukový',brands:'Penam',
  nutriments:{'energy-kcal_100g':287,proteins_100g:9,carbohydrates_100g:52,fat_100g:4.5,fiber_100g:2.8,salt_100g:1.3}},
 {code:'0000000000000',product_name:'Bez energie',brands:'',nutriments:{}}
]};
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  let searchUrl='';
  await p.route(/openfoodfacts\.org\/cgi\/search/, r=>{ searchUrl=r.request().url();
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(OFF_SEARCH)}); });
  await p.route(/openfoodfacts\.org\/api/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"status":0}'}));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(800);

  // --- 4) hledání podle názvu
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','rohlík'); await p.click('#nameBtn');
  await p.waitForTimeout(800);
  console.log('1. výsledků =', await p.locator('#nameRes .item').count(), '(3. bez kcal se má zahodit)');
  console.log('2. CZ filtr v URL =', /tag_0=czech-republic/.test(searchUrl));
  await p.click('#nameRes .item .grow >> nth=1');
  await p.waitForTimeout(400);
  console.log('3. otevřen:', await p.textContent('#poName'), '| jídlo =', await p.inputValue('#poMeal'),
              '| voleb =', await p.locator('#poMeal option').count());

  // --- 2) zařazení k jídlu
  await p.selectOption('#poMeal','snidane'); await p.fill('#poAmt','86');
  await p.click('#poAdd'); await p.waitForTimeout(600);
  console.log('4. den:', (await p.textContent('#logList')).replace(/\s+/g,' ').trim().slice(0,110));
  console.log('5. vláknina/sůl:', await p.textContent('#fibTxt'), '|', await p.textContent('#saltTxt'),
              '(86 g rohlíku = 2,4 g vlákniny, 1,1 g soli)');

  // druhá položka do oběda
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]'); await p.fill('#nameQ','nutella');
  await p.click('#nameBtn'); await p.waitForTimeout(700);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
  await p.selectOption('#poMeal','obed'); await p.fill('#poAmt','30');
  await p.click('#poAdd'); await p.waitForTimeout(600);
  const heads = await p.locator('#logList div[style*="margin-bottom:10px"] span').allTextContents();
  console.log('6. skupiny:', heads.filter(t=>t.trim()).map(t=>t.replace(/\s+/g,' ').trim()).join(' | '));

  // --- 3) úprava záznamu
  await p.click('#logList .item .grow >> nth=0'); await p.waitForTimeout(400);
  console.log('7. edit mód:', await p.textContent('#poSub'), '| tlačítko =', await p.textContent('#poAdd'),
              '| množství =', await p.inputValue('#poAmt'));
  await p.fill('#poAmt','150'); await p.selectOption('#poMeal','vecere');
  await p.click('#poAdd'); await p.waitForTimeout(600);
  console.log('8. po úpravě: kcal dne =', await p.textContent('#kcalNow'),
              '| skupiny =', (await p.locator('#logList .item').count()), 'položek');
  console.log('   log:', (await p.textContent('#logList')).replace(/\s+/g,' ').trim().slice(0,150));

  // --- kopie jídla ze včerejška
  const y = await p.evaluate(async () => {
    const d = new Date(); d.setDate(d.getDate()-1);
    const k = d.toISOString().slice(0,10);
    await dbPut('log',{date:k,productId:'x',name:'Ovesná kaše',unit:'g',meal:'snidane',amount:250,
      kcal:320,p:11,c:52,f:6,fib:7,salt:0.1,ts:Date.now()-86400000});
    await dbPut('log',{date:k,productId:'x',name:'Banán',unit:'g',meal:'snidane',amount:120,
      kcal:107,p:1.3,c:27,f:0.4,fib:3.1,salt:0,ts:Date.now()-86400000});
    return k;
  });
  await p.evaluate(()=>copyMeal('snidane')); await p.waitForTimeout(600);
  console.log('9. po kopii snídaně ze', y, ': položek =', await p.locator('#logList .item').count(),
              '| kcal =', await p.textContent('#kcalNow'), '| vláknina =', await p.textContent('#fibTxt'));

  // --- 6) připomínka zálohy
  const warn = await p.evaluate(async () => {
    const all = await dbAll('log');
    for (const r of all) { r.ts = Date.now() - 12*86400000; await dbPut('log', r); }
    await checkBackup();
    return {vis: document.getElementById('bakWarn').style.display !== 'none',
            txt: document.getElementById('bakTxt').textContent};
  });
  console.log('10. banner (nikdy nezálohováno, data 12 dní):', warn.vis, '|', warn.txt);
  const dlp = p.waitForEvent('download');
  await p.click('#bakWarn >> text=Zálohovat'); await dlp; await p.waitForTimeout(500);
  console.log('11. po záloze banner skrytý =', await p.evaluate(()=>document.getElementById('bakWarn').style.display==='none'));
  const warn2 = await p.evaluate(async () => {
    await dbPut('meta',{k:'lastBackup',v:Date.now()-40*86400000}); await checkBackup();
    return document.getElementById('bakTxt').textContent;
  });
  console.log('12. po 40 dnech:', warn2);

  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(600);
  console.log('13. statistiky pořád jedou:', await p.textContent('#stRange'));
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.screenshot({path:PROSTREDI.DIR+'/shot-meals.png', fullPage:true});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
