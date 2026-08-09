const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const HIT = {hits:[{_source:{code:'4000123456789',product_name:'Schinken gekocht',brands:'Wiltmann',
  countries_tags:['en:germany'],nutriments:{'energy-kcal_100g':112,proteins_100g:18.5,carbohydrates_100g:1.0,fat_100g:3.8}}},
 {_source:{code:'4000987654321',product_name:'Schinkenwurst',brands:'Gutfried',countries_tags:['en:germany'],
  nutriments:{'energy-kcal_100g':230,proteins_100g:13,carbohydrates_100g:1.5,fat_100g:19}}}]};

async function run(name, handler, opts={}) {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let calls=0, aborted=0;
  await p.route(/search\.openfoodfacts\.org/, async r => { calls++; await handler(r, calls); });
  await p.route(/cgi\/search\.pl/, r=>r.abort());
  p.on('requestfailed', r=>{ if(/search\.openfoodfacts/.test(r.url())) aborted++; });
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  if (opts.cz===false) await p.uncheck('#czOnly');
  if (opts.paste) { await p.fill('#nameQ','schinken'); }
  else { await p.locator('#nameQ').type('schinken', {delay: opts.delay||250}); }
  await p.click('#nameBtn');
  await p.waitForTimeout(opts.wait||4500);
  if (opts.retry) { await p.click('text=Zkusit znovu'); await p.waitForTimeout(2500); }
  const txt = (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log(`${name}\n   dotazů na server: ${calls} | zrušeno: ${aborted}\n   ${txt.slice(0,170)}`);
  if (errs.length) console.log('   PAGEERROR:', errs.join(';'));
  await b.close();
  return calls;
}
(async () => {
  const ok = r => r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(HIT)});
  await run('A) pomalé psaní po písmenech (250 ms)', ok);
  await run('B) vložení celého slova', ok, {paste:true});
  await run('C) 429 → hláška + ruční Zkusit znovu uspěje', async (r,n) => {
    if (n===1) return r.fulfill({status:429,body:'rate limit'});
    return ok(r);
  }, {paste:true, wait:3000, retry:true});
  await run('D) server padá pořád', r=>r.fulfill({status:500,body:'err'}), {paste:true, wait:8000});
  await run('E) filtr ČR zapnutý, výsledky německé', ok, {paste:true});
  console.log('\nhotovo');
})();
// dodatek: pauza uprostřed slova = dva dotazy, první se musí zrušit
const { chromium: ch2 } = require('playwright');
(async () => {
  await new Promise(r=>setTimeout(r,1000));
  const b = await ch2.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  let calls=0; const seen=[];
  await p.route(/search\.openfoodfacts\.org/, async r => {
    calls++; const q=decodeURIComponent((r.request().url().match(/[?&]q=([^&]*)/)||[])[1]||''); seen.push(q);
    await new Promise(x=>setTimeout(x, q.length<5 ? 3000 : 200));   // krátký dotaz je pomalý
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(
      {hits:[{_source:{code:'1',product_name:'Výsledek pro '+q,brands:'X',
        nutriments:{'energy-kcal_100g':100,proteins_100g:1,carbohydrates_100g:1,fat_100g:1}}}]})});
  });
  await p.route(/cgi\/search\.pl/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.uncheck('#czOnly');
  await p.fill('#nameQ','sch'); await p.click('#nameBtn');
  await p.waitForTimeout(400);                     // pomalý dotaz "sch" ještě běží
  await p.fill('#nameQ','schinken'); await p.click('#nameBtn');
  await p.waitForTimeout(4000);
  console.log('\nF) druhé hledání během prvního');
  console.log('   dotazy na server:', JSON.stringify(seen));
  console.log('   zobrazeno:', (await p.textContent('#nameRes')).replace(/\s+/g,' ').trim().slice(0,120));
  console.log('   ✓ pomalý dotaz "sch" nepřebil výsledek pro "schinken":',
    (await p.textContent('#nameRes')).includes('schinken'));
  await b.close();
})();
