const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);

  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  console.log('1. výchozí stav:', (await p.textContent('#extInfo')).trim().slice(0,70));
  await p.setInputFiles('#extFile',PROSTREDI.DIR+'/nutri.csv'); await p.waitForTimeout(6000);
  console.log('2. import:', (await p.textContent('#extRes')).replace(/\s+/g,' ').trim().slice(0,230));

  const n = await p.evaluate(async()=>(await dbAll('ext')).length);
  console.log('3. v databázi =', n, 'potravin (očekávám 1136)');

  // kontrola konkrétních hodnot proti CSV
  const chk = await p.evaluate(async()=>{
    const all = await dbAll('ext');
    const f = nm => all.find(x=>x.n===nm);
    return {agar:f('Agar'), ananas:f('Ananas'), amarant:f('Amarant semena')};
  });
  console.log('4. Agar:', JSON.stringify(chk.agar));
  console.log('   CSV:  kcal 336, B 0.6, S 83.4, T 0, vl 0, sůl 0.28');
  console.log('5. Ananas:', JSON.stringify(chk.ananas));
  console.log('   CSV:  kcal 50, B 0.5, S 10.6, T 0.2, vl 2.0, sůl 0');

  // hledání s háčky i bez
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','celer'); await p.waitForTimeout(500);
  const res = (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log('6. hledání "celer":', res.slice(0,150));
  console.log('   obsahuje odznak ČR =', res.includes('ČR'));

  await p.fill('#nameQ','svickova'); await p.waitForTimeout(500);
  console.log('7. "svickova" bez diakritiky:', (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim().slice(0,130));

  // výběr položky z ČR databáze
  const before = await p.evaluate(async()=>(await dbAll('products')).length);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(600);
  console.log('8. otevřen panel:', await p.textContent('#poName'), '|', await p.textContent('#poSub'));
  await p.fill('#poAmt','150'); await p.click('#poAdd'); await p.waitForTimeout(700);
  const after = await p.evaluate(async()=>(await dbAll('products')).length);
  console.log('9. přibyl do mojí databáze =', after===before+1, '| kcal dne =', await p.textContent('#kcalNow'));

  // migrace v2 → v3 a přetrvání
  await p.reload(); await p.waitForTimeout(1500);
  console.log('10. po restartu: verze DB =', await p.evaluate(()=>db.version),
              '| ext v paměti =', await p.evaluate(()=>extFoods.length));
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  console.log('11. info:', (await p.textContent('#extInfo')).trim().slice(0,80));
  console.log('12. panel Info:', (await p.textContent('#infoTxt')).replace(/\s+/g,' ').slice(0,150));

  // záloha obsahuje ext
  const dl = p.waitForEvent('download');
  await p.evaluate(() => setSetMode('data')); await p.click('text=Export zálohy (JSON)');
  const fs=require('fs'); const j=JSON.parse(fs.readFileSync(await (await dl).path(),'utf8'));
  console.log('13. záloha: ext =', (j.ext||[]).length, 'položek | velikost',
              Math.round(fs.statSync(await (await dl).path()).size/1024), 'kB');

  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
