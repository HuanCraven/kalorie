const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const ROLL = `{"jidlo":"Sýrová rolka (burek), T Market","polozky":[{"nazev":"Listové těsto pečené","mn":150,"kcal":390,"b":6.5,"s":36,"t":24},{"nazev":"Sýr sirene (bílý sýr)","mn":65,"kcal":260,"b":16,"s":1.5,"t":21},{"nazev":"Vejce na potření","mn":10,"kcal":143,"b":12.6,"s":0.7,"t":9.5}],"pozn":"Hmotnost odhadnuta podle mince."}`;
const LABELS = [
 ['a) čistý JSON', '{"nazev":"Sýrová rolka","znacka":"T Market","jed":"g","kcal":341,"b":9.5,"s":24,"t":22.5,"vlaknina":1.2,"sul":1.4,"porce":225}'],
 ['b) JSON s čárkami', '{"nazev":"Rolka","kcal":341,"b":9,5,"s":24,"t":22,5}'],
 ['c) volný text z etikety', `Na obalu je uvedeno na 100 g:
Energie: 1428 kJ / 341 kcal
Tuky: 22,5 g
Sacharidy: 24 g
Bílkoviny: 9,5 g
Sůl: 1,4 g`],
 ['d) jen kJ', 'Energie 1428 kJ, bílkoviny 9,5 g, sacharidy 24 g, tuky 22,5 g'],
 ['e) nesmysl', 'Na fotce je rozmazaná etiketa, nic nepřečtu.']
];
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(800);

  // reálný případ: rolka přes foto jídla
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  await p.evaluate(t => processAI(t), ROLL); await p.waitForTimeout(400);
  console.log('1. rolka:', await p.locator('#aiList .item').count(), 'položky ·',
              await p.textContent('#aiTotK'), '·', await p.textContent('#aiTotM'));
  await p.fill('#aiName','Sýrová rolka T Market');
  await p.click('text=Přidat + uložit jako recept'); await p.waitForTimeout(700);
  console.log('2. zapsáno, kcal dne =', await p.textContent('#kcalNow'));
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(300);
  console.log('3. uloženo jako recept:', (await p.textContent('#dbList')).replace(/\s+/g,' ').trim().slice(0,90));

  // varování o sdílení
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  console.log('4. varování o sdílení viditelné =', await p.isVisible('text=Důležité'));

  // parser etikety
  await p.evaluate(() => setAdd('man')); await p.click('text=+ Zadat potravinu ručně');
  for (const [nm, txt] of LABELS) {
    await p.fill('#edKcal',''); await p.fill('#edP',''); await p.fill('#edC',''); await p.fill('#edF','');
    await p.fill('#edSalt',''); await p.evaluate(t => processLabel(t), txt);
    await p.waitForTimeout(350);
    console.log(`${nm}: kcal=${await p.inputValue('#edKcal')} B=${await p.inputValue('#edP')} `+
      `S=${await p.inputValue('#edC')} T=${await p.inputValue('#edF')} sůl=${await p.inputValue('#edSalt')}`+
      ` | ${(await p.textContent('#toast')).trim()}`);
  }
  console.log('\nERRORS:', errs.length?errs.join(';'):'none');
  await b.close();
})();
