const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  // málo dat → trend musí říct proč
  await p.evaluate(async()=>{ await dbPut('log',{date:dstr(new Date()),productId:'alk',name:'Pivo',
    unit:'ml',meal:'vecere',amount:500,kcal:140,p:0,c:0,f:0,alc:19.7,abv:5,ts:Date.now()}); });
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(700);
  console.log('1. málo dat:', (await p.textContent('#alcTrend')).replace(/\s+/g,' ').trim().slice(0,80));

  // reálná data
  await p.click('text=Načíst historii z jiné aplikace (CSV)'); await p.waitForTimeout(300);
  await p.setInputFiles('#alcCsv',PROSTREDI.DIR+'/alco.bin'); await p.waitForTimeout(900);
  await p.click('text=Importovat do deníku'); await p.waitForTimeout(2500);
  await p.click('nav button[data-p="set"]'); await p.fill('#gAlcDay','20');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.evaluate(()=>setAddDate('2026-07-31')); await p.waitForTimeout(900);
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(900);

  const st = await p.evaluate(async ()=>{ const a = await alcStats();
    a.trend = alcKlouzavy(a.long, 30, a.first); return a; });
  const pts = st.trend.filter(x=>x!==null);
  console.log('2. bodů trendu =', pts.length, '| první =', pts[0].toFixed(2),
              '| poslední =', pts[pts.length-1].toFixed(2), '| ø30 z karty =', st.avg30.toFixed(2));
  console.log('   ✓ poslední bod = 30denní průměr:', Math.abs(pts[pts.length-1]-st.avg30)<0.01);
  console.log('   ✓ začíná až 30 dní po prvním záznamu:',
    st.long.find((d,i)=>st.trend[i]!==null).d, '(první záznam 2026-05-19 → čekám 2026-06-17)');

  console.log('3. trend: čára =', await p.locator('#alcTrend path').count(),
              '| čára limitu =', await p.locator('#alcTrend line[stroke-dasharray]').count(),
              '| popisky osy =', (await p.locator('#alcTrend text').allTextContents()).join(' | '));
  console.log('4. komentář:', (await p.textContent('#alcTrend')).split('Teď')[1].replace(/\s+/g,' ').trim().slice(0,110));
  console.log('5. denní graf: sloupců =', await p.locator('#alcChart rect').count(),
              '| červené =', await p.locator('#alcChart rect[fill="#e0574d"]').count(), '(má být 0)',
              '| čára limitu =', await p.locator('#alcChart line[stroke-dasharray]').count(), '(má být 0)');
  console.log('6. popisek pod sloupci:', (await p.textContent('#alcChart')).split('Osa')[1].replace(/\s+/g,' ').trim().slice(0,100));

  // simulace: měsíc abstinence musí trend stáhnout k nule
  await p.evaluate(()=>setAddDate('2026-08-31')); await p.waitForTimeout(900);
  const st2 = await p.evaluate(async ()=>{ const a = await alcStats();
    a.trend = alcKlouzavy(a.long, 30, a.first); return a; });
  const p2 = st2.trend.filter(x=>x!==null);
  console.log('\n7. po měsíci bez pití (k 31.8.): ø30 =', st2.avg30.toFixed(2),
              '| poslední bod trendu =', p2[p2.length-1].toFixed(2), '(má být 0)');

  await p.evaluate(()=>setAddDate('2026-07-31')); await p.waitForTimeout(800);
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(800);
  await p.screenshot({path:PROSTREDI.DIR+'/s8-alc.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
