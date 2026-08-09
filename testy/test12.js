const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const SAL = {hits:[
 {_source:{code:'3123210000000',product_name:'Croissant au beurre',brands:'Carrefour',
   countries_tags:['en:france'],nutriments:{'energy-kcal_100g':406,proteins_100g:8.2,carbohydrates_100g:45,fat_100g:21,fiber_100g:2.3,salt_100g:0.9}}},
 {_source:{code:'8594001222222',product_name:'Croissant máslový',brands:'Penam',
   countries_tags:['en:czech-republic'],nutriments:{'energy-kcal_100g':392,proteins_100g:7.5,carbohydrates_100g:43,fat_100g:20,fiber_100g:2.1,salt_100g:0.8}}},
 {_source:{code:'9999999999999',product_name:'Bez dat',nutriments:{}}}
]};
const LEG = {products:[
 {code:'8594001333333',product_name:'Croissant čokoládový',brands:'Albert',
  countries_tags:['en:czech-republic'],nutriments:{'energy-kcal_100g':430,proteins_100g:7,carbohydrates_100g:50,fat_100g:22}}
]};
async function scenario(name, routes, opts={}) {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  for (const [re, h] of routes) await p.route(re, h);
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(700);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  if (opts.cz === false) await p.uncheck('#czOnly');
  await p.fill('#nameQ','croissant'); await p.click('#nameBtn');
  await p.waitForTimeout(1500);
  const items = await p.locator('#nameRes .item').count();
  const txt = (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log(`${name}\n   položek=${items} | ${txt.slice(0,170)}`);
  if (items && !opts.noAdd) {
    await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
    console.log('   → otevřen:', await p.textContent('#poName'));
  }
  if (errs.length) console.log('   PAGEERROR:', errs.join(';'));
  await b.close();
}
(async () => {
  const ok  = [[/search\.openfoodfacts\.org/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SAL)})]];
  const dead= [[/search\.openfoodfacts\.org/, r=>r.abort('failed')]];
  const cors= [[/search\.openfoodfacts\.org/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SAL)})]];
  const leg = [[/cgi\/search\.pl/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(LEG)})]];
  const legDead=[[/cgi\/search\.pl/, r=>r.abort('failed')]];

  await scenario('A) moderní endpoint funguje, filtr CZ zapnutý', ok.concat(legDead));
  await scenario('B) totéž, filtr CZ vypnutý (CZ má být první)', ok.concat(legDead), {cz:false});
  await scenario('C) moderní nedostupný → záloha na starý', dead.concat(leg));
  await scenario('D) oba nedostupné → konkrétní hláška', dead.concat(legDead), {noAdd:true});
  await scenario('E) moderní vrátí HTTP 500 → záloha', [[/search\.openfoodfacts\.org/,r=>r.fulfill({status:500,body:'err'})]].concat(leg));
})();
