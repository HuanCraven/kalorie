const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);

  // Deterministický scénář: sledování od 1.7. (32 dní vč. dneška 1.8.)
  // Červenec: 4 dny po 20 g = 80 g.  Srpen (dnes 1.8.): 1 den 30 g.
  const info = await p.evaluate(async ()=>{
    const mk = async (d,g)=>dbPut('log',{date:d,productId:'alk',name:'Pivo',unit:'ml',meal:'vecere',
      amount:500,kcal:g*7.1,p:0,c:0,f:0,alc:g,abv:5,ts:Date.now()});
    await dbPut('log',{date:'2026-07-01',productId:'x',name:'Start',unit:'g',meal:'obed',
      amount:100,kcal:100,p:1,c:1,f:1,ts:Date.now()});           // začátek sledování
    for (const d of ['2026-07-05','2026-07-12','2026-07-20','2026-07-28']) await mk(d,20);
    await mk('2026-08-01',30);
    return 'ok';
  });
  await p.evaluate(()=>setAddDate('2026-08-01')); await p.waitForTimeout(800);

  const st = await p.evaluate(()=>alcStats());
  console.log('výpočet:', JSON.stringify({avg7:+st.avg7.toFixed(2), mSum:st.mSum, mDays:st.mDays,
    avgM:+st.avgM.toFixed(2), allSum:st.allSum, allDays:st.allDays, avgAll:+st.avgAll.toFixed(2),
    mName:st.mName, first:st.first}));

  const ok=[];
  ok.push(['7 dní: 28.7. (20 g) + 1.8. (30 g) = 50 / 7 = 7.14', Math.abs(st.avg7-50/7)<0.01]);
  ok.push(['srpen: 30 g / 1 den = 30', st.mSum===30 && st.mDays===1 && Math.abs(st.avgM-30)<0.01]);
  ok.push(['celkem: 110 g / 32 dní = 3.44', st.allSum===110 && st.allDays===32 && Math.abs(st.avgAll-110/32)<0.01]);
  ok.push(['název měsíce česky', st.mName==='srpen']);
  ok.push(['počítá od prvního záznamu v deníku', st.first==='2026-07-01']);
  ok.forEach(([n,c])=>console.log((c?'✓ ':'✗ ')+n));

  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(700);
  console.log('\nstránka Alkohol: ø období =', await p.textContent('#alcAvgP'),
              '| ø'+await p.textContent('#alcMName')+' =', await p.textContent('#alcAM'),
              '| øcelkem =', await p.textContent('#alcAAll'));
  console.log('  součty: 7d =', await p.textContent('#alc7'), '| 30d =', await p.textContent('#alc30'),
              '| dní bez =', await p.textContent('#alcDry'));
  console.log('  poznámka:', (await p.textContent('#alcAvgNote')).trim());

  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(700);
  console.log('\nhlavní stránka:', (await p.textContent('#alcToday')).trim(), 'g dnes |',
              (await p.textContent('#alcWeek')).trim(), '|', (await p.textContent('#alcMonth')).trim());

  // přepnutí na červenec musí přepočítat měsíc na celý červenec
  await p.evaluate(()=>setAddDate('2026-07-31')); await p.waitForTimeout(800);
  const st2 = await p.evaluate(()=>alcStats());
  console.log('\npři pohledu na 31.7.: měsíc =', st2.mName, '| dnů =', st2.mDays,
              '| součet =', st2.mSum, '| ø =', st2.avgM.toFixed(2), '(80/31=2.58)');
  console.log((Math.abs(st2.avgM-80/31)<0.01 && st2.mDays===31 ? '✓ ' : '✗ ')+'minulý měsíc se dělí celým měsícem');

  await p.click('nav button[data-p="stats"]'); await p.waitForTimeout(900);
  const sum = await p.evaluate(()=>summaryText());
  const line = sum.split('\n').find(l=>l.includes('denní průměr'));
  console.log('\nv souhrnu pro Claude:', line ? line.trim() : 'CHYBÍ');
  await p.click('nav button[data-p="alc"]'); await p.waitForTimeout(600);
  await p.screenshot({path:PROSTREDI.DIR+'/s4-alc.png', fullPage:true});
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(500);
  await p.screenshot({path:PROSTREDI.DIR+'/s4-day.png'});
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
