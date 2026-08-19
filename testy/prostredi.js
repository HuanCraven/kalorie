// Prostředí pro testy — kde je prohlížeč a kam patří fixtures a snímky obrazovky.
// Dřív byly obě cesty zadrátované na linuxový sandbox (/opt/pw-browsers, /home/claude),
// takže regrese šla spustit jen tam. Tohle je najde všude a dá se přepsat proměnnými:
//   KAL_CHROME  cesta k prohlížeči (jinak se hledá Chrome/Edge/Chromium v obvyklých místech)
//   KAL_DIR     složka pro alco.bin, nutri.csv, bc.y4m a snímky (jinak temp)
const fs = require('fs');
const os = require('os');
const path = require('path');

function najdiProhlizec() {
  // KAL_CHROME=playwright = ať si Playwright vezme vlastní stažené Chromium.
  // V CI je to jistota: runner sice svůj Chrome mívá, ale která verze, to se mění.
  if (process.env.KAL_CHROME === 'playwright') return undefined;
  if (process.env.KAL_CHROME) return process.env.KAL_CHROME;
  const kandidati = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  // undefined = ať si Playwright vezme vlastní stažené Chromium
  return kandidati.find(c => fs.existsSync(c)) || undefined;
}

const EXE = najdiProhlizec();
const DIR = process.env.KAL_DIR || path.join(os.tmpdir(), 'kalorie-testy');
fs.mkdirSync(DIR, { recursive: true });

/* Zabrání testu sáhnout na skutečný internet.
   Testy mockují jen adresy, které čekají — jenže když aplikace poskládá adresu jinak
   (např. při prázdném repozitáři vznikne api.github.com/repos//contents/…), vzor se
   netrefí a Playwright požadavek pustí ven. Pak výsledek závisí na kvalitě připojení.
   Volat PŘED konkrétními routami: v Playwrightu má přednost naposledy registrovaná,
   takže tahle záchytná musí být první, aby ji konkrétní routy přebily. */
async function blokujVenek(ctx, onBlok) {
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost') || u.startsWith('data:')) {
      return route.continue();
    }
    if (onBlok) onBlok(route.request().method() + ' ' + u);
    return route.fulfill({ status: 404, contentType: 'application/json',
                           body: '{"message":"Not Found"}' });
  });
}

/* Datum v MÍSTNÍM čase, stejně jako dstr() v aplikaci. Testy dřív používaly
   toISOString(), tedy UTC — mezi půlnocí a druhou hodinou se obojí liší o den
   a sady pak padaly „náhodně" jen v tom okně. */
const den = n => {
  const x = new Date(); x.setDate(x.getDate() + (n || 0));
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') +
    '-' + String(x.getDate()).padStart(2, '0');
};

module.exports = { EXE, DIR, blokujVenek, den };
