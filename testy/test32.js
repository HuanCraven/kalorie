const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);

  console.log('1. přepínač režimu =', (await p.locator('#modeSeg button').allTextContents()).join(' / '));
  console.log('2. výchozí: pevné pole viditelné =', await p.isVisible('#gKcal'),
              '| dynamické skryté =', !(await p.isVisible('#gDef')));
  await p.click('#modeSeg button[data-m="dyn"]'); await p.waitForTimeout(600);
  console.log('3. po přepnutí: pevné skryté =', !(await p.isVisible('#gKcal')),
              '| dynamické viditelné =', await p.isVisible('#gDef'));
  console.log('   uloženo hned =', await p.evaluate(()=>goals.dyn));
  await p.reload(); await p.waitForTimeout(1000); await p.click('nav button[data-p="set"]');
  console.log('4. po restartu: režim =', await p.evaluate(()=>goals.dyn?'dynamický':'pevný'),
              '| zvýrazněné tlačítko =', await p.locator('#modeSeg button.on').textContent());

  await p.fill('#gRmr','1800'); await p.fill('#gDef','300'); await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]'); await p.fill('#dWeight','84');
  await p.locator('#dWeight').blur(); await p.waitForTimeout(800);
  console.log('5. cíl:', (await p.textContent('#dynLine')).replace(/\s+/g,' ').trim());

  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);
  console.log('6. váha do kalkulačky předvyplněna =', await p.inputValue('#cW'));
  await p.click('#p-set summary'); await p.waitForTimeout(300);
  console.log('7. kalkulačka rozbalitelná =', await p.isVisible('#cAge'));

  // starý týdenní limit se má zahodit
  const g = await p.evaluate(()=>JSON.stringify(goals));
  console.log('8. objekt cílů:', g);
  console.log('   ✓ goals.alc odstraněn =', !g.includes('"alc"'));

  await p.click('#modeSeg button[data-m="fix"]'); await p.waitForTimeout(600);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  console.log('9. zpět na pevné: cíl =', await p.textContent('#kcalGoal'),
              '| řádek s rozpisem skrytý =', !(await p.isVisible('#dynLine')));

  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);
  await p.screenshot({path:PROSTREDI.DIR+'/s12-set.png', fullPage:true});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
