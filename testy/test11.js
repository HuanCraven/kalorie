const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1200);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  console.log('1. verze v UI =', await p.textContent('#verNow'));
  console.log('2. info řádek =', (await p.textContent('#infoTxt')).split('Skener')[0]);

  // a) shoda verzí
  await p.evaluate(() => setSetMode('data')); await p.click('text=Zkontrolovat aktualizaci'); await p.waitForTimeout(900);
  console.log('3. shoda:', await p.textContent('#updMsg'));

  // b) na serveru je novější -> musí odregistrovat SW, smazat cache a reloadnout
  await p.route(/index\.html\?nosw=/, r => r.fulfill({status:200,contentType:'text/html',
    body:"<script>const APP_VERSION = '2026.09.09-99';</script>"}));
  const before = await p.evaluate(async()=>({sw:(await navigator.serviceWorker.getRegistrations()).length,
                                             caches:(await caches.keys()).length}));
  console.log('4. před: SW registrací =', before.sw, '| cache klíčů =', before.caches);
  const nav = p.waitForNavigation({timeout:15000}).catch(()=>null);
  await p.evaluate(() => setSetMode('data')); await p.click('text=Zkontrolovat aktualizaci');
  await nav; await p.waitForTimeout(1500);
  const after = await p.evaluate(async()=>({sw:(await navigator.serviceWorker.getRegistrations()).length,
                                            caches:(await caches.keys()).length,
                                            title:document.title}));
  console.log('5. po aktualizaci: stránka se znovu načetla =', after.title==='Kalorie',
              '| SW =', after.sw, '(znovu se zaregistruje) | cache =', after.caches);

  // c) offline
  await p.unroute(/index\.html\?nosw=/);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  await ctx.setOffline(true);
  await p.evaluate(() => setSetMode('data')); await p.click('text=Zkontrolovat aktualizaci'); await p.waitForTimeout(1200);
  console.log('6. offline:', await p.textContent('#updMsg'));
  await ctx.setOffline(false);

  // d) data přežila celý cyklus
  console.log('7. cíle stále nastavené: kcal =', await p.inputValue('#gKcal'));
  console.log('\nERRORS:', errs.filter(e=>!/Failed to fetch|net::ERR_INTERNET/.test(e)).join('\n  ')||'none');
  await b.close();
})();
