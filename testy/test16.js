const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const CASES = [
['A) čistý JSON', `{"jidlo":"Kuřecí s rýží","polozky":[{"nazev":"Kuřecí prsa","mn":150,"kcal":165,"b":31,"s":0,"t":3.6},{"nazev":"Rýže","mn":200,"kcal":130,"b":2.7,"s":28,"t":0.3}],"pozn":"olej odhad"}`],
['B) JSON v ```bloku s textem okolo', 'Jasně, tady je odhad:\n\n```json\n{"jidlo":"Oběd","polozky":[{"nazev":"Kuřecí prsa","mn":150,"kcal":165,"b":31,"s":0,"t":3.6}]}\n```\n\nDej vědět.'],
['C) JSON s desetinnými ČÁRKAMI', `{"jidlo":"Snídaně","polozky":[{"nazev":"Vejce","mn":120,"kcal":143,"b":12,6,"s":0,7,"t":9,5}]}`.replace('12,6','12,6')],
['D) JSON s českými uvozovkami', `{„jidlo":"X","polozky":[{"nazev":"Chléb","mn":60,"kcal":250,"b":9,"s":49,"t":3}]}`],
['E) markdownová tabulka', `Na fotce vidím kuřecí s rýží. Odhad:

| Surovina | Množství | kcal | Bílkoviny | Sacharidy | Tuky |
|---|---|---|---|---|---|
| Kuřecí prsa grilovaná | 150 g | 248 | 46 | 0 | 5,4 |
| Rýže dušená | 200 g | 260 | 5,4 | 56 | 0,6 |
| Olivový olej | 10 g | 88 | 0 | 0 | 10 |

Celkem zhruba 596 kcal.`],
['F) odrážkový seznam', `Odhaduji takto:

- Kuřecí prsa: 150 g – 248 kcal, B 46 g, S 0 g, T 5,4 g
- Rýže dušená: 200 g – 260 kcal, B 5,4 g, S 56 g, T 0,6 g
- Olivový olej: 10 g – 88 kcal, B 0 g, S 0 g, T 10 g

Dohromady asi 596 kcal.`],
['G) úplně bez čísel (má selhat srozumitelně)', 'Na fotce vidím talíř s kuřecím masem a rýží. Vypadá to jako běžná porce.'],
['H) prázdné pole', '   ']
];
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(800);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  for (const [name, txt] of CASES) {
    await p.evaluate(t => processAI(t), txt); await p.waitForTimeout(350);
    const rows = await p.locator('#aiList .item').count();
    const tot = await p.textContent('#aiTotK'), mac = await p.textContent('#aiTotM');
    const note = (await p.textContent('#aiNote')).trim();
    if (rows) console.log(`${name}\n   ${rows} položek · ${tot} · ${mac}${note?'\n   pozn: '+note.slice(0,80):''}`);
    else console.log(`${name}\n   ✗ ${(await p.textContent('#toast')).trim()} | ${(await p.textContent('#aiList')).replace(/\s+/g,' ').trim().slice(0,110)}`);
  }
  console.log('\nERRORS:', errs.length?errs.join(';'):'none');
  await b.close();
})();
