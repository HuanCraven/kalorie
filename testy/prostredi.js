// Prostředí pro testy — kde je prohlížeč a kam patří fixtures a snímky obrazovky.
// Dřív byly obě cesty zadrátované na linuxový sandbox (/opt/pw-browsers, /home/claude),
// takže regrese šla spustit jen tam. Tohle je najde všude a dá se přepsat proměnnými:
//   KAL_CHROME  cesta k prohlížeči (jinak se hledá Chrome/Edge/Chromium v obvyklých místech)
//   KAL_DIR     složka pro alco.bin, nutri.csv, bc.y4m a snímky (jinak temp)
const fs = require('fs');
const os = require('os');
const path = require('path');

function najdiProhlizec() {
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

module.exports = { EXE, DIR, blokujVenek };
