/* Test v108 — zábradlí u cílů a běžný pohyb mimo cvičení.

   Vzniklo po průchodu aplikací očima někoho, kdo necvičí. Model cílů byl
   postavený na aktivním člověku a u sedavého se rozpadl: sedavá žena 65 kg
   dostala cíl 945 kcal, bílkoviny 55 % energie a sacharidy 0 g — bílkoviny
   a tuky samy spotřebovaly celý rozpočet.

   Hlídá se obojí: že zábradlí drží u lidí, na které je model krátký, a že se
   NEDOTKNE toho, kdo se hýbe. Kdyby se ta hranice posunula, tichý posun cílů
   u aktivního člověka by si nikdo nevšiml. */
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

  // spočítá cíle pro daného člověka, aniž by sahal na obrazovku
  const cile = (poh, kg, def, pal, rmr, vydej) => p.evaluate(async ([poh, kg, def, pal, rmr, vydej]) => {
    goals.rmr = rmr; goals.def = def; goals.dyn = true; goals.pal = pal;
    goals.pohlavi = poh; goals.pKg = 2.0; goals.fKg = 0.9;
    await dbPut('meta', { k: 'goals', v: goals });
    const v = vydej || zakladniVydej();
    const t = cileZVydeje(kg, v);
    return { vydej: v, kcal: t.kcal, p: t.p, c: t.c, f: t.f, om: t.omezeno };
  }, [poh, kg, def, pal, rmr, vydej]);

  /* ---- 1. sedavá žena, kvůli které to celé vzniklo ------------------ */
  const z = await cile('z', 65, 550, 1.2, 1345, 0);
  ck('sedavé ženě zůstanou sacharidy', z.c > 0, JSON.stringify(z));
  ck('a je jich aspoň patnáctina energie', z.c * 4 / z.kcal >= 0.15,
     Math.round(z.c * 4 / z.kcal * 100) + ' %');
  ck('cíl nespadne pod 1200 kcal', z.kcal >= 1200, String(z.kcal));
  ck('bílkoviny nepřesáhnou 35 % energie', z.p * 4 / z.kcal <= 0.351,
     Math.round(z.p * 4 / z.kcal * 100) + ' %');
  ck('a aplikace přizná, že cíl omezila', z.om === true);

  /* ---- 2. nejmenší člověk narazí na podlahu ------------------------- */
  const m = await cile('z', 58, 550, 1.2, 1194, 0);
  ck('drobná žena skončí přesně na podlaze', m.kcal === 1200, String(m.kcal));
  ck('i tak jí zbydou sacharidy', m.c > 50, String(m.c));

  /* ---- 3. muž má podlahu výš --------------------------------------- */
  const mu = await cile('m', 82, 550, 1.2, 1729, 0);
  ck('muži cíl nespadne pod 1500 kcal', mu.kcal >= 1500, String(mu.kcal));
  ck('deficit se ořeže na čtvrtinu výdeje', mu.vydej - mu.kcal <= mu.vydej * 0.25 + 1,
     (mu.vydej - mu.kcal) + ' z ' + mu.vydej);

  /* ---- 4. kdo se hýbe, ten zábradlí nepotká ------------------------- */
  const h = await cile('m', 85, 300, 1, 1800, 3000);
  ck('při výdeji 3000 se nic neomezuje', h.om === false);
  ck('energie je pořád výdej minus deficit', h.kcal === 2700, String(h.kcal));
  ck('bílkoviny zůstaly 2 g/kg', h.p === 170, String(h.p));
  ck('tuky zůstaly na 30 % energie', h.f === 90, String(h.f));
  ck('a sacharidy dopočítaly zbytek', h.c === 303, String(h.c));

  /* ---- 5. nabírání se nestropuje ------------------------------------ */
  const nb = await cile('m', 85, -300, 1, 1800, 3000);
  ck('při nabírání se přidá celý přebytek', nb.kcal === 3300, String(nb.kcal));
  ck('a nic se nehlásí jako omezené', nb.om === false);

  /* ---- 6. běžný pohyb mimo cvičení ---------------------------------- */
  const zv = await p.evaluate(async () => {
    goals.rmr = 1800; goals.pal = 1; await dbPut('meta', { k: 'goals', v: goals });
    const bez = zakladniVydej();
    goals.pal = 1.375;
    const s = zakladniVydej();
    const dd = { burn: 200 };
    const v = vydejDne(dd, 300);
    return { bez, s, vydej: v.out };
  });
  ck('bez násobitele je základ jen klidový výdej', zv.bez === 1800, String(zv.bez));
  ck('s násobitelem povyroste', zv.s === 2475, String(zv.s));
  ck('cvičení a aktivní kcal se přičítají navrch', zv.vydej === 2475 + 200 + 300,
     String(zv.vydej));

  /* ---- 7. celkový výdej z hodinek má pořád přednost ------------------ */
  const hod = await p.evaluate(() => vydejDne({ total: 2900, burn: 500 }, 400));
  ck('celkový výdej z hodinek násobitel neobchází', hod.out === 2900 && hod.celkovy === true,
     JSON.stringify(hod));

  /* ---- 8. uložení nastavení nesmí nová pole ztratit ------------------
     saveGoals staví `goals` od nuly. Přesně tak kdysi mizely zdravotní údaje. */
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(400);
  const po = await p.evaluate(async () => {
    goals.pal = 1.55; goals.pohlavi = 'z';
    await dbPut('meta', { k: 'goals', v: goals });
    fillGoals();
    await saveGoals();
    const m = await dbGet('meta', 'goals');
    return { pal: m.v.pal, pohlavi: m.v.pohlavi };
  });
  ck('násobitel přežije uložení nastavení', po.pal === 1.55, String(po.pal));
  ck('pohlaví taky', po.pohlavi === 'z', String(po.pohlavi));

  /* ---- 9. Hlavní a Statistiky počítají týmž ------------------------- */
  const shoda = await p.evaluate(async () => {
    goals.rmr = 1400; goals.pal = 1.375; goals.pohlavi = 'z'; goals.def = 550;
    goals.dyn = true; goals.pKg = 2.0; goals.fKg = 0.9;
    await dbPut('meta', { k: 'goals', v: goals });
    await zapisDen(curDate, 'uzivatel', { weight: 62 });
    const den = await dayTargets(curDate, zakladniVydej());
    const stat = cileZVydeje(62, zakladniVydej());
    return { den: [den.kcal, den.p, den.c, den.f], stat: [stat.kcal, stat.p, stat.c, stat.f] };
  });
  ck('obě obrazovky dají tatáž čísla',
     JSON.stringify(shoda.den) === JSON.stringify(shoda.stat), JSON.stringify(shoda));

  /* ---- 10. průvodce uloží, co potřebuje výpočet --------------------- */
  await p.evaluate(async () => { await dbDel('meta', 'uvodHotovo'); goals.rmr = 0; });
  await p.evaluate(() => document.body.classList.add('verejna'));
  await p.evaluate(() => uvodOtevri(2)); await p.waitForTimeout(400);
  await p.selectOption('#uvPohlavi', 'z');
  await p.fill('#uvVek', '35'); await p.fill('#uvVyska', '165'); await p.fill('#uvVaha', '65');
  await p.selectOption('#uvPal', '1.55');
  await p.waitForTimeout(300);
  const txt = await p.textContent('#uvRmrTxt');
  ck('průvodce ukáže i výdej s běžným pohybem', txt.indexOf('2085') >= 0, txt);
  await p.click('#uvBtn2'); await p.waitForTimeout(300);
  await p.click('#uv3 button >> nth=0'); await p.waitForTimeout(800);
  const g = await p.evaluate(() => ({ pal: goals.pal, poh: goals.pohlavi, def: goals.def }));
  ck('uloží násobitel', g.pal === 1.55, String(g.pal));
  ck('uloží pohlaví', g.poh === 'z', String(g.poh));
  ck('a cíl v kilech za týden převede na kalorie', g.def === 550, String(g.def));

  /* ---- 11. výchozí bílkoviny a převod pro dřívější uživatele --------
     Výchozí hodnota klesla z 2,0 na 1,5 g/kg. Dvojka byla Huanova, sportovcova;
     u sedavého člověka narazila na strop 35 % a číslo se pak opíralo o strop,
     ne o doporučení. Kdo má aplikaci nastavenou, ten o svou dvojku přijít nesmí. */
  const vych = await p.evaluate(async () => {
    await dbDel('meta', 'goals');
    delete goals.pKg;
    goals.rmr = 1600; goals.pal = 1.2; goals.pohlavi = 'z'; goals.def = 550; goals.dyn = true;
    const t = cileZVydeje(65, 1920);
    return { p: t.p, kcal: t.kcal };
  });
  ck('nový člověk dostane 1,5 g/kg', vych.p === 98, String(vych.p));
  ck('a strop 35 % na něj nedosáhne', vych.p * 4 / vych.kcal < 0.35,
     Math.round(vych.p * 4 / vych.kcal * 100) + ' %');

  const prevod = await p.evaluate(async () => {
    // nastavený člověk, kterému se pKg nikdy neuložilo
    await dbPut('meta', { k: 'goals', v: { kcal: 2000, p: 130, c: 220, f: 65, rmr: 1800, dyn: true, def: 300 } });
  });
  await p.reload();
  await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
  await p.waitForTimeout(600);
  ck('kdo má aplikaci nastavenou, ponechá si 2 g/kg',
     await p.evaluate(() => goals.pKg) === 2.0, String(await p.evaluate(() => goals.pKg)));
  const huan = await p.evaluate(() => cileZVydeje(85, 3000));
  ck('a jeho cíle se nehnuly', huan.p === 170 && huan.f === 90 && huan.c === 303,
     JSON.stringify(huan));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
  process.exit(0);
})();
