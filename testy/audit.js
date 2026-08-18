const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const fs = require('fs');

const OFF_PROD = {status:1,code:'8594001020304',product:{product_name:'Jogurt bílý',brands:'Olma',
  serving_quantity:'150',nutriments:{'energy-kj_100g':418,proteins_100g:5.2,carbohydrates_100g:4.1,
  fat_100g:3.5,fiber_100g:0,salt_100g:0.12}}};
const OFF_ALL = [
 {_source:{code:'8594001222222',product_name:'Rohlík tukový',brands:'Penam',countries_tags:['en:czech-republic'],
   nutriments:{'energy-kcal_100g':287,proteins_100g:9,carbohydrates_100g:52,fat_100g:4.5,fiber_100g:2.8,salt_100g:1.3}}},
 {_source:{code:'3017620422003',product_name:'Nutella',brands:'Ferrero',countries_tags:['en:czech-republic'],
   nutriments:{'energy-kcal_100g':539,proteins_100g:6.3,carbohydrates_100g:57.5,fat_100g:30.9,fiber_100g:3.4,salt_100g:0.107}}},
 {_source:{code:'8594001333333',product_name:'Tvaroh polotučný',brands:'Madeta',countries_tags:['en:czech-republic'],
   nutriments:{'energy-kcal_100g':103,proteins_100g:12.5,carbohydrates_100g:3.8,fat_100g:4.5,fiber_100g:0,salt_100g:0.1}}}];

let PASS=0, FAIL=[], SECTION='';
function sec(s){ SECTION=s; console.log('\n══ '+s); }
function ck(name, cond, detail){
  if (cond) { PASS++; console.log('  ✓ '+name+(detail?'  ['+detail+']':'')); }
  else { FAIL.push(SECTION+' → '+name+(detail?'  ['+detail+']':'')); console.log('  ✗ '+name+(detail?'  ['+detail+']':'')); }
}
const num=v=>parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'));
const near=(a,b,t)=>Math.abs(num(a)-Number(b))<=(t||1);
const dd=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};

