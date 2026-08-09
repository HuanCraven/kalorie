const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const fs=require('fs'), os=require('os'), path=require('path');
// pravděpodobné podoby exportu AlcoDroidu i jiných aplikací
const FILES = {
 'a-strednik.csv': 'Datum;Nápoj;Objem (ml);Obsah alkoholu (%)\n2026-07-05;Pivo 12°;500;5,0\n2026-07-06;Víno;200;12,5\n2026-07-28;Panák;40;40\n',
 'b-carka-en.csv': 'date,drink,volume,strength\n2026-07-10,Beer,500,4.5\n2026-07-11,Wine,375,11.5\n',
 'c-datum-teckou.csv': 'Datum a čas;Název;Množství;%\n5.7.2026 20:14;Pivo 11°;1300;4,5\n12.7.2026 19:02;Pivo 10°;500;4,0\n',
 'd-gramy.csv': 'date;drink;alcohol_g\n2026-07-15;Pivo;19.7\n2026-07-16;Víno;19.7\n',
 'e-tab.csv': 'Date\tDrink\tVolume\tABV\n2026-07-20\tBeer\t500\t5\n',
 'f-bez-hlavicky.csv': '2026-07-01;Pivo;500;5\n2026-07-02;Víno;200;12\n'
};
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'alc'));
  for (const [k,v] of Object.entries(FILES)) fs.writeFileSync(path.join(dir,k), v, 'utf8');
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(500);
  await p.click('text=Načíst historii z jiné aplikace (CSV)'); await p.waitForTimeout(300);

  for (const k of Object.keys(FILES)) {
    await p.setInputFiles('#alcCsv', path.join(dir,k)); await p.waitForTimeout(500);
    const t = (await p.textContent('#alcImpRes')).replace(/\s+/g,' ').trim();
    console.log(k+':\n   '+t.slice(0,190));
  }
  // skutečný import prvního souboru
  await p.setInputFiles('#alcCsv', path.join(dir,'a-strednik.csv')); await p.waitForTimeout(500);
  await p.click('text=Importovat do deníku'); await p.waitForTimeout(1200);
  console.log('\nimport:', (await p.textContent('#alcImpRes')).replace(/\s+/g,' ').trim().slice(0,140));
  // 500·0.05·0.789=19.7 ; 200·0.125·0.789=19.7 ; 40·0.4·0.789=12.6 → 52 g
  await p.evaluate(()=>setAddDate('2026-07-28')); await p.waitForTimeout(700);
  const st = await p.evaluate(()=>alcStats());
  console.log('celkem po importu =', st.allSum.toFixed(1), 'g (očekávám 52.0)');
  console.log('7denní ø =', st.avg7.toFixed(2), '| 30denní ø =', st.avg30.toFixed(2));

  // opakovaný import nesmí zdvojit
  await p.setInputFiles('#alcCsv', path.join(dir,'a-strednik.csv')); await p.waitForTimeout(500);
  await p.click('text=Importovat do deníku'); await p.waitForTimeout(1200);
  const st2 = await p.evaluate(()=>alcStats());
  console.log('po druhém importu =', st2.allSum.toFixed(1), 'g (nesmí se změnit)');

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  console.log('\nhlavní stránka:', (await p.textContent('#alcMonth')).trim());
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(600);
  console.log('dlaždice: ø období =', await p.textContent('#alcAvgP'), '| celkem =', await p.textContent('#alcSumP'),
              '| ø'+await p.textContent('#alcMName')+' =', await p.textContent('#alcAM'),
              '| øcelkem =', await p.textContent('#alcAAll'));
  await p.screenshot({path:PROSTREDI.DIR+'/s5-alc.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
