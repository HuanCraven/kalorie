const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}, permissions:['clipboard-read','clipboard-write']});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(600);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  console.log('1. foto tab visible =', await p.isVisible('#s-photo'));

  // messy answer: text around, code fence, trailing comma, alias keys
  const reply = `Jasně, tady je odhad:

\`\`\`json
{
  "jidlo": "Kuřecí s rýží a salátem",
  "polozky": [
    {"nazev":"Kuřecí prsa grilovaná","mn":150,"kcal":165,"b":31,"s":0,"t":3.6},
    {"nazev":"Rýže dušená","mn":200,"kcal":130,"b":2.7,"s":28,"t":0.3},
    {"nazev":"Olivový olej","mn":10,"kcal":884,"b":0,"s":0,"t":100},
    {"nazev":"Salát okurka+rajče","mn":120,"kcal":18,"b":0.9,"s":3.5,"t":0.2},
  ],
  "pozn": "Množství oleje je odhad, mohlo být víc."
}
\`\`\`

Dej vědět, jestli mám něco upřesnit.`;

  await p.fill('#aiIn', reply);
  await p.click('text=Zpracovat');
  await p.waitForTimeout(400);
  console.log('2. rows =', await p.locator('#aiList .item').count());
  console.log('3. name =', await p.inputValue('#aiName'));
  console.log('4. total =', await p.textContent('#aiTotK'), '|', await p.textContent('#aiTotM'));
  // expect: 247.5 + 260 + 88.4 + 21.6 = 617.5 kcal
  console.log('5. note =', await p.textContent('#aiNote'));

  // edit a quantity: olej 10 -> 20 g  => +88.4 kcal => ~706
  await p.fill('#aiList .item:nth-child(3) input', '20');
  await p.waitForTimeout(200);
  console.log('6. after oil 20g =', await p.textContent('#aiTotK'));

  // delete salad row
  await p.click('#aiList .item:nth-child(4) button');
  await p.waitForTimeout(200);
  console.log('7. after delete rows =', await p.locator('#aiList .item').count(), '=>', await p.textContent('#aiTotK'));

  await p.click('text=Přidat + uložit jako recept');
  await p.waitForTimeout(600);
  console.log('8. day kcal =', await p.textContent('#kcalNow'), '| log rows =', await p.locator('#logList .item').count());

  await p.click('nav button[data-p="db"]');
  await p.waitForTimeout(300);
  console.log('9. db =', await p.textContent('#dbCount'));
  console.log('   entry =', (await p.textContent('#dbList .item .sub')).replace(/\s+/g,' ').trim());

  // reuse recipe with one tap -> portion prefilled with total weight
  await p.click('#dbList .item .grow');
  await p.waitForTimeout(300);
  console.log('10. recipe reuse:', await p.textContent('#poName'), '| porce', await p.inputValue('#poAmt'),
              'g =', await p.textContent('#poK'));
  await p.click('#modPortion >> text=Přidat');
  await p.waitForTimeout(500);
  console.log('11. day kcal after reuse =', await p.textContent('#kcalNow'), '(should be ~2x)');

  // persistence
  await p.reload(); await p.waitForTimeout(800);
  console.log('12. after reload kcal =', await p.textContent('#kcalNow'));

  // bad input handling
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  await p.fill('#aiIn','tohle není json vůbec');
  await p.click('text=Zpracovat'); await p.waitForTimeout(300);
  console.log('13. bad input toast =', await p.textContent('#toast'));

  await p.screenshot({path:PROSTREDI.DIR+'/shot-photo.png', fullPage:true});
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
