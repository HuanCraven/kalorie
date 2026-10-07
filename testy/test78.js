/* Test v110 — kalendář a nekompletní dny v radách.

   1) Kalendář: šipkami po jednom dni se na týden starý oběd člověk proklikával
      dlouho a nevěděl, kam jde. Ťuknutím na datum se otevře měsíc s kaloriemi,
      ťuknutím na den se na něj přepne. Kopie odtamtud míří rovnou na dnešek.

   2) Rady a postřehy ve třech místech nekompletní dny nerespektovaly:
      · rozbor od Clauda dostal u nekompletního dne bílkoviny, sacharidy a tuky,
        dopočítal si z nich kalorie a radil podle „dne o 900 kcal" — a nevěděl,
        které dny jsou nekompletní, jen kolik;
      · postřeh „Data jsou děravá" počítal označené dny mezi chybějící, takže
        vyčítal díru, kterou člověk udělal schválně;
      · podíl alkoholu na energii bral alkohol ze všech dnů, ale jídlo jen z úplných
        — alkohol z nekompletního dne ležel v čitateli bez svého jídla. */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await PROSTREDI.blokujVenek(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });

  // den i dní zpátky od dneška, v místním čase
  const den = i => p.evaluate(i => { const x = new Date(); x.setDate(x.getDate() - i); return dstr(x); }, i);
  const d0 = await den(0), d3 = await den(3), d5 = await den(5);

  await p.evaluate(async ([d3, d5]) => {
    await dbPut('log', { date: d3, productId: 'x', name: 'Svíčková', unit: 'porce', amount: 1,
      meal: 'obed', kcal: 1850, p: 60, c: 180, f: 90, ts: 1 });
    await dbPut('log', { date: d5, productId: 'x', name: 'Rohlík', unit: 'ks', amount: 2,
      meal: 'snidane', kcal: 300, p: 10, c: 56, f: 4, ts: 2 });
    await zapisDen(d5, 'uzivatel', { neuplny: true });
  }, [d3, d5]);

  /* ---- 1. kalendář se otevře z data nahoře --------------------------- */
  await p.click('nav button[data-p="day"]'); await p.waitForTimeout(400);
  await p.click('#dayLabelBtn'); await p.waitForTimeout(500);
  ck('ťuknutí na datum otevře kalendář', await p.isVisible('#modKal'));

  const nazev = (await p.textContent('#kalNazev')).trim();
  const ocek = await p.evaluate(() => MES[new Date().getMonth()] + ' ' + new Date().getFullYear());
  ck('ukáže aktuální měsíc', nazev === ocek, nazev + ' / ' + ocek);

  const mriz = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#kalMrizka button')];
    const n = new Date(); const pocet = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    const prvni = (new Date(n.getFullYear(), n.getMonth(), 1).getDay() + 6) % 7;
    const prazdne = [...document.querySelectorAll('#kalMrizka > div:not(.hl)')].length;
    return { dnu: t.length, pocet, prvni, prazdne };
  });
  ck('má tolik dnů, kolik jich měsíc má', mriz.dnu === mriz.pocet, JSON.stringify(mriz));
  ck('a týden začíná pondělím', mriz.prazdne === mriz.prvni, JSON.stringify(mriz));

  ck('dnešek je orámovaný', await p.evaluate(d => {
    const b = document.querySelector('#kalMrizka button[data-den="' + d + '"]');
    return !!b && b.classList.contains('dnes');
  }, d0));
  ck('dopředu za dnešní měsíc to nepustí',
     await p.evaluate(() => document.getElementById('kalDalsi').disabled));

  /* ---- 2. dny ukážou, co v nich je ----------------------------------- */
  // d3 a d5 můžou padnout do minulého měsíce — pak se na něj přepne
  const najdi = async d => {
    const kde = await p.evaluate(d => !!document.querySelector('#kalMrizka button[data-den="' + d + '"]'), d);
    if (!kde) { await p.evaluate(() => kalMesic(-1)); await p.waitForTimeout(400); }
    return p.evaluate(d => {
      const b = document.querySelector('#kalMrizka button[data-den="' + d + '"]');
      return b ? { cls: b.className, k: b.querySelector('.k').textContent.trim(), dis: b.disabled } : null;
    }, d);
  };
  const b3 = await najdi(d3);
  ck('úplný den ukáže kalorie', b3 && b3.k === '1850', JSON.stringify(b3));
  ck('a je označený jako úplný', b3 && /\bupl\b/.test(b3.cls), JSON.stringify(b3));
  const b5 = await najdi(d5);
  ck('nekompletní den má svou barvu', b5 && /\bneu\b/.test(b5.cls), JSON.stringify(b5));
  await p.evaluate(() => kalOtevri()); await p.waitForTimeout(400);
  const bPrazdny = await p.evaluate(() => {
    const b = [...document.querySelectorAll('#kalMrizka button:not([disabled])')]
      .find(x => !x.classList.contains('upl') && !x.classList.contains('neu'));
    return b ? b.querySelector('.k').textContent.trim() : 'nic';
  });
  ck('prázdný den je bez čísla', bPrazdny === '', JSON.stringify(bPrazdny));

  /* ---- 3. první ťuknutí ukáže náhled, druhé přepne Hlavní (v121) ------ */
  await najdi(d3);
  await p.evaluate(d => document.querySelector('#kalMrizka button[data-den="' + d + '"]').click(), d3);
  await p.waitForTimeout(400);
  ck('první ťuknutí ukáže náhled dne', await p.isVisible('#kalNahled') &&
     /kcal/.test(await p.textContent('#kalNahled')), await p.textContent('#kalNahled'));
  ck('a kalendář zůstane otevřený', await p.isVisible('#modKal'));
  await p.evaluate(d => document.querySelector('#kalMrizka button[data-den="' + d + '"]').click(), d3);
  await p.waitForTimeout(700);
  ck('po výběru se kalendář zavře', !(await p.isVisible('#modKal')));
  ck('a Hlavní je na vybraném dni', await p.evaluate(() => curDate) === d3,
     await p.evaluate(() => curDate));
  ck('seznam ukazuje jídlo z toho dne',
     (await p.textContent('#logList')).indexOf('Svíčková') >= 0);

  /* ---- 4. kopie z minulého dne jde rovnou na dnešek ------------------- */
  await p.click('#logList input.vyb >> nth=0'); await p.waitForTimeout(300);
  ck('cíl kopie je předvyplněný na dnešek', (await p.inputValue('#vybrDatum')) === d0,
     await p.inputValue('#vybrDatum'));
  await p.evaluate(() => vybrKopiruj()); await p.waitForTimeout(700);
  const dnes = await p.evaluate(async d => (await dbByIdx('log', 'date', d)).map(r => r.name), d0);
  ck('položka se zkopírovala na dnešek', dnes.indexOf('Svíčková') >= 0, JSON.stringify(dnes));
  ck('originál zůstal, kde byl',
     (await p.evaluate(async d => (await dbByIdx('log', 'date', d)).length, d3)) === 1);
  ck('toast nabídne skok na dnešek', (await p.textContent('#toast')).indexOf('Ukázat') >= 0,
     await p.textContent('#toast'));

  /* ---- 5. tlačítko Dnes v kalendáři vrátí zpátky ---------------------- */
  await p.click('#dayLabelBtn'); await p.waitForTimeout(400);
  await p.evaluate(() => kalDnes()); await p.waitForTimeout(600);
  ck('Dnes vrátí Hlavní na dnešek', await p.evaluate(() => curDate) === d0);
  ck('popisek zase říká Dnes', (await p.textContent('#dayLabel')).trim() === 'Dnes');

  /* ---- 6. souhrn pro Clauda: nekompletní den bez jídla a se stavem ---- */
  await p.evaluate(async d5 => {
    await dbPut('log', { date: d5, productId: 'alk', name: 'Pivo', unit: 'ml', amount: 1000,
      meal: 'vecere', kcal: 430, p: 0, c: 36, f: 0, alc: 40, abv: 5, ts: 3 });
    go('stats'); setPeriod(7);
  }, d5);
  await p.waitForTimeout(1300);
  const sum = await p.evaluate(() => summaryText());
  const radek5 = sum.split('\n').find(l => l.indexOf(d5 + ';') >= 0) || '';
  const pole = radek5.trim().split(';');
  ck('nekompletní den má v řadě stav neúplný', pole[1] === 'neúplný', radek5);
  ck('a žádné jídlo — ani kalorie, ani makra', pole.slice(2, 6).every(x => x === ''), radek5);
  ck('alkohol z něj v řadě zůstal', pole[6] === '40', radek5);
  const radek3 = sum.split('\n').find(l => l.indexOf(d3 + ';') >= 0) || '';
  ck('úplný den má stav i kalorie', /;úplný;1850;/.test(radek3), radek3);
  ck('modelu se vysvětlí, co neúplný znamená', /neúplný = nestihlo se zapsat/.test(sum));
  ck('hlavička rozliší úplné, nekompletní a prázdné dny', /Úplných dnů: \d+\/7, nekompletních: 1, bez zápisu: \d+/.test(sum),
     (sum.split('\n').find(l => l.indexOf('Úplných') >= 0) || ''));

  /* ---- 7. postřeh o dírách vyčítá jen skutečné díry -------------------- */
  const ins = (await p.textContent('#stInsights')).replace(/\s+/g, ' ');
  ck('stará výtka „Data jsou děravá" zmizela', ins.indexOf('děravá') < 0, ins.slice(0, 200));
  ck('postřeh řekne, že nekompletní dny jsou vyřazené schválně',
     /označených jako nekompletní a do průměrů se schválně nepočítají/.test(ins), ins.slice(0, 260));
  ck('a zvlášť spočítá dny úplně bez zápisu', /bez zápisu/.test(ins), ins.slice(0, 260));

  /* ---- 8. podíl alkoholu jen z úplných dnů ----------------------------- */
  // v období: úplné d0 (1850) a d3 (1850), nekompletní d5 s pivem 40 g
  const a = await p.evaluate(() => ({ alc: statCache.a.alc, alcUpl: statCache.a.alcKcalUpl, kUpl: statCache.a.kUpl }));
  ck('gramy alkoholu se sčítají ze všech dnů', a.alc === 40, JSON.stringify(a));
  ck('ale do podílu z úplných dnů nejde nic', a.alcUpl === 0, JSON.stringify(a));
  const alkIns = ((await p.textContent('#stInsights')).match(/Alkohol:[^.]*\./) || [''])[0];
  ck('postřeh ukáže gramy', alkIns.indexOf('40 g') >= 0, alkIns);
  ck('a podíl na energii nevymýšlí, když k alkoholu chybí jídlo', alkIns.indexOf('%') < 0, alkIns);

  // teď pivo i na úplný den: podíl 40 g × 7,1 = 284 kcal z (1850 + 1850 + 430)
  await p.evaluate(async d3 => {
    await dbPut('log', { date: d3, productId: 'alk', name: 'Pivo', unit: 'ml', amount: 1000,
      meal: 'vecere', kcal: 430, p: 0, c: 36, f: 0, alc: 40, abv: 5, ts: 4 });
    return renderStats();
  }, d3);
  await p.waitForTimeout(1200);
  const a2 = await p.evaluate(() => ({ alcUpl: statCache.a.alcKcalUpl, kUpl: statCache.a.kUpl }));
  const podil = Math.round(a2.alcUpl / a2.kUpl * 1000) / 10;
  ck('podíl se počítá ze stejných dnů nahoře i dole', Math.abs(podil - 284 / 4130 * 100) < 0.2,
     podil + ' %');
  const alkIns2 = ((await p.textContent('#stInsights')).match(/Alkohol:[^.]*\./) || [''])[0];
  ck('a v postřehu se objeví s upřesněním', /v úplných dnech to je [\d,]+ %/.test(alkIns2), alkIns2);

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
