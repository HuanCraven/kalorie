const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const dd = PROSTREDI.den;   // místní datum jako v aplikaci, ne UTC
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(500);
  console.log('1. datum na stránce Alkohol =', await p.inputValue('#alcDate'),
              '| varování skryté =', !(await p.isVisible('#alcDateWarn')),
              '| nadpis =', await p.textContent('#alcListHead'));

  // zpětný zápis rychlým tlačítkem
  await p.fill('#alcDate', dd(-3)); await p.dispatchEvent('#alcDate','change'); await p.waitForTimeout(600);
  console.log('2. po přepnutí: varování =', (await p.textContent('#alcDateWarn')).trim());
  console.log('   nadpis seznamu =', await p.textContent('#alcListHead'));
  await p.click('#drinkBtns button >> nth=1'); await p.waitForTimeout(700);
  console.log('3. toast =', await p.textContent('#toast'));
  console.log('4. záznamů na tom dni =', await p.locator('#alcList .item').count(),
              '| 7d =', await p.textContent('#alc7'));

  // hlavní stránka ukazuje tentýž den
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  console.log('5. hlavní stránka =', await p.textContent('#dayLabel'), '| kcal =', await p.textContent('#kcalNow'),
              '| alk dnes =', await p.textContent('#alcToday'));

  // vlastní nápoj zpětně
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  await p.click('text=+ Jiný nápoj'); await p.waitForTimeout(300);
  console.log('6. okno vlastního nápoje přebírá datum =', await p.inputValue('#dkDate'));
  await p.fill('#dkName','Rum 5 cl'); await p.fill('#dkMl','50'); await p.fill('#dkAbv','40'); await p.fill('#dkC','0');
  await p.fill('#dkDate', dd(-5)); await p.dispatchEvent('#dkDate','change'); await p.waitForTimeout(500);
  console.log('7. změna data v okně přepnula i stránku =', await p.inputValue('#alcDate'));
  await p.click('#dkSave'); await p.waitForTimeout(700);
  console.log('8. toast =', await p.textContent('#toast'),
              '| záznamů =', await p.locator('#alcList .item').count());

  // návrat na dnešek
  await p.click('#p-alc >> text=dnes'); await p.waitForTimeout(700);
  console.log('9. zpět na dnešek: varování skryté =', !(await p.isVisible('#alcDateWarn')),
              '| nadpis =', await p.textContent('#alcListHead'),
              '| záznamů dnes =', await p.locator('#alcList .item').count());
  console.log('10. souhrny: 7d =', await p.textContent('#alc7'), '| 30d =', await p.textContent('#alc30'),
              '(19.7 + 15.8 = 35.5)');

  // editace zpětného nápoje nesmí přesunout datum
  await p.fill('#alcDate', dd(-5)); await p.dispatchEvent('#alcDate','change'); await p.waitForTimeout(600);
  await p.click('#alcList .item .grow'); await p.waitForTimeout(400);
  console.log('11. editor: datum =', await p.inputValue('#dkDate'), '| ml =', await p.inputValue('#dkMl'));
  await p.fill('#dkMl','80'); await p.click('#dkSave'); await p.waitForTimeout(700);
  console.log('12. po úpravě zůstal na svém dni: záznamů =', await p.locator('#alcList .item').count(),
              '| alk =', (await p.textContent('#alcList')).replace(/\s+/g,' ').trim().slice(0,60));

  await p.click('#p-alc >> text=dnes'); await p.waitForTimeout(600);
  await p.screenshot({path:PROSTREDI.DIR+'/s3-alc.png', fullPage:true});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
