const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(1200);
  console.log('1. info:', (await p.textContent('#infoTxt')).replace(/\s+/g,' '));

  // pokus o injektáž přes podvrženou zálohu
  const evil = await p.evaluate(async () => {
    window.__pwned = false;
    await dbPut('products', {id:"x');window.__pwned=true;//", barcode:null,
      name:'<img src=x onerror="window.__pwned=true">Zlý produkt',
      brand:'<script>window.__pwned=true<\/script>', unit:'g', kcal:100,p:1,c:1,f:1,
      source:'manual', uses:9, createdAt:1, updatedAt:1});
    products = await dbAll('products');
    renderDb(); await renderDay();
    await new Promise(r=>setTimeout(r,300));
    return { pwned: window.__pwned,
             dbHtml: document.getElementById('dbList').innerHTML.slice(0,240),
             imgs: document.querySelectorAll('#dbList img, #favList img').length };
  });
  console.log('2. injektáž provedena?', evil.pwned, '| <img> vloženo:', evil.imgs);
  console.log('3. render:', evil.dbHtml.replace(/\s+/g,' ').slice(0,200));
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(300);
  await p.click('#dbList .item .grow'); await p.waitForTimeout(300);
  console.log('4. po klepnutí pwned?', await p.evaluate(()=>window.__pwned),
              '| otevřelo se:', await p.isVisible('#modPortion') ? await p.textContent('#poName') : 'nic (id očištěno)');
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
