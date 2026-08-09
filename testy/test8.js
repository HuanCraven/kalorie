const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});

  // 1) vytvoř STAROU databázi verze 1 (bez storu 'daily') na stejném originu
  await p.goto('http://127.0.0.1:8811/manifest.json');
  const made = await p.evaluate(() => new Promise(res => {
    const rq = indexedDB.open('kaltrack', 1);
    rq.onupgradeneeded = e => { const d = e.target.result;
      const s = d.createObjectStore('products',{keyPath:'id'}); s.createIndex('name','name');
      const l = d.createObjectStore('log',{keyPath:'id',autoIncrement:true}); l.createIndex('date','date');
      d.createObjectStore('meta',{keyPath:'k'}); };
    rq.onsuccess = () => { const d = rq.result;
      const t = d.transaction(['products','log','meta'],'readwrite');
      t.objectStore('products').put({id:'8590000111222',barcode:'8590000111222',name:'Tvaroh Albert',
        brand:'Albert',unit:'g',kcal:75,p:13,c:4,f:0.5,fib:0,salt:0.1,serving:250,source:'manual',uses:3,
        createdAt:1,updatedAt:1});
      t.objectStore('log').put({date:new Date().toISOString().slice(0,10),productId:'8590000111222',
        name:'Tvaroh Albert',unit:'g',amount:250,kcal:187.5,p:32.5,c:10,f:1.25,ts:1});
      t.objectStore('meta').put({k:'goals',v:{kcal:2300,p:150,c:230,f:70,alc:120}});
      t.objectStore('meta').put({k:'drinks',v:[{nm:'Plzeň 0,5 l',ml:500,abv:4.4,c:3.8}]});
      t.oncomplete = () => { const ver=d.version; const stores=[...d.objectStoreNames]; d.close();
        res({ver, stores}); }; };
  }));
  console.log('1. stará DB:', JSON.stringify(made));

  // 2) načti novou aplikaci -> musí proběhnout upgrade na v2
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => ({ver: db.version, stores:[...db.objectStoreNames]}));
  console.log('2. po upgradu:', JSON.stringify(after));
  console.log('3. data přežila: kcal dnes =', await p.textContent('#kcalNow'),
              '| záznamů =', await p.locator('#logList .item').count());
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(300);
  console.log('4. produkty:', await p.textContent('#dbCount'));
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(200);
  console.log('5. staré cíle zachovány: kcal =', await p.inputValue('#gKcal'),
              '| alk limit ø/den (ze 120 g/týden) =', await p.inputValue('#gAlcDay'),
              '| rmr (nový, má být prázdný) =', JSON.stringify(await p.inputValue('#gRmr')));
  console.log('6. vlastní nápoje zachovány =',
              (await p.locator('#drinkBtns button').allTextContents()).map(t=>t.trim().split('\n')[0]).join(', '));

  // 3) nové funkce fungují i na migrované DB
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(300);
  await p.fill('#dBurn','450'); await p.locator('#dBurn').blur(); await p.waitForTimeout(400);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);
  await p.fill('#dWeight','81.3'); await p.locator('#dWeight').blur();
  await p.waitForTimeout(500);
  console.log('7. bilance po zadání výdeje:', await p.textContent('#balVal'), '|', await p.textContent('#balHint'));
  await p.click('nav button[data-p="set"]'); await p.fill('#gRmr','1800');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  console.log('8. bilance s rmr:', await p.textContent('#balVal'), '|', await p.textContent('#balExp'));
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(600);
  console.log('9. statistiky:', await p.textContent('#stRange'), '| bilance ø', await p.textContent('#stBal'));

  await p.reload(); await p.waitForTimeout(900);
  const vahaPo = await p.inputValue('#dWeight');
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(500);
  console.log('10. po reloadu: výdej =', await p.inputValue('#dBurn'), '| váha =', vahaPo);
  console.log('\nERRORS:', errs.length?errs.join('\n  '):'none');
  await b.close();
})();
