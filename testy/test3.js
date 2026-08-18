const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const A = (n)=>Math.round(n*10)/10;
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(700);

  // ---- ALKOHOL ----
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  const btns = await p.locator('#drinkBtns button').allTextContents();
  console.log('1. přednastavené:', btns.map(t=>t.replace(/\s+/g,' ').trim()).join(' | '));
  // pivo 12°: 500*0.05*0.789 = 19.7 g ; kcal = 19.7*7.1 + 20*4 = 140+80 = 220
  await p.click('#drinkBtns button >> nth=1');
  await p.waitForTimeout(400);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  console.log('2. po pivu 12°: alk dnes =', await p.textContent('#alcToday'),
              'g | kcal dnes =', await p.textContent('#kcalNow'), '| sach =', await p.textContent('#cTxt'));
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(300);
  await p.click('#drinkBtns button >> nth=3');  // panák 40ml 40% = 12.6 g, 89.6 kcal
  await p.waitForTimeout(400);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.waitForTimeout(400);
  console.log('3. + panák: alk =', await p.textContent('#alcToday'), '| kcal =', await p.textContent('#kcalNow'));
  console.log('4. log řádek:', (await p.textContent('#logList .item .sub')).replace(/\s+/g,' ').trim());
  console.log('5. týden:', await p.textContent('#alcWeek'));

  // vlastní nápoj
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(300);
  await p.click('text=+ Jiný nápoj');
  await p.fill('#dkName','Gin tonic'); await p.fill('#dkMl','250'); await p.fill('#dkAbv','8'); await p.fill('#dkC','7');
  await p.waitForTimeout(200);
  console.log('6. vlastní: ', await p.textContent('#dkAlc'), '/', await p.textContent('#dkK'),
              '(očekávám 15.8 g / 182 kcal)');
  await p.click('text=Zapsat a uložit mezi tlačítka');
  await p.waitForTimeout(500);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(300);
  console.log('7. tlačítek nyní =', await p.locator('#drinkBtns button').count(),
              '| alk celkem =', await p.textContent('#alcToday'));

  // limit
  await p.click('nav button[data-p="set"]');
  await p.fill('#gAlcDay','15');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]');
  await p.waitForTimeout(200);
  console.log('8. s limitem:', await p.textContent('#alcWeek'), '|', await p.textContent('#alcMonth'));

  // přehled je nově součástí stránky Alkohol
  await p.click('nav button[data-p="alc"]');
  await p.waitForTimeout(600);
  console.log('9. přehled: 7d =', await p.textContent('#alc7'), '| 30d =', await p.textContent('#alc30'),
              '| dní bez =', await p.textContent('#alcDry'),
              '| sloupců =', await p.locator('#alcChart rect').count(),
              '| dnešních záznamů =', await p.locator('#alcList .item').count());

  // ---- ETIKETA ----
  await p.click('nav button[data-p="scan"]');
  await p.evaluate(() => setAdd('man'));
  await p.click('text=+ Zadat potravinu ručně');
  await p.evaluate(t => processLabel(t), 'Tady je přepis:\n```json\n{"nazev":"Tvaroh polotučný","znacka":"Madeta","jed":"g","kcal":0,"b":12.5,"s":3.8,"t":4.5,"vlaknina":0,"sul":0.1,"porce":250}\n```\nkJ bylo 431, tedy 103 kcal.');
  await p.waitForTimeout(400);
  console.log('10. etiketa ->', await p.inputValue('#edName'), '/', await p.inputValue('#edBrand'),
              '| B', await p.inputValue('#edP'), 'S', await p.inputValue('#edC'), 'T', await p.inputValue('#edF'),
              '| sůl', await p.inputValue('#edSalt'), '| porce', await p.inputValue('#edServ'),
              '| kcal(0 => nepřepsáno)', JSON.stringify(await p.inputValue('#edKcal')));
  await p.fill('#edKcal','103');
  await p.click('#modEdit >> text=Uložit');
  await p.waitForTimeout(400);
  console.log('11. po uložení porce prefill =', await p.inputValue('#poAmt'), '=>', await p.textContent('#poK'));
  await p.click('#modPortion >> text=Zrušit');

  // ml varianta
  await p.evaluate(() => setAdd('man'));
  await p.click('text=+ Zadat potravinu ručně');
  await p.evaluate(t => processLabel(t), '{"nazev":"Mléko 1,5%","jed":"ml","kcal":47,"b":3.4,"s":4.8,"t":1.5}');
  await p.waitForTimeout(300);
  console.log('12. ml varianta: jednotka =', await p.inputValue('#edUnit'), '| kcal =', await p.inputValue('#edKcal'));
  await p.click('#modEdit >> text=Zrušit');

  // persistence + export
  await p.reload(); await p.waitForTimeout(900);
  console.log('13. po reloadu: alk =', await p.textContent('#alcToday'),
              '| kcal =', await p.textContent('#kcalNow'),
              '| tlačítek =', await p.locator('#drinkBtns button').count());

  const dlp = p.waitForEvent('download');
  await p.click('nav button[data-p="set"]'); await p.evaluate(() => setSetMode('data')); await p.click('text=Export deníku (CSV)');
  const d = await dlp; const fs=require('fs');
  const path = await d.path(); console.log('14. CSV:\n' + fs.readFileSync(path,'utf8').split('\n').slice(0,4).join('\n'));

  await p.click('nav button[data-p="day"]');
  await p.screenshot({path:PROSTREDI.DIR+'/shot-day2.png', fullPage:true});
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(500);
  await p.screenshot({path:PROSTREDI.DIR+'/shot-alc.png'});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
