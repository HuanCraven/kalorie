const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const P = (n)=>({_source:{code:'40001'+n,product_name:n,brands:'X',
  nutriments:{'energy-kcal_100g':112,proteins_100g:18,carbohydrates_100g:1,fat_100g:4}}});

async function run(name, opts={}) {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const seen=[];
  await p.route(/search\.openfoodfacts\.org/, async r => {
    const q=decodeURIComponent((r.request().url().match(/[?&]q=([^&]*)/)||[])[1]||'');
    seen.push(q);
    const hits = opts.answer(q);
    await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hits})});
  });
  await p.route(/cgi\/search\.pl/, r=>r.fulfill({status:200,contentType:'application/json',body:'{"products":[]}'}));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="find"]');
  await p.uncheck('#czOnly');
  await p.fill('#nameQ', opts.q);
  await p.click('#nameBtn');
  await p.waitForTimeout(opts.wait||4000);
  const txt=(await p.textContent('#nameRes')).replace(/\s+/g,' ').trim();
  console.log(`${name}\n   dotazy: ${JSON.stringify(seen)}\n   ${txt.slice(0,190)}`);
  if (errs.length) console.log('   PAGEERROR:', errs.join(';'));
  await b.close(); return {seen, txt};
}
(async () => {
  // 1) přesná shoda existuje → hvězdička se vůbec nepoužije
  let r = await run('1) přesné slovo najde výsledky', {q:'schinken',
    answer:q=> q.includes('*')?[]:[P('Schinken gekocht')]});
  console.log('   ✓ jen jeden dotaz, bez hvězdičky:', r.seen.length===1 && !r.seen[0].includes('*'));

  // 2) část slova → nic přesného, hvězdička najde
  r = await run('2) část slova (schin)', {q:'schin',
    answer:q=> q.includes('*')?[P('Schinken gekocht'),P('Schinkenwurst')]:[]});
  console.log('   ✓ druhý dotaz byl "schin*":', r.seen[1]==='schin*');
  console.log('   ✓ zobrazil výsledky:', r.txt.includes('Schinken gekocht'));
  console.log('   ✓ vysvětlivka o začátku slova:', r.txt.includes('začátku slova'));

  // 3) dvě slova → hvězdička u obou
  r = await run('3) dvě slova (slun chleb)', {q:'slun chleb',
    answer:q=> q.includes('*')?[P('Slunecnicovy chleb')]:[]});
  console.log('   ✓ dotaz "slun* chleb*":', r.seen[1]==='slun* chleb*');

  // 4) krátké slovo (2 písmena) se nehvězdičkuje
  r = await run('4) krátké slovo (ry)', {q:'ry', answer:()=>[]});
  console.log('   ✓ bez hvězdičky u 2 písmen:', r.seen.every(s=>!s.includes('*')));

  // 5) nic nenajde ani s hvězdičkou → čitelná hláška
  r = await run('5) nenajde nic ani podle začátku', {q:'xyzabc', answer:()=>[], wait:5000});
  console.log('   ✓ hláška o začátku slova v chybě:', r.txt.includes('začátku slova'));
  console.log('\nhotovo');
})();
