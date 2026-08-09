const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(500);
  await p.click('text=Načíst historii z jiné aplikace (CSV)'); await p.waitForTimeout(300);

  await p.setInputFiles('#alcCsv', PROSTREDI.DIR+'/alco.bin'); await p.waitForTimeout(900);
  console.log('NÁHLED:\n  '+(await p.textContent('#alcImpRes')).replace(/\s+/g,' ').trim().slice(0,260));

  await p.click('text=Importovat do deníku'); await p.waitForTimeout(2500);
  console.log('\nIMPORT: '+(await p.textContent('#alcImpRes')).replace(/\s+/g,' ').trim().slice(0,120));

  const n = await p.evaluate(async()=>(await dbAll('log')).filter(r=>r.alc).length);
  console.log('záznamů v deníku =', n, '(očekávám 47)');

  await p.evaluate(()=>setAddDate('2026-07-31')); await p.waitForTimeout(900);
  const st = await p.evaluate(()=>alcStats());
  console.log('\nk 31.7.2026: celkem =', st.allSum.toFixed(1), 'g za', st.allDays, 'dní',
              '| ø celkem =', st.avgAll.toFixed(2), '(python dal 1742.9 g / 74 dní = 23.55)');
  console.log('ø 7 dní =', st.avg7.toFixed(2), '| ø 30 dní =', st.avg30.toFixed(2),
              '| ø červenec =', st.avgM.toFixed(2), '(', st.mSum.toFixed(0), 'g /', st.mDays, 'dní )');

  // kontrola jednoho konkrétního dne: 31.7. Pivo 11° 1300 ml 4,5 % = 46.16 g
  const rows = await p.evaluate(async()=>(await dbByIdx('log','date','2026-07-31')).filter(r=>r.alc)
    .map(r=>({n:r.name,ml:r.amount,abv:r.abv,g:+r.alc.toFixed(2),meal:r.meal,
              cas:new Date(r.ts).toTimeString().slice(0,5)})));
  console.log('\n31.7.:', JSON.stringify(rows));

  // 19.5. Víno 750 ml 12 % = 71.01 g, ve 21:30 → večerní svačina
  await p.evaluate(()=>setAddDate('2026-05-19')); await p.waitForTimeout(700);
  const r1 = await p.evaluate(async()=>(await dbByIdx('log','date','2026-05-19')).filter(r=>r.alc)
    .map(r=>({n:r.name,ml:r.amount,g:+r.alc.toFixed(2),meal:r.meal,cas:new Date(r.ts).toTimeString().slice(0,5)})));
  console.log('19.5.:', JSON.stringify(r1));

  // opakovaný import
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  await p.setInputFiles('#alcCsv', PROSTREDI.DIR+'/alco.bin'); await p.waitForTimeout(900);
  await p.click('text=Importovat do deníku'); await p.waitForTimeout(2500);
  const n2 = await p.evaluate(async()=>(await dbAll('log')).filter(r=>r.alc).length);
  console.log('\npo druhém importu =', n2, 'záznamů (nesmí přibýt)');
  console.log('hláška:', (await p.textContent('#alcImpRes')).replace(/\s+/g,' ').trim().slice(0,110));

  await p.evaluate(()=>setAddDate('2026-07-31')); await p.waitForTimeout(700);
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(700);
  await p.screenshot({path:PROSTREDI.DIR+'/s6-alc.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
