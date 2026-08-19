const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(700);

  // --- naseed 30 dní dat přímo do IndexedDB (deterministicky)
  const seeded = await p.evaluate(async () => {
    const today = new Date(); const ds = dstr;
    const day = i => { const x = new Date(today); x.setDate(x.getDate()-i); return ds(x); };
    // cíl 2000 kcal, rmr 1750
    goals = {kcal:2000,p:130,c:220,f:65,alc:0,rmr:1750};
    await dbPut('meta',{k:'goals',v:goals});
    let start=82.0;
    for(let i=29;i>=0;i--){
      const d = day(i);
      if(i===7) continue;                      // jeden den bez záznamu
      const kcal = 1800 + ((i*137)%400);       // 1800–2200
      await dbPut('log',{date:d,productId:'x',name:'Jídlo '+(i%4),unit:'g',amount:400,
        kcal, p:0.28*kcal/4, c:0.42*kcal/4, f:0.30*kcal/9, ts:Date.now()-i*86400000});
      const rec = {date:d, burn: 300 + ((i*53)%400)};
      if(i%3===0) rec.weight = +(start - (29-i)*0.0167).toFixed(1);  // ~ -0.5 kg za 30 dní
      await dbPut('daily', rec);
    }
    // dva dny s alkoholem
    await dbPut('log',{date:day(2),productId:'alk',name:'Pivo 12° 0,5 l',unit:'ml',amount:500,
      kcal:220,p:0,c:20,f:0,alc:19.7,abv:5,ts:Date.now()});
    await dbPut('log',{date:day(9),productId:'alk',name:'Víno 2 dl',unit:'ml',amount:200,
      kcal:145,p:0,c:1.2,f:0,alc:19.7,abv:12.5,ts:Date.now()});
    return 'ok';
  });
  console.log('0. seed =', seeded);
  await p.reload(); await p.waitForTimeout(900);

  console.log('1. nav položek =', await p.locator('nav button').count(),
              '|', (await p.locator('nav button').allTextContents()).join(' '));
  console.log('2. dnes: bilance =', await p.textContent('#balVal'), '|', await p.textContent('#balExp'));

  await p.click('nav button[data-p="stats"]');
  await p.waitForTimeout(700);
  console.log('3. rozsah:', await p.textContent('#stRange'));
  console.log('4. karty: příjem', await p.textContent('#stKcal'),
              '| výdej', await p.textContent('#stBurn'), '| bilance', await p.textContent('#stBal'));
  console.log('5. pokrytí:', await p.textContent('#stCover'));

  await p.click('#per30'); await p.waitForTimeout(700);
  console.log('6. 30 dní:', await p.textContent('#stRange'));
  console.log('   příjem', await p.textContent('#stKcal'), '| výdej', await p.textContent('#stBurn'),
              '| bilance', await p.textContent('#stBal'));
  console.log('7. váha:', (await p.textContent('#stWeightTxt')).replace(/\s+/g,' ').trim());
  console.log('8. grafy: sloupců příjmu =', await p.locator('#chKcal rect').count(),
              '| čára výdeje =', await p.locator('#chKcal path').count(),
              '| váha čára =', await p.locator('#chWeight path').count(),
              '| body =', await p.locator('#chWeight circle').count());
  console.log('9. makra:', (await p.textContent('#stMacros')).replace(/\s+/g,' ').trim().slice(0,150));
  const ins = await p.locator('#stInsights p').allTextContents();
  console.log('10. postřehy ('+ins.length+'):'); ins.forEach(t=>console.log('    • '+t.replace(/\s+/g,' ')));
  console.log('11. top zdroje =', await p.locator('#stTop .item').count());

  await p.click('#chKcal rect >> nth=5'); await p.waitForTimeout(200);
  console.log('12. detail sloupce:', await p.textContent('#stTipTxt'));

  const sum = await p.evaluate(()=>summaryText());
  console.log('13. souhrn ('+sum.length+' znaků):\n---\n'+sum.split('\n').slice(0,22).join('\n')+'\n---');

  // od v50 jsou ruční varianty schované pod rozbalovacím „Radši ručně, bez API klíče"
  await p.click('text=Radši ručně, bez API klíče'); await p.waitForTimeout(200);
  const dlp = p.waitForEvent('download');
  await p.click('text=Stáhnout jako soubor');
  console.log('14. soubor =', (await dlp).suggestedFilename());

  // BMR kalkulačka
  await p.click('nav button[data-p="set"]');
  await p.click('#p-set summary');
  await p.fill('#cAge','40'); await p.fill('#cH','180'); await p.fill('#cW','82');
  await p.click('text=Spočítat a doplnit'); await p.waitForTimeout(200);
  console.log('15. BMR muž 40/180/82 =', await p.inputValue('#gRmr'), '(očekávám 1770)');

  // záloha musí obsahovat daily
  const dlp2 = p.waitForEvent('download');
  await p.evaluate(() => setSetMode('data')); await p.click('text=Export zálohy (JSON)');
  const fs=require('fs'); const j=JSON.parse(fs.readFileSync(await (await dlp2).path(),'utf8'));
  console.log('16. záloha: v='+j.v, 'daily záznamů =', (j.daily||[]).length, '| log =', j.log.length);

  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(600);
  await p.screenshot({path:PROSTREDI.DIR+'/shot-stats.png', fullPage:true});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
