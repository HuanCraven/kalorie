const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const SAL={hits:[{_source:{code:'8594001222222',product_name:'Croissant máslový',brands:'Penam',
  countries_tags:['en:czech-republic'],nutriments:{'energy-kcal_100g':392,proteins_100g:7.5,carbohydrates_100g:43,fat_100g:20,fiber_100g:2.1,salt_100g:0.8}}}]};
const d = n => { const x=new Date(); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.route(/search\.openfoodfacts\.org/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SAL)}));
  await p.route(/cgi\/search\.pl/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  // 4) přejmenování
  console.log('1. navigace:', (await p.locator('nav button').allTextContents()).map(t=>t.trim()).join(' · '));

  // 3) rozpis všech jídel na hlavní stránce
  const heads = await p.locator('#logList .mealhead .n').allTextContents();
  console.log('2. jídla na hlavní:', heads.join(' · '));
  console.log('   tlačítek + =', await p.locator('#logList .mealhead .btn.pri').count(),
              '| ⧉ =', await p.locator('#logList .mealhead .btn:not(.pri)').count());

  // + u večeře odkáže na Zadat s předvolbou
  await p.click('#logList div:nth-child(5) .mealhead .btn.pri'); await p.waitForTimeout(500);
  console.log('3. po "+" u večeře: stránka Zadat =', await p.isVisible('#p-scan'),
              '| toast =', await p.textContent('#toast'));
  await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','croissant'); await p.click('#nameBtn'); await p.waitForTimeout(900);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
  console.log('4. předvolené jídlo v panelu =', await p.inputValue('#poMeal'),
              '| datum =', await p.inputValue('#poDate'));
  await p.click('#poAdd'); await p.waitForTimeout(700);
  const veg = await p.locator('#logList div').filter({hasText:'Večeře'}).first().textContent();
  console.log('5. zapsáno do večeře:', veg.replace(/\s+/g,' ').trim().slice(0,80));

  // 2) zápis na jiný den
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(300);
  console.log('6. datum na Zadat =', await p.inputValue('#addDate'), '| varování skryté =',
              !(await p.isVisible('#addDateWarn')));
  await p.fill('#addDate', d(-2)); await p.dispatchEvent('#addDate','change'); await p.waitForTimeout(500);
  console.log('7. po změně data: varování =', (await p.textContent('#addDateWarn')).trim());
  await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','croissant'); await p.click('#nameBtn'); await p.waitForTimeout(900);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
  console.log('8. panel přebírá datum =', await p.inputValue('#poDate'));
  await p.selectOption('#poMeal','obed'); await p.fill('#poAmt','60');
  await p.click('#poAdd'); await p.waitForTimeout(700);
  console.log('9. hlavní stránka ukazuje den =', await p.textContent('#dayLabel'),
              '| kcal =', await p.textContent('#kcalNow'), '(60 g = 235)');
  await p.click('#dayNext'); await p.click('#dayNext'); await p.waitForTimeout(500);
  console.log('10. zpět na dnešek:', await p.textContent('#dayLabel'), '| kcal =', await p.textContent('#kcalNow'),
              '| datum na Zadat se srovnalo =', await p.inputValue('#addDate'));

  // 1) editace nápoje
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  await p.click('#drinkBtns button >> nth=1'); await p.waitForTimeout(600);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  const before = await p.textContent('#kcalNow');
  const rws = await p.locator('#logList .item').allTextContents();
  const di = rws.findIndex(t=>/ml ·/.test(t));          // řádek nápoje, ne jídla
  await p.click(`#logList .item .grow >> nth=${di}`); await p.waitForTimeout(500);
  console.log('11. otevřel se editor nápoje =', await p.textContent('#dkTitle'),
              '| ml =', await p.inputValue('#dkMl'), '| % =', await p.inputValue('#dkAbv'),
              '| sach/100 =', await p.inputValue('#dkC'), '| jídlo =', await p.inputValue('#dkMeal'));
  await p.fill('#dkMl','300'); await p.selectOption('#dkMeal','vecsvac'); await p.waitForTimeout(200);
  console.log('12. přepočet na 300 ml:', await p.textContent('#dkAlc'), '/', await p.textContent('#dkK'));
  await p.click('#dkSave'); await p.waitForTimeout(700);
  console.log('13. kcal dne', before, '→', await p.textContent('#kcalNow'), '(220 → 132)');
  const vs = await p.locator('#logList div').filter({hasText:'Večerní svačina'}).first().textContent();
  console.log('14. přesun do večerní svačiny:', vs.replace(/\s+/g,' ').trim().slice(0,70));

  // editace přednastavených nápojů na stránce Alkohol
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  await p.click('#p-alc summary'); await p.waitForTimeout(300);
  console.log('15. editor tlačítek na stránce Alkohol: řádků =', await p.locator('#drinkEdit .row').count());
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(200);
  console.log('16. v Nastavení už editor není =', (await p.locator('#p-set #drinkEdit').count())===0);

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.screenshot({path:PROSTREDI.DIR+'/s2-day.png', fullPage:true});
  await p.click('nav button[data-p="scan"]'); await p.waitForTimeout(300);
  await p.screenshot({path:PROSTREDI.DIR+'/s2-add.png'});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
