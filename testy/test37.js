const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const withE = n=>({_source:{code:'A'+n,product_name:n,brands:'X',
  nutriments:{'energy-kcal_100g':112,proteins_100g:18,carbohydrates_100g:1,fat_100g:4}}});

async function page(){
  const b=await chromium.launch({executablePath:PROSTREDI.EXE});
  const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  p.on('pageerror',e=>console.log('   PAGEERROR:',e.message));
  return {b,p};
}
async function open(p, route){
  await p.route(/search\.openfoodfacts\.org/, route);
  await p.route(/cgi\/search\.pl/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"products":[]}'}));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.uncheck('#czOnly');
}
(async()=>{
  // 1) psaní neposílá NIC online
  {
    const {b,p}=await page(); let calls=0;
    await open(p, r=>{calls++; r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hits:[withE('X')]})});});
    await p.locator('#nameQ').type('kureci prsa',{delay:120});
    await p.waitForTimeout(3000);
    const txt=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log('1) psaní neposílá online dotazy');
    console.log('   dotazů:',calls,'| ✓ nula:',calls===0);
    console.log('   ✓ lokální výsledky jsou vidět:', /kcal/.test(txt));
    console.log('   ✓ vysvětluje tlačítko Hledat:', /Hledat/.test(txt));
    await b.close();
  }
  // 2) tlačítko pošle právě jeden dotaz
  {
    const {b,p}=await page(); let calls=0;
    await open(p, r=>{calls++; r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hits:[withE('Schinken')]})});});
    await p.fill('#nameQ','schinken'); await p.click('#nameBtn'); await p.waitForTimeout(2500);
    const txt=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log('2) tlačítko Hledat\n   dotazů:',calls,'| ✓ jeden:',calls===1);
    console.log('   ✓ zobrazeno:',/Schinken/.test(txt),'| ✓ ukazuje zbývající:',/zbývá dotazů: 5\/6/.test(txt));
    // stejný dotaz podruhé → z paměti, bez dotazu
    await p.click('#nameBtn'); await p.waitForTimeout(1500);
    const t2=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log('   ✓ druhé hledání z paměti (bez dotazu):', calls===1 && /z paměti/.test(t2));
    await b.close();
  }
  // 3) limit: 6 různých dotazů projde, sedmý se zastaví
  {
    const {b,p}=await page(); let calls=0;
    await open(p, r=>{calls++; r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hits:[withE('P'+calls)]})});});
    for (let i=0;i<7;i++){ await p.fill('#nameQ','dotaz'+i); await p.click('#nameBtn'); await p.waitForTimeout(900); }
    const txt=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log('3) hlídač limitu\n   dotazů:',calls,'| ✓ zastaveno na 6:',calls===6);
    console.log('   ✓ vysvětlí proč:', /10 dotazů za minutu/.test(txt), '|', txt.slice(0,110));
    await b.close();
  }
  // 4) Failed to fetch → vysvětlení + test spojení
  {
    const {b,p}=await page();
    await open(p, r=>r.abort('failed'));
    await p.unroute(/cgi\/search\.pl/); await p.route(/cgi\/search\.pl/, r=>r.abort('failed'));
    await p.fill('#nameQ','schwar'); await p.click('#nameBtn'); await p.waitForTimeout(3000);
    const txt=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log('4) spojení nedorazí');
    console.log('   ✓ vysvětluje ban/limit:', /zablokoval tvou IP/.test(txt));
    console.log('   ✓ tlačítko testu:', await p.isVisible('text=Otestovat spojení'));
    await p.route(/world\.openfoodfacts\.org\/api/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"status":1}'}));
    await p.click('text=Otestovat spojení'); await p.waitForTimeout(3000);
    const d=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
    console.log('   diagnostika:', d.slice(0,190));
    console.log('   ✓ rozlišuje kód vs hledání:', /čárový kód/.test(d) && /nové hledání/.test(d));
    await b.close();
  }
  console.log('\nhotovo');
})();