(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844}});
  const p = await ctx.newPage();
  const jsErr=[]; p.on('pageerror',e=>jsErr.push(e.message));
  p.on('console',m=>{ if(m.type()==='error' && !/ERR_|Failed to fetch|504/.test(m.text())) jsErr.push('console: '+m.text()); });
  await p.route(/openfoodfacts\.org\/api\/v2\/product/, r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(OFF_PROD)}));
  await p.route(/search\.openfoodfacts\.org/, r=>{
    const q = decodeURIComponent((r.request().url().match(/[?&]q=([^&]*)/)||[])[1]||'').toLowerCase();
    const hits = OFF_ALL.filter(h => h._source.product_name.toLowerCase().includes(q.slice(0,4)));
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hits})});
  });
  await p.route(/cgi\/search\.pl/, r=>r.abort());

  // ────────────────────────────────────────────
  sec('1 · První spuštění');
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);
  ck('aplikace se načte', await p.title()==='Kalorie');
  ck('spodní lišta má 7 položek (v41: + Pohyb)', await p.locator('nav button').count()===7,
     (await p.locator('nav button').allTextContents()).map(t=>t.trim()).join('·'));
  ck('prázdný den ukazuje všech 6 jídel', await p.locator('#logList .mealhead').count()===6);
  ck('kalorie na nule', (await p.textContent('#kcalNow'))==='0');
  ck('bez klidového výdeje se bilance nepočítá', (await p.textContent('#balVal')).trim()==='—');

  // ────────────────────────────────────────────
  sec('2 · Nastavení');
  await p.click('nav button[data-p="set"]');
  await p.click('#p-set summary');
  await p.fill('#cAge','42'); await p.fill('#cH','182'); await p.fill('#cW','84'); await p.selectOption('#cSex','m');
  await p.click('text=Spočítat a doplnit'); await p.waitForTimeout(200);
  ck('kalkulačka BMR (=1772.5 → 1773)', (await p.inputValue('#gRmr'))==='1773', await p.inputValue('#gRmr'));
  await p.fill('#gKcal','2300'); await p.fill('#gP','150'); await p.fill('#gC','230'); await p.fill('#gF','75');
  await p.fill('#gFib','35'); await p.fill('#gSalt','5'); await p.fill('#gAlcDay','20');
  await p.waitForTimeout(900);   // autosave (v40)
  await p.reload(); await p.waitForTimeout(1000); await p.click('nav button[data-p="set"]');
  ck('cíle přežijí restart', (await p.inputValue('#gKcal'))==='2300' && (await p.inputValue('#gRmr'))==='1773',
     'kcal='+await p.inputValue('#gKcal')+' rmr='+await p.inputValue('#gRmr'));
  ck('cíl vlákniny uložen', (await p.inputValue('#gFib'))==='35');

  // ────────────────────────────────────────────
  sec('3 · Zápis přes čárový kód');
  await p.click('nav button[data-p="day"]');
  await p.click('#logList div:nth-child(1) .mealhead .btn.pri'); await p.waitForTimeout(400);
  ck('"+" u snídaně přepne na Zadat', await p.isVisible('#p-scan'));
  await p.evaluate(() => setAdd('code'));
  await p.fill('#manualCode','8594001020304'); await p.click('#codeBtn'); await p.waitForTimeout(800);
  ck('produkt nalezen v Open Food Facts', (await p.textContent('#poName'))==='Jogurt bílý');
  ck('kJ→kcal (418/4.184=99.9)', near(await p.textContent('#poK'),150,2), await p.textContent('#poK'));
  ck('velikost porce předvyplněna', (await p.inputValue('#poAmt'))==='150');
  ck('jídlo předvoleno na snídani', (await p.inputValue('#poMeal'))==='snidane');
  await p.click('#poAdd'); await p.waitForTimeout(700);
  ck('zapsáno do snídaně', (await p.textContent('#logList')).includes('Jogurt bílý'));
  ck('denní součet', near(await p.textContent('#kcalNow'),150,2), await p.textContent('#kcalNow'));

  // ────────────────────────────────────────────
  sec('4 · Hledání podle názvu a našeptávání');
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.locator('#nameQ').type('rohlík tukový',{delay:20}); await p.waitForTimeout(900);
  ck('psaní hledá ve vlastních databázích', await p.locator('#nameRes .item').count()>=1);
  ck('psaní neposílá nic online', !(await p.textContent('#nameRes')).includes('zbývá dotazů'));
  await p.click('#nameBtn'); await p.waitForTimeout(1800);
  ck('tlačítko Hledat našlo produkty online', await p.locator('#nameRes .item').count()>=1);
  ck('české produkty mají odznak CZ', (await p.textContent('#nameRes')).includes('CZ'));
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
  await p.selectOption('#poMeal','obed'); await p.fill('#poAmt','86'); await p.click('#poAdd'); await p.waitForTimeout(700);
  ck('vláknina se sčítá (2.8·0.86=2.4)', near((await p.textContent('#fibTxt')).split('/')[0],2.4,0.3), await p.textContent('#fibTxt'));
  ck('sůl se sčítá (1.2·0.86=1.03)', near((await p.textContent('#saltTxt')).split('/')[0],1.03,0.2), await p.textContent('#saltTxt'));

  // ────────────────────────────────────────────
  sec('5 · Ruční zadání a foto etikety');
  await p.click('nav button[data-p="scan"]'); await p.evaluate(() => setAdd('man'));
  await p.click('text=+ Zadat potravinu ručně'); await p.waitForTimeout(300);
  await p.evaluate(t => processLabel(t), 'Energie 1428 kJ / 341 kcal, Bílkoviny 9,5 g, Sacharidy 24 g, Tuky 22,5 g, Sůl 1,4 g');
  await p.waitForTimeout(400);
  ck('etiketa z volného textu vyplní formulář',
     (await p.inputValue('#edKcal'))==='341' && (await p.inputValue('#edP'))==='9.5' && (await p.inputValue('#edF'))==='22.5');
  await p.fill('#edName','Sýrová rolka'); await p.fill('#edBrand','T Market'); await p.fill('#edServ','225');
  await p.click('#modEdit >> text=Uložit'); await p.waitForTimeout(500);
  ck('po uložení nabídne porci 225 g', (await p.inputValue('#poAmt'))==='225');
  ck('225 g = 767 kcal', near(await p.textContent('#poK'),767,3), await p.textContent('#poK'));
  await p.click('#modPortion >> text=Zrušit');

  // ────────────────────────────────────────────
  sec('6 · Foto jídla');
  await p.click('#addSeg button[data-s="photo"]');
  // od v67 se do chatu nic neposílá — rozbor jde přes API klíč
  ck('panel Popsat má tlačítko pro rozbor', (await p.locator('#apiEstBtn').count()) === 1);
  await p.evaluate(t => processAI(t), `Odhad:
| Surovina | Množství | kcal | Bílkoviny | Sacharidy | Tuky |
|---|---|---|---|---|---|
| Kuřecí prsa | 150 g | 248 | 46 | 0 | 5,4 |
| Rýže | 200 g | 260 | 5,4 | 56 | 0,6 |
Celkem 508 kcal.`); await p.waitForTimeout(400);
  ck('tabulka rozpoznána, 2 položky', await p.locator('#aiList .item').count()===2);
  ck('součet 508 kcal', near(await p.textContent('#aiTotK'),508,2), await p.textContent('#aiTotK'));
  ck('varuje, že to není JSON', (await p.textContent('#aiNote')).includes('zkontroluj'));
  await p.fill('#aiName','Kuřecí s rýží');
  await p.click('text=Přidat + uložit jako recept'); await p.waitForTimeout(800);
  ck('recept uložen do databáze', (await p.evaluate(()=>products.filter(x=>x.source==='recipe').length))===1);

  // ────────────────────────────────────────────
  sec('7 · Úprava a mazání záznamu');
  const kBefore = await p.textContent('#kcalNow');
  await p.click('#logList .item .grow >> nth=0'); await p.waitForTimeout(400);
  ck('otevře se úprava', (await p.textContent('#poAdd'))==='Uložit změnu', await p.textContent('#poSub'));
  const amt0 = await p.inputValue('#poAmt');
  await p.fill('#poAmt', String(Number(amt0)*2)); await p.selectOption('#poMeal','vecere');
  await p.click('#poAdd'); await p.waitForTimeout(700);
  ck('gramáž se zdvojnásobila i v součtu',
     near(await p.textContent('#kcalNow'), Number(kBefore)+150, 3), kBefore+' → '+await p.textContent('#kcalNow'));
  const grpV = await p.locator('#logList > div').filter({hasText:'Večeře'}).first().textContent();
  ck('položka se přesunula do večeře', /Jogurt|Rohlík|Sýrová|Kuřecí/.test(grpV), grpV.replace(/\s+/g,' ').slice(0,70));
  const nBefore = await p.locator('#logList .item').count();
  await p.click('#logList .item .grow >> nth=0'); await p.waitForTimeout(400);
  await p.click('#poDel'); await p.waitForTimeout(600);   // mazání přes editaci (v40)
  ck('mazání funguje', await p.locator('#logList .item').count()===nBefore-1);

  // ────────────────────────────────────────────
  sec('8 · Kopie jídla ze včerejška');
  await p.evaluate(async (d)=>{ await dbPut('log',{date:d,productId:'x',name:'Ovesná kaše',unit:'g',meal:'snidane',
      amount:250,kcal:320,p:11,c:52,f:6,fib:7,salt:0.1,ts:Date.now()}); }, dd(-1));
  const k8 = Number(await p.textContent('#kcalNow'));
  await p.click('#logList div:nth-child(1) .mealhead .btn:not(.pri)'); await p.waitForTimeout(700);
  ck('⧉ zkopírovalo snídani (+320 kcal)', near(await p.textContent('#kcalNow'), k8+320, 2),
     k8+' → '+await p.textContent('#kcalNow'));

  // ────────────────────────────────────────────
  sec('9 · Zpětný zápis');
  await p.click('nav button[data-p="scan"]');
  await p.fill('#addDate', dd(-3)); await p.dispatchEvent('#addDate','change'); await p.waitForTimeout(600);
  ck('varování o jiném dni', await p.isVisible('#addDateWarn'));
  await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','nutella'); await p.click('#nameBtn'); await p.waitForTimeout(1000);
  await p.click('#nameRes .item .grow >> nth=0'); await p.waitForTimeout(400);
  ck('panel přebírá zvolené datum', (await p.inputValue('#poDate'))===dd(-3));
  await p.fill('#poAmt','20'); await p.click('#poAdd'); await p.waitForTimeout(700);
  ck('zapsáno na starý den', near(await p.textContent('#kcalNow'),108,2), await p.textContent('#kcalNow'));
  ck('hlavní stránka ukazuje ten den', (await p.textContent('#dayLabel'))!=='Dnes');
  await p.evaluate(d=>setAddDate(d), dd(0)); await p.waitForTimeout(600);
  ck('návrat na dnešek', (await p.textContent('#dayLabel'))==='Dnes');

  // ────────────────────────────────────────────
  sec('10 · Alkohol');
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(500);
  ck('5 přednastavených nápojů', await p.locator('#drinkBtns button').count()===5);
  const kA = Number(await p.textContent('#alc7'));
  await p.click('#drinkBtns button >> nth=1'); await p.waitForTimeout(700);
  ck('pivo 12° = 19.7 g etanolu', near(await p.textContent('#alc7'), kA+19.7, 1), await p.textContent('#alc7'));
  ck('záznam v seznamu', await p.locator('#alcList .item').count()===1);
  await p.click('#alcList .item .grow'); await p.waitForTimeout(400);
  ck('nápoj lze upravit', (await p.textContent('#dkTitle'))==='Upravit nápoj');
  await p.fill('#dkMl','300'); await p.waitForTimeout(200);
  ck('přepočet 300 ml = 11.8 g', (await p.textContent('#dkAlc')).startsWith('11.8'), await p.textContent('#dkAlc'));
  await p.click('#dkSave'); await p.waitForTimeout(700);
  ck('limit se plní (20 g/den)', (await p.textContent('#alcLimitBar')).includes('20'),
     (await p.textContent('#alcLimitBar')).replace(/\s+/g,' ').trim().slice(0,80));
  await p.click('#p-alc summary'); await p.waitForTimeout(300);
  ck('editor přednastavených nápojů', await p.locator('#drinkEdit .row').count()===5);

  // ────────────────────────────────────────────
  sec('11 · Výdej a váha');
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(400);   // výdej z hodinek je od v49 na Pohybu
  await p.fill('#dBurn','520'); await p.locator('#dBurn').blur(); await p.waitForTimeout(500);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.fill('#dWeight','84.2'); await p.locator('#dWeight').blur(); await p.waitForTimeout(600);
  const intake = Number(await p.textContent('#kcalNow'));
  ck('bilance = příjem − (1773+520)', near(await p.textContent('#balVal'), intake-2293, 3),
     await p.textContent('#balExp')+' → '+await p.textContent('#balVal'));
  await p.reload(); await p.waitForTimeout(1100);
  const vahaPoRestartu = await p.inputValue('#dWeight');
  await p.click('nav button[data-p="fit"]'); await p.waitForTimeout(500);
  ck('výdej a váha přežijí restart', (await p.inputValue('#dBurn'))==='520' && vahaPoRestartu==='84.2',
     'výdej '+(await p.inputValue('#dBurn'))+' · váha '+vahaPoRestartu);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(300);

  // ────────────────────────────────────────────
  sec('12 · Statistiky');
  await p.evaluate(async ()=>{                       // 30 dní historie s known hodnotami
    for (let i=29;i>=1;i--){
      const x=new Date(); x.setDate(x.getDate()-i); const d=x.toISOString().slice(0,10);
      await dbPut('log',{date:d,productId:'x',name:'Strava',unit:'g',meal:'obed',amount:500,
        kcal:2000,p:150,c:200,f:70,fib:30,salt:5,ts:Date.now()-i*86400000});
      await dbPut('daily',{date:d,burn:500,weight:+(85-(29-i)*0.03).toFixed(1)});
    }
  });
  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(900);
  ck('7denní přehled', (await p.textContent('#stRange')).includes('záznam za'));
  await p.click('#per30'); await p.waitForTimeout(900);
  ck('průměrný příjem ≈2000', near(await p.textContent('#stKcal'),2000,60), await p.textContent('#stKcal'));
  ck('průměrný výdej ≈2273', near(await p.textContent('#stBurn'),2273,60), await p.textContent('#stBurn'));
  ck('graf příjmu má 30 sloupců', await p.locator('#chKcal rect').count()===30);
  ck('graf příjmu má čáru výdeje', await p.locator('#chKcal path').count() >= 1);
  ck('křivka váhy', await p.locator('#chWeight path').count()===1);
  ck('reálný výdej dopočten', (await p.textContent('#stWeightTxt')).includes('Reálný výdej'));
  ck('postřehy vygenerovány', await p.locator('#stInsights p').count()>=3, (await p.locator('#stInsights p').count())+' vět');
  ck('zdroje kalorií', await p.locator('#stTop .item').count()>=1);
  await p.click('#per90'); await p.waitForTimeout(900);
  ck('90denní pohled funguje', (await p.textContent('#stRange')).includes('90'));
  const sum = await p.evaluate(()=>summaryText());
  ck('souhrn pro Claude obsahuje sekce',
     ['PŘÍJEM','VÝDEJ','VÁHA','ALKOHOL','DENNÍ ŘADA'].every(x=>sum.includes(x)), sum.length+' znaků');

  // ────────────────────────────────────────────
  sec('13 · Databáze potravin');
  await p.click('nav button[data-p="db"]'); await p.waitForTimeout(400);
  const dbCount = await p.locator('#dbList .item').count();
  ck('produkty uloženy', dbCount>=4, dbCount+' položek');
  await p.fill('#dbSearch','rolka'); await p.waitForTimeout(300);
  ck('hledání v databázi', await p.locator('#dbList .item').count()===1);
  await p.click('#dbList .item .btn >> nth=0'); await p.waitForTimeout(400);
  await p.fill('#edKcal','350'); await p.click('#modEdit >> text=Uložit'); await p.waitForTimeout(500);
  await p.click('#modPortion >> text=Zrušit');
  await p.fill('#dbSearch','rolka'); await p.waitForTimeout(300);
  ck('úprava produktu se projeví', (await p.textContent('#dbList')).includes('350'));

  // ────────────────────────────────────────────
  sec('14 · Záloha a obnova');
  const before = await p.evaluate(async ()=>({
    log:(await dbAll('log')).length, prod:(await dbAll('products')).length,
    daily:(await dbAll('daily')).length, goals:JSON.stringify(goals), drinks:drinks.length }));
  const dlp = p.waitForEvent('download');
  await p.click('nav button[data-p="set"]'); await p.evaluate(() => setSetMode('data')); await p.click('text=Export zálohy (JSON)');
  const file = await (await dlp).path();
  const json = JSON.parse(fs.readFileSync(file,'utf8'));
  ck('záloha obsahuje vše',
     json.log.length===before.log && json.products.length===before.prod && json.daily.length===before.daily,
     `log ${json.log.length}/${before.log} · produkty ${json.products.length}/${before.prod} · dny ${json.daily.length}/${before.daily}`);
  p.on('dialog', d=>d.accept());
  await p.evaluate(() => setSetMode('data')); await p.click('text=Smazat všechna data'); await p.waitForTimeout(1200);
  const wiped = await p.evaluate(async ()=>({log:(await dbAll('log')).length, prod:(await dbAll('products')).length}));
  ck('smazání vyčistí vše', wiped.log===0 && wiped.prod===0);
  await p.setInputFiles('#impFile', file); await p.waitForTimeout(2500);
  const after = await p.evaluate(async ()=>({
    log:(await dbAll('log')).length, prod:(await dbAll('products')).length,
    daily:(await dbAll('daily')).length, goals:JSON.stringify(goals), drinks:drinks.length }));
  ck('obnova vrátí záznamy', after.log===before.log, after.log+'/'+before.log);
  ck('obnova vrátí produkty', after.prod===before.prod, after.prod+'/'+before.prod);
  ck('obnova vrátí dny (výdej/váha)', after.daily===before.daily, after.daily+'/'+before.daily);
  ck('obnova vrátí cíle', after.goals===before.goals);
  ck('obnova vrátí nápoje', after.drinks===before.drinks);
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(600);
  ck('data jsou po obnově vidět', Number(await p.textContent('#kcalNow'))>0, await p.textContent('#kcalNow'));

  // ────────────────────────────────────────────
  sec('15 · Okrajové případy');
  await p.click('nav button[data-p="scan"]'); await p.evaluate(() => setAdd('code'));
  await p.fill('#manualCode','123'); await p.click('#codeBtn'); await p.waitForTimeout(400);
  ck('krátký kód odmítnut', (await p.textContent('#toast')).includes('Neplatný'));
  await p.click('#addSeg button[data-s="find"]');
  await p.fill('#nameQ','a'); await p.click('#nameBtn'); await p.waitForTimeout(400);
  ck('jednopísmenný dotaz odmítnut', (await p.textContent('#toast')).includes('dvě písmena'));
  await p.evaluate(() => setAdd('man')); await p.click('text=+ Zadat potravinu ručně');
  await p.click('#modEdit >> text=Uložit'); await p.waitForTimeout(300);
  ck('produkt bez názvu neuloží', (await p.textContent('#toast')).includes('název'));
  await p.click('#modEdit >> text=Zrušit');
  await p.click('nav button[data-p="day"]');
  for(let i=0;i<3;i++) await p.click('#dayNext');
  await p.waitForTimeout(500);
  ck('budoucí den se zobrazí prázdný', (await p.textContent('#kcalNow'))==='0', await p.textContent('#dayLabel'));
  for(let i=0;i<3;i++) await p.click('#dayPrev');
  await p.waitForTimeout(400);

  // ────────────────────────────────────────────
  sec('16 · Aktualizace a offline');
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  ck('verze je vidět', /^\d{4}\.\d{2}\.\d{2}-\d+$/.test((await p.textContent('#verNow')).trim()), await p.textContent('#verNow'));
  await p.evaluate(() => setSetMode('data')); await p.click('text=Zkontrolovat aktualizaci'); await p.waitForTimeout(1200);
  ck('kontrola aktualizace hlásí shodu', (await p.textContent('#updMsg')).includes('nejnovější'));
  const sw = await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r&&r.active?'active':'x';});
  ck('service worker běží', sw==='active');
  await ctx.setOffline(true);
  await p.reload().catch(()=>{}); await p.waitForTimeout(1200);
  ck('offline se aplikace načte', await p.isVisible('nav'));
  ck('offline jsou data k dispozici', Number(await p.textContent('#kcalNow'))>0, await p.textContent('#kcalNow'));
  await ctx.setOffline(false);

  console.log('\n════════════════════════════════');
  console.log(`PROŠLO: ${PASS}   NEPROŠLO: ${FAIL.length}`);
  if (FAIL.length) { console.log('\nSELHALO:'); FAIL.forEach(f=>console.log('  • '+f)); }
  console.log('\nJS chyby: ' + (jsErr.length ? jsErr.join('\n  ') : 'žádné'));
  await b.close();
})();
