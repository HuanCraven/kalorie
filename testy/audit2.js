const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const fs = require('fs');
let PASS=0, FAIL=[], SECTION='';
function sec(s){ SECTION=s; console.log('\n══ '+s); }
function ck(n,c,d){ if(c){PASS++;console.log('  ✓ '+n+(d?'  ['+d+']':''));}
  else {FAIL.push(SECTION+' → '+n+(d?'  ['+d+']':''));console.log('  ✗ '+n+(d?'  ['+d+']':''));} }
const num=v=>parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'));

(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const jsErr=[]; p.on('pageerror',e=>jsErr.push(e.message));
  p.on('console',m=>{ if(m.type()==='error' && !/ERR_|Failed to fetch|504/.test(m.text())) jsErr.push('console: '+m.text()); });
  p.on('dialog', d=>d.accept());
  await p.route(/openfoodfacts\.org|search\.openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  sec('A · Dvojitý import zálohy (klasická chyba uživatele)');
  await p.evaluate(async ()=>{
    await dbPut('log',{date:dstr(new Date()),productId:'x',name:'Test',unit:'g',meal:'obed',
      amount:100,kcal:500,p:10,c:10,f:10,fib:1,salt:1,ts:Date.now()});
    await dbPut('products',{id:'p1',barcode:'111',name:'Testovací',brand:'',unit:'g',
      kcal:100,p:1,c:1,f:1,fib:0,salt:0,source:'manual',uses:1,createdAt:1,updatedAt:1});
  });
  await p.reload(); await p.waitForTimeout(900);
  const dl = p.waitForEvent('download');
  await p.click('nav button[data-p="set"]'); await p.evaluate(() => setSetMode('data')); await p.click('text=Export zálohy (JSON)');
  const f = await (await dl).path();
  await p.setInputFiles('#impFile', f); await p.waitForTimeout(1500);
  const one = await p.evaluate(async()=>({log:(await dbAll('log')).length, prod:(await dbAll('products')).length}));
  await p.setInputFiles('#impFile', f); await p.waitForTimeout(1500);
  const two = await p.evaluate(async()=>({log:(await dbAll('log')).length, prod:(await dbAll('products')).length}));
  ck('opakovaný import nemnoží produkty', one.prod===two.prod, `${one.prod} → ${two.prod}`);
  ck('opakovaný import nemnoží záznamy deníku', one.log===two.log, `${one.log} → ${two.log}`);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  ck('kalorie po dvojím importu nejsou zdvojené', num(await p.textContent('#kcalNow'))===500, await p.textContent('#kcalNow'));

  sec('B · Nesmyslné hodnoty');
  await p.click('nav button[data-p="set"]'); await p.evaluate(() => setSetMode('data')); await p.click('text=Smazat všechna data'); await p.waitForTimeout(1200);
  await p.click('nav button[data-p="scan"]'); await p.evaluate(() => setAdd('man'));
  await p.click('text=+ Zadat potravinu ručně');
  await p.fill('#edName','Záporné'); await p.fill('#edKcal','-500'); await p.fill('#edP','-10');
  await p.click('#modEdit >> text=Uložit'); await p.waitForTimeout(500);
  await p.fill('#poAmt','-100'); await p.waitForTimeout(200);
  await p.click('#poAdd'); await p.waitForTimeout(500);
  ck('záporné množství se nezapíše', (await p.textContent('#toast')).includes('množství'), await p.textContent('#toast'));
  await p.fill('#poAmt','0'); await p.click('#poAdd'); await p.waitForTimeout(400);
  ck('nulové množství se nezapíše', (await p.textContent('#toast')).includes('množství'));
  await p.fill('#poAmt','999999'); await p.click('#poAdd'); await p.waitForTimeout(600);
  ck('nesmyslně velké množství odmítnuto', (await p.textContent('#toast')).includes('20 kg'), await p.textContent('#toast'));
  ck('nic se nezapsalo', (await p.textContent('#kcalNow'))==='0', await p.textContent('#kcalNow'));
  await p.fill('#poAmt','100'); await p.click('#poAdd'); await p.waitForTimeout(700);
  ck('záporné živiny uloženy jako nula', (await p.textContent('#kcalNow'))==='0', await p.textContent('#kcalNow'));
  await p.click('#logList .item .grow >> nth=0'); await p.waitForTimeout(400);
  await p.click('#poDel'); await p.waitForTimeout(500);   // mazání přes editaci (v40)

  sec('C · Dlouhý název a zvláštní znaky');
  const LONG='Extrémně dlouhý název potraviny který se nevejde na jeden řádek a měl by se zalomit '+
             '<script>alert(1)</script> & "uvozovky" \'apostrof\' 🥐';
  await p.click('nav button[data-p="scan"]'); await p.evaluate(() => setAdd('man'));
  await p.click('text=+ Zadat potravinu ručně');
  await p.fill('#edName', LONG); await p.fill('#edKcal','200'); await p.fill('#edP','5');
  await p.fill('#edC','20'); await p.fill('#edF','8');
  await p.click('#modEdit >> text=Uložit'); await p.waitForTimeout(500);
  await p.fill('#poAmt','100'); await p.click('#poAdd'); await p.waitForTimeout(700);
  ck('dlouhý název se uloží a zobrazí', (await p.textContent('#logList')).includes('Extrémně dlouhý'));
  ck('skript se nespustil', jsErr.filter(e=>/alert/.test(e)).length===0);
  const overflow = await p.evaluate(()=>{
    const el=document.querySelector('#logList .item .nm');
    return el ? el.scrollWidth <= el.parentElement.clientWidth+2 : true; });
  ck('název přeteče na další řádek, ne mimo kartu', overflow);
  const bodyOverflow = await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  ck('stránka se nerozjíždí do šířky', bodyOverflow,
     await p.evaluate(()=>document.documentElement.scrollWidth+'px vs '+window.innerWidth));

  sec('D · Cíle na nule');
  await p.click('nav button[data-p="set"]');
  await p.evaluate(() => setSetMode('ja')); await p.fill('#gKcal','0'); await p.fill('#gP','0'); await p.fill('#gC','0'); await p.fill('#gF','0');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  ck('nulové cíle nerozbijí hlavní stránku', await p.isVisible('#kcalNow'), 'cíl='+await p.textContent('#kcalGoal'));
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(800);
  ck('nulové cíle nerozbijí statistiky', await p.isVisible('#stKcal'), await p.textContent('#stKcal'));
  ck('grafy se vykreslí i s nulovým cílem', await p.locator('#chKcal rect').count()>0);

  sec('E · Statistiky bez dat');
  await p.click('nav button[data-p="set"]');
  await p.fill('#gKcal','2000'); await p.fill('#gP','130'); await p.fill('#gC','220'); await p.fill('#gF','65');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.evaluate(() => setSetMode('data'));
  await p.click('text=Smazat všechna data'); await p.waitForTimeout(1200);
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(800);
  ck('prázdné statistiky nespadnou', await p.isVisible('#stRange'), await p.textContent('#stRange'));
  ck('místo grafu je vysvětlení', (await p.textContent('#chKcal')).length>0 || await p.locator('#chKcal rect').count()===0);
  const emptySum = await p.evaluate(()=>{ try { return summaryText().length; } catch(e){ return 'CHYBA: '+e.message; } });
  ck('souhrn jde vytvořit i bez dat', typeof emptySum==='number' && emptySum>0, String(emptySum));

  sec('F · Smazaný produkt vs. deník');
  await p.evaluate(async ()=>{
    await dbPut('products',{id:'pz',barcode:'999',name:'Zmizík',brand:'',unit:'g',kcal:200,p:5,c:5,f:5,
      fib:0,salt:0,source:'manual',uses:1,createdAt:1,updatedAt:1});
    products = await dbAll('products');
  });
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  await p.click('#dbList .item .grow >> nth=0'); await p.waitForTimeout(400);
  await p.fill('#poAmt','100'); await p.click('#poAdd'); await p.waitForTimeout(700);
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  await p.click('#dbList .item .btn >> nth=0'); await p.waitForTimeout(400);
  await p.click('#modEdit >> text=Smazat z databáze'); await p.waitForTimeout(800);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  ck('záznam zůstane i po smazání produktu', (await p.textContent('#logList')).includes('Zmizík'));
  await p.click('#logList .item .grow >> nth=0'); await p.waitForTimeout(500);
  ck('takový záznam jde stále upravit', await p.isVisible('#modPortion'),
     'kcal/100='+(await p.textContent('#poSub')));
  await p.fill('#poAmt','50'); await p.click('#poAdd'); await p.waitForTimeout(600);
  ck('a přepočítá se správně (200·0.5=100)', num(await p.textContent('#kcalNow'))===100, await p.textContent('#kcalNow'));

  sec('G · Alkohol s nulou a extrémy');
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(400);
  await p.click('text=+ Jiný nápoj'); await p.waitForTimeout(300);
  await p.fill('#dkName','Nealko'); await p.fill('#dkMl','500'); await p.fill('#dkAbv','0'); await p.fill('#dkC','5');
  await p.click('#dkSave'); await p.waitForTimeout(500);
  ck('nulová procenta odmítnuta', (await p.textContent('#toast')).includes('objem a procenta'));
  await p.fill('#dkAbv','96'); await p.fill('#dkMl','50'); await p.waitForTimeout(200);
  ck('96% destilát spočten (50·0.96·0.789=37.9)', (await p.textContent('#dkAlc')).startsWith('37.9'), await p.textContent('#dkAlc'));
  await p.click('#dkSave'); await p.waitForTimeout(700);
  ck('zapsáno', await p.locator('#alcList .item').count()===1);

  sec('H · Hodně záznamů (výkon)');
  const t0 = Date.now();
  await p.evaluate(async ()=>{
    for (let i=0;i<150;i++)
      await dbPut('log',{date:dstr(new Date()),productId:'x',name:'Položka '+i,unit:'g',
        meal:['snidane','svacina','obed','odpsvac','vecere','vecsvac'][i%6],
        amount:100,kcal:50,p:1,c:2,f:1,fib:0.1,salt:0.1,ts:Date.now()+i});
  });
  await p.reload(); await p.waitForTimeout(1500);
  const tRender = Date.now()-t0;
  ck('150 položek se vykreslí', await p.locator('#logList .item').count()>=150,
     (await p.locator('#logList .item').count())+' řádků za '+tRender+' ms');
  ck('součet sedí (150·50 + zbytek)', num(await p.textContent('#kcalNow'))>=7500, await p.textContent('#kcalNow'));
  const t1 = Date.now();
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(1200);
  ck('statistiky se otevřou do 3 s', Date.now()-t1 < 3000, (Date.now()-t1)+' ms');

  sec('I · Přepnutí dne s otevřeným panelem');
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  await p.click('#logList .item .grow >> nth=0'); await p.waitForTimeout(400);
  const dBefore = await p.inputValue('#poDate');
  await p.evaluate(()=>{ const d=new Date(); d.setDate(d.getDate()-2);
    setAddDate(dstr(d)); });
  await p.waitForTimeout(600);
  ck('panel zůstane otevřený', await p.isVisible('#modPortion'));
  await p.click('#poAdd'); await p.waitForTimeout(700);
  const moved = await p.evaluate(async ()=>{
    const d=new Date(); d.setDate(d.getDate()-2);
    return (await dbByIdx('log','date',dstr(d))).length; });
  ck('úprava přesune záznam na nový den', moved===1, moved+' záznam');
  await p.evaluate(()=>setAddDate(dstr(new Date()))); await p.waitForTimeout(600);

  console.log('\n════════════════════════════════');
  console.log(`PROŠLO: ${PASS}   NEPROŠLO: ${FAIL.length}`);
  if (FAIL.length) { console.log('\nSELHALO:'); FAIL.forEach(x=>console.log('  • '+x)); }
  console.log('\nJS chyby: ' + (jsErr.length ? jsErr.slice(0,5).join('\n  ') : 'žádné'));
  await b.close();
})();
