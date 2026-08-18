const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
const CASES = [
['1) TVŮJ PŘÍPAD – vnořené na_100_g + cela_rolka', `{
  "polozka": "Sýrová rolka (listové těsto se sirene), T Market",
  "poznamka": "Náplně málo, převažuje listové těsto",
  "hmotnost_g": { "odhad": 140, "rozsah": [130, 150] },
  "na_100_g": { "energie_kcal": 400, "tuky_g": 25, "z_toho_nasycene_g": 14,
    "sacharidy_g": 38, "bilkoviny_g": 7, "sul_g": 1.0 },
  "cela_rolka": { "energie_kcal": 560, "energie_kcal_rozsah": [500, 620], "tuky_g": 35,
    "z_toho_nasycene_g": 20, "sacharidy_g": 53, "bilkoviny_g": 10, "sul_g": 1.4 },
  "spolehlivost": "hrubý odhad z fotografie, chyba ±15 %"
}`, {mn:140, kcal:560, b:9.8, s:53.2, t:35}],
['2) jen celkové hodnoty za porci', `{"nazev":"Bageta","hmotnost_g":200,
  "celkem":{"kcal":520,"bilkoviny_g":18,"sacharidy_g":70,"tuky_g":16}}`, {mn:200, kcal:520, b:18, s:70, t:16}],
['3) plochý objekt na 100 g', `{"nazev":"Tvaroh","gramaz":250,"energie_kcal":103,
  "bilkoviny_g":12.5,"sacharidy_g":3.8,"tuky_g":4.5}`, {mn:250, kcal:258, b:31.3, s:9.5, t:11.3}],
['4) původní formát s polem polozky', `{"jidlo":"Oběd","polozky":[
  {"nazev":"Kuřecí prsa","mn":150,"kcal":165,"b":31,"s":0,"t":3.6},
  {"nazev":"Rýže","mn":200,"kcal":130,"b":2.7,"s":28,"t":0.3}]}`, {kcal:508}],
['5) anglické klíče', `{"name":"Croissant","weight_g":60,"per_100g":
  {"energy_kcal":406,"protein_g":8.2,"carbohydrates_g":45,"fat_g":21}}`, {mn:60, kcal:244, b:4.9, s:27, t:12.6}],
['6) rozsah místo čísla', `{"polozka":"Guláš","hmotnost_g":[300,400],
  "na_100_g":{"energie_kcal":120,"bilkoviny_g":9,"sacharidy_g":6,"tuky_g":7}}`, {mn:350, kcal:420}]
];
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(800);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  const num=v=>parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'));
  let ok=0, bad=[];
  for (const [name, txt, exp] of CASES) {
    await p.evaluate(t => processAI(t), txt); await p.waitForTimeout(350);
    const rows = await p.locator('#aiList .item').count();
    if (!rows) { bad.push(name+' → nerozpoznáno'); console.log('✗ '+name+'\n    nerozpoznáno'); continue; }
    const tot = num(await p.textContent('#aiTotK'));
    const mac = (await p.textContent('#aiTotM')).split('/').map(num);
    const amt = rows===1 ? num(await p.inputValue('#aiList input')) : null;
    const chk = [];
    if (exp.mn!==undefined) chk.push(['gramáž', Math.abs(amt-exp.mn)<=1, amt+'/'+exp.mn]);
    if (exp.kcal!==undefined) chk.push(['kcal', Math.abs(tot-exp.kcal)<=3, tot+'/'+exp.kcal]);
    if (exp.b!==undefined) chk.push(['B', Math.abs(mac[0]-exp.b)<=0.5, mac[0]+'/'+exp.b]);
    if (exp.s!==undefined) chk.push(['S', Math.abs(mac[1]-exp.s)<=0.5, mac[1]+'/'+exp.s]);
    if (exp.t!==undefined) chk.push(['T', Math.abs(mac[2]-exp.t)<=0.5, mac[2]+'/'+exp.t]);
    const fails = chk.filter(c=>!c[1]);
    if (fails.length) { bad.push(name+' → '+fails.map(f=>f[0]+' '+f[2]).join(', ')); console.log('✗ '+name);
      console.log('    '+chk.map(c=>(c[1]?'✓':'✗')+c[0]+' '+c[2]).join('  ')); }
    else { ok++; console.log('✓ '+name+'\n    '+rows+' pol. · '+tot+' kcal · B'+mac[0]+' S'+mac[1]+' T'+mac[2]+
      (amt?' · '+amt+' g':'')); }
    const nt = (await p.textContent('#aiNote')).trim();
    if (nt) console.log('    pozn: '+nt.slice(0,70));
  }
  console.log(`\nPROŠLO ${ok}/${CASES.length}`);
  if (bad.length) bad.forEach(x=>console.log('  • '+x));
  console.log('JS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
