const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}, permissions:['clipboard-read','clipboard-write']});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');

  // bez popisu, plné zadání
  let T = await p.evaluate(()=>promptFor('meal'));
  console.log('1. plné zadání:', T.length, 'znaků · obsahuje schéma =', T.includes('"polozky"'),
              '· bez doplňku =', !T.includes('Doplňující'));

  // s popisem
  await p.fill('#photoNote','burek z T Marketu, dlouhý asi 15 cm, vedle je 10Kč mince');
  T = await p.evaluate(()=>promptFor('meal'));
  console.log('2. s popisem: obsahuje popis =', T.includes('10Kč mince'),
              '· uvozeno =', T.includes('Doplňující informace ode mě'));
  console.log('   konec zprávy: …' + T.slice(-95).replace(/\n/g,' ⏎ '));

  // režim projektu
  await p.check('#gProj'); await p.waitForTimeout(500);
  T = await p.evaluate(()=>promptFor('meal'));
  console.log('3. režim projektu:', T.length, 'znaků (místo plných)');
  console.log('   celá zpráva: ' + T.replace(/\n/g,' ⏎ '));
  console.log('4. popis se zachoval =', T.includes('10Kč'));
  const L = await p.evaluate(()=>promptFor('label'));
  console.log('5. etiketa v režimu projektu:', L.replace(/\n/g,' ⏎ '));

  // volba přežije restart
  await p.reload(); await p.waitForTimeout(1000);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  console.log('6. volba přežila restart =', await p.isChecked('#gProj'));
  await p.uncheck('#gProj'); await p.waitForTimeout(400);
  T = await p.evaluate(()=>promptFor('meal'));
  console.log('7. po vypnutí zase plné zadání =', T.includes('"polozky"'));

  // kopírování do schránky
  await p.fill('#photoNote','test popisu');
  await p.click('text=Zkopírovat jen zadání'); await p.waitForTimeout(400);
  const clip = await p.evaluate(()=>navigator.clipboard.readText());
  console.log('8. ve schránce je zadání i popis =', clip.includes('polozky') && clip.includes('test popisu'));

  // popis se po zápisu vyčistí
  await p.fill('#aiIn','{"polozka":"X","hmotnost_g":100,"na_100_g":{"energie_kcal":200,"bilkoviny_g":5,"sacharidy_g":20,"tuky_g":8}}');
  await p.click('#p-scan >> text=Zpracovat'); await p.waitForTimeout(400);
  await p.click('text=Přidat jako jedno jídlo'); await p.waitForTimeout(800);   // přejmenováno v v55
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  console.log('9. po zápisu je popis prázdný =', (await p.inputValue('#photoNote'))==='');
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
