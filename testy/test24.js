const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  // migrace starého týdenního limitu 140 g → 20 g/den
  await p.evaluate(async ()=>{
    await dbPut('meta',{k:'goals',v:{kcal:2000,p:130,c:220,f:65,alc:140,rmr:1800,fib:30,salt:5}});
  });
  await p.reload(); await p.waitForTimeout(1100);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  console.log('1. migrace 140 g/týden → ', await p.inputValue('#gAlcDay'), 'g/den (očekávám 20)');

  // naimportuj skutečná data
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  await p.click('text=Načíst historii z jiné aplikace (CSV)'); await p.waitForTimeout(300);
  await p.setInputFiles('#alcCsv',PROSTREDI.DIR+'/alco.bin'); await p.waitForTimeout(900);
  await p.click('text=Importovat do deníku'); await p.waitForTimeout(2500);
  await p.evaluate(()=>setAddDate('2026-07-31')); await p.waitForTimeout(900);

  const st = await p.evaluate(()=>alcStats());
  console.log('2. ø30 =', st.avg30.toFixed(2), '| limit =', st.lim,
              '| rozpočet 30×20=600, vyčerpáno', st.d30.toFixed(0), '→ zbývá', st.budget.toFixed(0));
  console.log('   kontrola:', Math.abs(st.budget-(st.lim*30-st.d30))<0.01 ? '✓ sedí' : '✗');

  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(800);
  console.log('3. pruh limitu:', (await p.textContent('#alcLimitBar')).replace(/\s+/g,' ').trim().slice(0,175));
  console.log('4. graf: sloupců =', await p.locator('#alcChart rect').count(),
              '| popisků osy =', await p.locator('#alcChart text').count(),
              '| čára limitu =', await p.locator('#alcChart line[stroke-dasharray]').count());
  const axis = await p.locator('#alcChart text').allTextContents();
  console.log('   popisky:', axis.join(' | '));
  console.log('5. legenda:', (await p.textContent('#alcChart')).split('svislá')[0].replace(/\s+/g,' ').trim().slice(-95));

  // vysoký limit → zbývá hodně, v pivech
  await p.click('nav button[data-p="set"]'); await p.fill('#gAlcDay','40');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(800);
  console.log('\n6. při limitu 40 g/den:', (await p.textContent('#alcLimitBar')).replace(/\s+/g,' ').trim().slice(0,170));

  // limit 0 → schované
  await p.click('nav button[data-p="set"]'); await p.fill('#gAlcDay','0');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(800);
  console.log('7. bez limitu:', (await p.textContent('#alcLimitBar')).trim().slice(0,60));
  console.log('   graf bez čáry limitu =', (await p.locator('#alcChart line[stroke-dasharray]').count())===0,
              '| sloupce jednobarevné =', (await p.locator('#alcChart rect[fill="#e0574d"]').count())===0);

  await p.click('nav button[data-p="set"]'); await p.fill('#gAlcDay','20');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(700);
  console.log('\n8. hlavní stránka:', (await p.textContent('#alcWeek')).trim(), '·',
              (await p.textContent('#alcMonth')).trim());
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(800);
  await p.screenshot({path:PROSTREDI.DIR+'/s7-alc.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
