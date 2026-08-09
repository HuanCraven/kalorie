/* Test v57 — zkratky ikony aplikace (manifest shortcuts + parametr ?jdi=) */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

const CEKANE = [
  { url: './?jdi=scan', jdi: 'scan', stranka: 'p-scan', name: 'Zapsat jídlo' },
  { url: './?jdi=alc',  jdi: 'alc',  stranka: 'p-alc',  name: 'Zapsat nápoj' },
  { url: './?jdi=fit',  jdi: 'fit',  stranka: 'p-fit',  name: 'Zapsat cvičení' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  PAGEERROR: ' + e.message); fail++; });

  /* ---- 1. manifest -------------------------------------------------- */
  const man = await (await ctx.request.get('http://127.0.0.1:8811/manifest.json')).json();
  ck('manifest má zkratky', Array.isArray(man.shortcuts) && man.shortcuts.length === 3,
     JSON.stringify((man.shortcuts || []).length));

  const zk = man.shortcuts || [];
  for (let i = 0; i < CEKANE.length; i++) {
    const s = zk[i] || {};
    ck(`zkratka ${i + 1} je „${CEKANE[i].name}" a míří na ${CEKANE[i].url}`,
       s.name === CEKANE[i].name && s.url === CEKANE[i].url,
       JSON.stringify({ name: s.name, url: s.url }));
    ck(`zkratka ${i + 1} má krátký název pro málo místa`,
       typeof s.short_name === 'string' && s.short_name.length > 0 && s.short_name.length <= 12,
       s.short_name);
  }

  /* ---- 2. ikony ----------------------------------------------------- */
  const src = zk.map(s => (s.icons && s.icons[0] || {}).src || '');
  ck('každá zkratka má vlastní ikonu', src.every(u => u.startsWith('data:image/png;base64,')),
     src.map(u => u.slice(0, 22)).join(' | '));
  ck('ikony zkratek se navzájem liší', new Set(src).size === 3,
     'různých: ' + new Set(src).size);
  ck('ikony zkratek nejsou jen kopie ikony aplikace',
     !src.includes((man.icons[0] || {}).src));
  // PNG začíná signaturou \x89PNG a hlavičkou IHDR 512x512
  const rozmery = src.map(u => {
    const b = Buffer.from(u.split(',')[1], 'base64');
    return b.slice(1, 4).toString() === 'PNG' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : 'neplatné';
  });
  ck('ikony jsou platné PNG 512x512', rozmery.every(r => r === '512x512'), rozmery.join(' '));

  /* ---- 3. zkratky opravdu někam vedou -------------------------------- */
  for (const c of CEKANE) {
    await p.goto('http://127.0.0.1:8811/index.html?jdi=' + c.jdi);
    await p.waitForFunction(() => typeof db !== 'undefined' && db, null, { timeout: 15000 });
    await p.waitForTimeout(300);
    const otevrena = await p.evaluate(() => {
      const e = document.querySelector('[id^=p-].on');
      return e ? e.id : '(žádná)';
    });
    ck(`?jdi=${c.jdi} otevře ${c.stranka}`, otevrena === c.stranka, otevrena);
  }
  // Zapsat jídlo má rovnou nabídnout hledání, ne poslední použitý panel
  ck('?jdi=scan otevře panel Hledat',
     await p.goto('http://127.0.0.1:8811/index.html?jdi=scan')
       .then(() => p.waitForTimeout(600))
       .then(() => p.evaluate(() => {
         const b = document.querySelector('#addSeg button.on');
         return b && b.dataset.s === 'find';
       })));

  /* ---- 4. bez parametru a s nesmyslem -------------------------------- */
  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(600);
  ck('bez parametru se otevře Hlavní',
     await p.evaluate(() => document.getElementById('p-day').classList.contains('on')));

  await p.goto('http://127.0.0.1:8811/index.html?jdi=neexistuje');
  await p.waitForTimeout(600);
  ck('neznámá hodnota nerozbije start (zůstane Hlavní)',
     await p.evaluate(() => document.getElementById('p-day').classList.contains('on')));

  console.log(fail ? 'NEPROŠLO: ' + fail : 'vše prošlo');
  await browser.close();
})();
