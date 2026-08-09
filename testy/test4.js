const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[], reqs=[];
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  p.on('requestfailed', r=>errs.push('REQFAIL: '+r.url().slice(0,80)+' '+(r.failure()||{}).errorText));
  p.on('request', r=>reqs.push(r.url().replace('http://127.0.0.1:8811','')));
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(1500);
  console.log('1. requests:', reqs.filter(u=>!u.startsWith('data:')).join(', '));
  const mf = await p.evaluate(async () => {
    const l = document.querySelector('link[rel=manifest]');
    const r = await fetch(l.href); const j = await r.json();
    // ověř, že se ikony z data: URI opravdu dekódují na obrázek
    const load = src => new Promise(res => { const i = new Image();
      i.onload=()=>res(i.naturalWidth+'x'+i.naturalHeight); i.onerror=()=>res('CHYBA'); i.src=src; });
    return { href: l.getAttribute('href'), ok: r.ok, name: j.name, display: j.display,
             start: j.start_url, icons: j.icons.length,
             decoded: await Promise.all(j.icons.map(i=>load(i.src))),
             purposes: j.icons.map(i=>i.purpose) };
  });
  console.log('2. manifest:', JSON.stringify(mf));
  const sw = await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? (r.active?'active':(r.installing?'installing':'waiting')) : 'none';
  });
  console.log('3. service worker =', sw);
  // offline test: znovu načíst se zablokovanou sítí, musí to jet z cache
  await p.waitForTimeout(1200);
  await p.context().setOffline(true);
  await p.reload().catch(e=>console.log('   reload err', e.message));
  await p.waitForTimeout(900);
  console.log('4. offline reload: titulek =', await p.title(), '| nav viditelná =', await p.isVisible('nav'),
              '| tlačítka nápojů =', await p.locator('#drinkBtns button').count());
  await p.context().setOffline(false);
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
