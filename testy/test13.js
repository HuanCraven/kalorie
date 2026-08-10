const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const SAL = {hits:[
 {_source:{code:'8594001222222',product_name:'Croissant máslový',brands:'Penam',
   countries_tags:['en:czech-republic'],nutriments:{'energy-kcal_100g':392,proteins_100g:7.5,carbohydrates_100g:43,fat_100g:20,fiber_100g:2.1,salt_100g:0.8}}}]};
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  let hits=0;
  await p.route(/search\.openfoodfacts\.org/, r=>{hits++; r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SAL)});});
  await p.route(/cgi\/search\.pl/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  // 3) přejmenování + počet záložek
  console.log('1. navigace:', (await p.locator('nav button').allTextContents()).map(t=>t.trim()).join(' · '));

  // 2) alkohol má vlastní stránku, na Dnes jen souhrn
  console.log('2. Dnes: tlačítka nápojů =', await p.locator('#p-day #drinkBtns button').count(),
              '| souhrnný proužek =', await p.isVisible('#p-day #alcToday'));
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(600);
  console.log('3. Alkohol: tlačítek =', await p.locator('#p-alc #drinkBtns button').count(),
              '| 7d karta =', await p.textContent('#alc7'), '| graf sloupců =', await p.locator('#alcChart div').count());
  await p.click('#p-alc #drinkBtns button >> nth=1'); await p.waitForTimeout(700);
  console.log('4. po zápisu piva: dnes v seznamu =', await p.locator('#alcList .item').count(),
              '| 7d =', await p.textContent('#alc7'));
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  console.log('5. Dnes proužek:', await p.textContent('#alcToday'), 'g |', await p.textContent('#alcWeek'),
              '| kcal =', await p.textContent('#kcalNow'));
  await p.click('#p-day .card.compact'); await p.waitForTimeout(400);
  console.log('6. klepnutí na proužek otevře Alkohol =', await p.isVisible('#p-alc'));

  // podzáložky v Zadat
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(300);
  const vis = async () => (await Promise.all(['code','find','photo','man'].map(async k =>
    (await p.isVisible('#s-'+k)) ? k : null))).filter(Boolean).join(',');
  console.log('7. výchozí podzáložka =', await vis(), '| segmentů =', await p.locator('#addSeg button').count());
  await p.click('#addSeg button[data-s="photo"]'); await p.waitForTimeout(250);
  console.log('8. po přepnutí na Foto =', await vis(), '| tlačítko Vyfotit =', await p.isVisible('text=📷 Vyfotit'));
  await p.evaluate(() => setAdd('man')); await p.waitForTimeout(250);
  console.log('9. Ručně =', await vis(), '| tlačítko =', await p.isVisible('text=+ Zadat potravinu ručně'));

  // 1) našeptávání
  await p.click('#addSeg button[data-s="find"]'); await p.waitForTimeout(250);
  await p.locator('#nameQ').type('cro', {delay:60});
  await p.waitForTimeout(200);
  console.log('10. hned po psaní (bez čekání):', (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim().slice(0,60));
  await p.waitForTimeout(1200);
  console.log('11. po debounce: výsledků =', await p.locator('#nameRes .item').count(),
              '| dotazů na server =', hits);
  // rychlé psaní nesmí vyslat dotaz na každé písmeno
  hits = 0;
  await p.fill('#nameQ',''); await p.locator('#nameQ').type('croissant', {delay:40});
  await p.waitForTimeout(1400);
  console.log('12. po napsání 9 znaků: dotazů =', hits, '(má být 1)');
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
  console.log('13. výběr z našeptávače:', await p.textContent('#poName'));
  await p.click('#modPortion >> text=Přidat'); await p.waitForTimeout(600);
  console.log('14. přidáno, kcal dne =', await p.textContent('#kcalNow'));

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.screenshot({path:PROSTREDI.DIR+'/s-day.png', fullPage:true});
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(500);
  await p.screenshot({path:PROSTREDI.DIR+'/s-alc.png', fullPage:true});
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(300);
  await p.screenshot({path:PROSTREDI.DIR+'/s-add.png', fullPage:true});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
