/* Spočítá výživové hodnoty hotových jídel ze surovin a vygeneruje jidla.js.
   Postup: sečti živiny všech syrových surovin → vyděl hmotností hotového pokrmu (w).
   Vaření nemění množství živin, mění jen hmotnost (odpaří se voda) — proto tenhle model.
   Kontrola: Atwater (4/4/9 + vláknina 2) musí zhruba sedět s uvedenou energií. */
const fs = require('fs');
const path = require('path');
const EXTRA = require('./extra.js');
const REC = require('./receptury.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'zaklad.js'), 'utf8');
let ZAKLAD;
eval(src.replace('window.ZAKLAD', 'ZAKLAD'));

const BASE = {};
ZAKLAD.forEach(z => { BASE[z.n] = { e: z.e, p: z.p, c: z.c, f: z.f, v: z.v || 0, s: z.s || 0 }; });
Object.keys(EXTRA).forEach(k => { if (!BASE[k]) BASE[k] = EXTRA[k]; });

const r1 = x => Math.round(x * 10) / 10;
const r0 = x => Math.round(x);

const out = [];
const byName = {};
const problems = [];

for (const d of REC) {
  const tot = { e: 0, p: 0, c: 0, f: 0, v: 0, s: 0 };
  let rawW = 0;
  for (const [name, g] of d.sur) {
    const b = BASE[name] || byName[name];
    if (!b) { problems.push(`${d.n}: neznámá surovina „${name}"`); continue; }
    rawW += g;
    for (const k of ['e', 'p', 'c', 'f', 'v', 's']) tot[k] += (b[k] || 0) * g / 100;
  }
  if (!d.w || d.w <= 0) { problems.push(`${d.n}: chybí hmotnost hotového pokrmu`); continue; }
  // vypečený tuk, který se slije / zůstane na plechu — odečítá se i s energií
  if (d.odkap) { tot.f -= d.odkap; tot.e -= d.odkap * 9; }
  const per = {};
  for (const k of ['e', 'p', 'c', 'f', 'v', 's']) per[k] = tot[k] * 100 / d.w;

  // suché těstoviny/rýže/luštěniny/kroupy varem nasáknou vodu — pokrm pak smí být těžší
  const DRY = /syrov|Kroupy|Krupice|Mouka|Vločky/i;
  let soak = 0;
  for (const [name, g] of d.sur) if (DRY.test(name)) soak += g * 1.6;
  const yieldPct = d.w / (rawW + soak) * 100;
  if (yieldPct > 105) problems.push(`${d.n}: hotové jídlo těžší než suroviny (${r0(yieldPct)} %)`);
  if (yieldPct < 40) problems.push(`${d.n}: výtěžnost jen ${r0(yieldPct)} % — opravdu?`);

  // Atwater: kcal ze živin vs. spočítaná energie
  const atw = 4 * per.p + 4 * Math.max(0, per.c - per.v) + 9 * per.f + 2 * per.v;
  const dev = per.e > 0 ? Math.abs(atw - per.e) / per.e * 100 : 0;
  if (per.e > 25 && dev > 12) problems.push(`${d.n}: energie nesedí se živinami (${r0(per.e)} vs ${r0(atw)} kcal, ${r0(dev)} %)`);

  const rec = {
    n: d.n, k: d.k,
    e: r0(per.e), p: r1(per.p), c: r1(per.c), f: r1(per.f), v: r1(per.v), s: r1(per.s),
    w: d.w, sur: d.sur.length
  };
  out.push(rec);
  byName[d.n] = { e: per.e, p: per.p, c: per.c, f: per.f, v: per.v, s: per.s };
}

if (problems.length) {
  console.log('UPOZORNĚNÍ:');
  problems.forEach(p => console.log('  ! ' + p));
  console.log('');
}

const dup = out.map(x => x.n).filter((x, i, a) => a.indexOf(x) !== i);
if (dup.length) { console.error('DUPLICITNÍ NÁZVY: ' + dup.join(', ')); process.exit(1); }

out.sort((a, b) => a.k.localeCompare(b.k, 'cs') || a.n.localeCompare(b.n, 'cs'));

const head = `/* Hotová česká jídla — hodnoty na 100 g hotového pokrmu.
   Vygenerováno z build/receptury.js a build/extra.js, needituj ručně.
   n=název k=kategorie e=kcal p=bílkoviny c=sacharidy f=tuky v=vláknina s=sůl
   w=hmotnost pokrmu, ze které se počítalo (jen informativní) */\n`;
fs.writeFileSync(path.join(__dirname, '..', 'jidla.js'),
  head + 'window.JIDLA = ' + JSON.stringify(out) + ';\n');

console.log('jídel:', out.length);
console.log('kategorie:', [...new Set(out.map(x => x.k))].join(', '));
console.log('problémů:', problems.length);
console.log('\nrozsah kcal/100 g:', Math.min(...out.map(x => x.e)), '–', Math.max(...out.map(x => x.e)));
