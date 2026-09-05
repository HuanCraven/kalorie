/* Test v104 — cíl tuků roste s energií, ne jen s váhou.
   Dřív se počítal jako 0,9 g/kg bez ohledu na výdej, takže při cíli 2700 kcal
   vycházelo 26 % energie z tuků a při 3500 už jen 20 % — cíl byl tím přísnější,
   čím víc se člověk hýbal. Nově se bere větší z minima a podílu na energii. */
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

  const rada = await p.evaluate(async () => {
    goals.dyn = true; goals.def = 300; goals.pKg = 2.0; goals.fKg = 0.9; goals.rmr = 1800;
    await dbPut('meta', { k: 'goals', v: goals });
    const w = 85;
    return [2000, 2500, 3000, 3500].map(vydej => {
      const kcal = Math.max(800, r0(vydej - 300));
      const f = cilTuku(w, kcal), pr = r0(2.0 * w);
      return { vydej, kcal, f, pctE: Math.round(f * 9 / kcal * 100),
        c: Math.max(0, r0((kcal - 4 * pr - 9 * f) / 4)) };
    });
  });
  const u = v => rada.find(x => x.vydej === v);

  /* ---- 1. při vysokém výdeji rozhoduje podíl na energii ------------ */
  ck('při výdeji 3000 drží tuky 30 % energie', u(3000).pctE === 30, JSON.stringify(u(3000)));
  ck('a při 3500 taky', u(3500).pctE === 30, JSON.stringify(u(3500)));
  ck('cíl tuků s výdejem roste', u(3500).f > u(3000).f, u(3000).f + ' → ' + u(3500).f);

  /* ---- 2. při nízkém výdeji drží fyziologické minimum -------------- */
  ck('při výdeji 2000 nespadne pod 0,9 g/kg', u(2000).f === 77, String(u(2000).f));
  ck('a to znamená víc než 30 % energie, což je v pořádku',
     u(2000).pctE > 30, String(u(2000).pctE));

  /* ---- 3. celkové kalorie se tím nemění --------------------------- */
  ck('energie zůstává výdej minus deficit',
     rada.every(x => x.kcal === x.vydej - 300), JSON.stringify(rada.map(x => x.kcal)));
  ck('mění se jen dělení: sacharidy dopočítají zbytek',
     rada.every(x => Math.abs((4 * 170 + 9 * x.f + 4 * x.c) - x.kcal) <= 4),
     JSON.stringify(rada));

  /* ---- 4. platí to na Hlavní i ve statistikách -------------------- */
  const denni = await p.evaluate(async () => {
    const den = i => { const x = new Date(curDate + 'T12:00:00'); x.setDate(x.getDate() - i); return dstr(x); };
    for (let i = 0; i < 3; i++) {
      await zapisDen(den(i), 'uzivatel', { weight: 85 });
      await zapisDen(den(i), 'hodinky', { total: 3000 });
      // bez zapsaného jídla nemají statistiky co průměrovat
      await dbPut('log', { date: den(i), productId: 'quick', name: 'Jídlo', unit: 'porce',
        amount: 1, meal: 'obed', kcal: 2600, p: 160, c: 300, f: 85, ts: Date.now() });
    }
    go('day'); await renderDay();
    const cil = ($('kcalGoal').textContent.match(/\d+/) || [])[0];
    go('stats'); setPeriod(7); await renderStats();
    return { cilDne: cil, makra: $('stMacros').textContent.replace(/\s+/g, ' ') };
  });
  await p.waitForTimeout(600);
  ck('denní cíl vychází z celkového výdeje (3000 − 300)', denni.cilDne === '2700', denni.cilDne);
  ck('statistiky počítají s týmž cílem tuků (90 g)',
     denni.makra.indexOf('/ 90 g') > 0, denni.makra.slice(0, 160));

  /* ---- 5. nastavení to vysvětlí ----------------------------------- */
  const napoveda = await p.evaluate(async () => {
    go('set'); await dynUi(); return $('dynHint').textContent;
  });
  ck('nápověda mluví o minimu i o podílu na energii',
     napoveda.indexOf('minimum') > 0 && napoveda.indexOf('30 % energie') > 0,
     napoveda.slice(0, 160));
  ck('a říká, že celkové kalorie to nemění',
     napoveda.indexOf('celkové kalorie to nemění') > 0, napoveda.slice(0, 200));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
