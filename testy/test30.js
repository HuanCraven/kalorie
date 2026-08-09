const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);

  // nastav klidový výdej a váhu
  await p.click('nav button[data-p="set"]');
  await p.fill('#gRmr','1800'); await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]');
  await p.fill('#dWeight','84'); await p.locator('#dWeight').blur(); await p.waitForTimeout(700);
  console.log('1. pevný režim: cíl =', await p.textContent('#kcalGoal'),
              '| vysvětlivka skrytá =', !(await p.isVisible('#dynLine')));

  // zapni dynamické cíle
  await p.click('nav button[data-p="set"]');
  await p.click('#modeSeg button[data-m="dyn"]'); await p.waitForTimeout(600);
  await p.fill('#gDef','400'); await p.fill('#gPKg','2.0'); await p.fill('#gFKg','0.9');
  await p.waitForTimeout(900);   // autosave (v40)
  console.log('2. nápověda:', (await p.textContent('#dynHint')).replace(/\s+/g,' ').trim().slice(0,120));

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(700);
  console.log('3. bez pohybu:', (await p.textContent('#dynLine')).replace(/\s+/g,' ').trim());
  console.log('   cíl =', await p.textContent('#kcalGoal'), '(1800 − 400 = 1400)');
  console.log('   B/S/T cíle:', await p.textContent('#pTxt'), '|', await p.textContent('#cTxt'), '|', await p.textContent('#fTxt'));
  console.log('   kontrola: B 2.0·84=168 · T 0.9·84=76 · S (1400−604−684)/4 = ' + ((1400-4*168-9*76)/4).toFixed(0));

  // den se zátěží
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(300);
  await p.fill('#dBurn','900'); await p.locator('#dBurn').blur(); await p.waitForTimeout(900);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  console.log('4. po 900 kcal pohybu:', (await p.textContent('#dynLine')).replace(/\s+/g,' ').trim());
  console.log('   cíl =', await p.textContent('#kcalGoal'), '(1800+900−400 = 2300)');
  console.log('   B/S/T:', await p.textContent('#pTxt'), '|', await p.textContent('#cTxt'), '|', await p.textContent('#fTxt'));
  console.log('   ✓ B a T se nezměnily, S vzrostly o 900/4 = 225 g');

  // vyšší váha → víc bílkovin
  await p.fill('#dWeight','90'); await p.locator('#dWeight').blur(); await p.waitForTimeout(900);
  console.log('5. při 90 kg:', await p.textContent('#pTxt'), '(2.0·90 = 180)');

  // přepnutí zpět
  await p.click('nav button[data-p="set"]'); await p.click('#modeSeg button[data-m="fix"]'); await p.waitForTimeout(700);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  console.log('6. zpět na pevné: cíl =', await p.textContent('#kcalGoal'),
              '| vysvětlivka skrytá =', !(await p.isVisible('#dynLine')));

  // bez klidového výdeje nesmí spadnout
  await p.click('nav button[data-p="set"]'); await p.click('#modeSeg button[data-m="dyn"]'); await p.fill('#gRmr','');
  await p.waitForTimeout(900);   // autosave (v40)
  console.log('7. bez klidového výdeje:', (await p.textContent('#dynHint')).replace(/\s+/g,' ').trim().slice(0,90));
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  console.log('   aplikace běží, cíl =', await p.textContent('#kcalGoal'));

  await p.click('nav button[data-p="set"]'); await p.fill('#gRmr','1800');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(700);
  await p.screenshot({path:PROSTREDI.DIR+'/s11-day.png'});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
