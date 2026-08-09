const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const withE = n=>({_source:{code:'A'+n,product_name:n,brands:'X',
  nutriments:{'energy-kcal_100g':112,proteins_100g:18,carbohydrates_100g:1,fat_100g:4}}});
const noE   = n=>({_source:{code:'B'+n,product_name:n,brands:'X',nutriments:{proteins_100g:18}}});
const kjOnly= n=>({_source:{code:'C'+n,product_name:n,brands:'X',nutriments:{'energy_100g':418}}});
const zero  = n=>({_source:{code:'D'+n,product_name:n,brands:'X',
  nutriments:{'energy-kcal_100g':0,proteins_100g:0,carbohydrates_100g:0,fat_100g:0}}});

async function run(name, opts) {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const seen=[];
  await p.route(/search\.openfoodfacts\.org/, async r=>{
    const u=r.request().url();
    const q=decodeURIComponent((u.match(/[?&]q=([^&]*)/)||[])[1]||'');
    const full=!/[?&]fields=/.test(u);
    seen.push(q+(full?' [full]':''));
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hits:opts.answer(q,full)})});
  });
  await p.route(/cgi\/search\.pl/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"products":[]}'}));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.uncheck('#czOnly');
  await p.fill('#nameQ', opts.q||'schwar');
  await p.click('#nameBtn');
  await p.waitForTimeout(opts.wait||5000);
  const txt=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log(`${name}\n   dotazy: ${JSON.stringify(seen)}\n   ${txt.slice(0,230)}`);
  if (errs.length) console.log('   PAGEERROR:', errs.join(';'));
  await b.close(); return {seen,txt};
}
(async()=>{
  let r = await run('1) server ořezal nutriments → druhý pokus bez fields', {
    answer:(q,full)=> full ? [withE('Schwartau dzem')] : [noE('Schwartau dzem')] });
  console.log('   ✓ zopakoval bez fields:', r.seen.some(s=>s.includes('[full]')));
  console.log('   ✓ produkt zobrazen:', r.txt.includes('Schwartau'));

  r = await run('2) produkty opravdu nemají energii', {
    answer:()=> [noE('Neco'),noE('Neco2')], wait:6000 });
  console.log('   ✓ řekne kolik a proč:', r.txt.includes('bez výživových údajů'));
  console.log('   ✓ není to hlášeno jako výpadek:', !r.txt.includes('selhalo'));

  r = await run('3) jen kJ (bez kcal) se přepočítá', { answer:()=> [kjOnly('Kj produkt')] });
  console.log('   ✓ zobrazen s 100 kcal:', r.txt.includes('Kj produkt') && r.txt.includes('100 kcal'));

  r = await run('4) nulokalorický produkt se nezahodí', { answer:()=> [zero('Voda pramenita')] });
  console.log('   ✓ voda 0 kcal zobrazena:', r.txt.includes('Voda pramenita'));

  r = await run('5) část slova + část produktů bez hodnot', {q:'schin',
    answer:(q)=> q.includes('*') ? [withE('Schinken'),noE('Schinkenwurst')] : [] });
  console.log('   ✓ prefix použit:', r.seen.some(s=>s.startsWith('schin*')));
  console.log('   ✓ hláška o 1 zahozeném:', /1 další produkt/.test(r.txt));
  console.log('\nhotovo');
})();
