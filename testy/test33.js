const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const p = await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_/.test(m.text()))errs.push(m.text());});
  await p.route(/openfoodfacts/, r=>r.abort());
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(1000);

  // 30 dní: příjem 2400, aktivní 600, váha 84 → dyn cíl = 1800+600−400 = 2000
  await p.evaluate(async ()=>{
    for (let i=29;i>=0;i--){
      const x=new Date(); x.setDate(x.getDate()-i); const d=dstr(x);
      await dbPut('log',{date:d,productId:'x',name:'Strava',unit:'g',meal:'obed',amount:500,
        kcal:2400,p:140,c:250,f:80,fib:30,salt:5,ts:Date.now()-i*86400000});
      await dbPut('daily',{date:d,burn:600,weight:84});
    }
    goals = Object.assign(goals,{kcal:2000,p:130,c:220,f:65,rmr:1800,dyn:false,def:400,pKg:2,fKg:0.9});
    await dbPut('meta',{k:'goals',v:goals});
  });
  await p.reload(); await p.waitForTimeout(1200);

  await p.click('nav button[data-p="stats"]'); await p.click('#per30'); await p.waitForTimeout(1000);
  console.log('=== PEVNÝ REŽIM ===');
  console.log('makra:', (await p.textContent('#stMacros')).replace(/\s+/g,' ').trim().slice(0,120));
  console.log('postřeh o příjmu:', (await p.locator('#stInsights .postreh').first().textContent()).replace(/\s+/g,' ').trim());

  await p.click('nav button[data-p="set"]'); await p.click('#modeSeg button[data-m="dyn"]');
  await p.waitForTimeout(700);
  await p.click('nav button[data-p="stats"]'); await p.click('#per30'); await p.waitForTimeout(1200);
  console.log('\n=== DYNAMICKÝ REŽIM ===');
  const a = await p.evaluate(()=>{const x=statCache.a; return {tK:x.tK,tP:x.tP,tC:x.tC,tF:x.tF,dyn:x.dyn};});
  console.log('průměrné cíle:', JSON.stringify(a));
  console.log('  kontrola: kcal 1800+600−400 = 2000 · B 2·84 = 168 · T 0.9·84 = 76 · S (2000−672−684)/4 = '
    + ((2000-4*168-9*76)/4).toFixed(0));
  console.log('makra:', (await p.textContent('#stMacros')).replace(/\s+/g,' ').trim().slice(0,150));
  console.log('postřeh o příjmu:', (await p.locator('#stInsights .postreh').first().textContent()).replace(/\s+/g,' ').trim());
  const ins = await p.locator('#stInsights .postreh').allTextContents();
  console.log('postřeh o bílkovinách:', (ins.find(t=>/lkovin/.test(t))||'—').replace(/\s+/g,' ').trim());
  console.log('čára cíle v grafu:', (await p.locator('#chKcal text').allTextContents()).join(' | '));
  const sum = await p.evaluate(()=>summaryText());
  console.log('souhrn:'); sum.split('\n').slice(3,9).forEach(l=>console.log('  '+l));

  // proměnlivá zátěž → cíle se mají lišit den ode dne
  await p.evaluate(async ()=>{
    const all = await dbAll('daily');
    for (let i=0;i<all.length;i++){ all[i].burn = i%2 ? 200 : 1000; await dbPut('daily', all[i]); }
  });
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.click('nav button[data-p="stats"]'); await p.click('#per30'); await p.waitForTimeout(1200);
  const t2 = await p.evaluate(()=>({tK:statCache.a.tK, rozsah:[Math.min(...statCache.a.tg.map(x=>x.kcal)),
                                    Math.max(...statCache.a.tg.map(x=>x.kcal))]}));
  console.log('\nstřídavá zátěž: průměrný cíl =', t2.tK.toFixed(0), '| denní rozsah =', t2.rozsah.join(' až '));
  console.log('  kontrola: (1800+200−400)=1600 a (1800+1000−400)=2400, průměr 2000');
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
