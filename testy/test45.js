/* Test v44 — Claude API (vlastní klíč): nastavení, tlačítka, odhad jídla, etiketa,
   chybové stavy, klíč není v záloze */
const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');

const API_MEAL = { content: [{ type: 'text', text:
  '{"jidlo":"Kuřecí s rýží","polozky":[{"nazev":"kuřecí prsa","mn":180,"kcal":108,"b":23,"s":0,"t":1.8},' +
  '{"nazev":"rýže vařená","mn":220,"kcal":130,"b":2.7,"s":28,"t":0.3}],"pozn":"olej odhadem"}' }] };
const API_LABEL = { content: [{ type: 'text', text:
  '{"nazev":"Müsli tyčinka","znacka":"Emco","jed":"g","kcal":412,"b":8,"s":58,"t":15,"vlaknina":6,"sul":0.3,"porce":35}' }] };

(async () => {
  const browser = await chromium.launch({ executablePath: PROSTREDI.EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  let fail = 0;
  const ck = (nm, ok, det) => { console.log((ok ? '  ✓ ' : '  ✗ ') + nm + (ok ? '' : '  << ' + (det || ''))); if (!ok) fail++; };

  let lastReq = null, mode = 'meal', status = 200;
  await p.route(/api\.anthropic\.com\/v1\/models/, r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'claude-haiku-4-5' }] }) }));
  await p.route(/api\.anthropic\.com\/v1\/messages/, r => {
    lastReq = { headers: r.request().headers(), body: JSON.parse(r.request().postData()) };
    if (status !== 200) { r.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { message: 'err' } }) }); return; }
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(mode === 'meal' ? API_MEAL : API_LABEL) });
  });

  await p.goto('http://127.0.0.1:8811/index.html');
  await p.waitForTimeout(700);
  await p.evaluate(async () => {
    const put = (s, v) => new Promise(r => { const t = db.transaction(s, 'readwrite'); t.objectStore(s).put(v); t.oncomplete = r; });
    await put('meta', { k: 'obDone', v: 1 });
  });
  await p.reload(); await p.waitForTimeout(600);

  // --- bez klíče: API tlačítka schovaná
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  await p.waitForTimeout(200);
  ck('bez klíče není tlačítko Odhadnout', !(await p.locator('#apiEstBtn').isVisible()));

  // --- uložit klíč + test
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  await p.evaluate(() => setSetMode('prop')); await p.fill('#apiKey', 'sk-ant-test-123'); await p.waitForTimeout(200);
  await p.evaluate(() => saveApi());
  await p.waitForTimeout(300);
  await p.click('text=Vyzkoušet klíč'); await p.waitForTimeout(500);
  ck('test klíče projde', (await p.textContent('#apiMsg')).includes('✓'), await p.textContent('#apiMsg'));

  // --- odhad jídla: nastav fotku, klikni, formulář se vyplní
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  await p.waitForTimeout(200);
  ck('s klíčem je tlačítko vidět', await p.locator('#apiEstBtn').isVisible());
  await p.evaluate(() => {
    // 1×1 px JPEG jako fotka
    const b64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    photoFile = new File([u8], 'jidlo.jpg', { type: 'image/jpeg' });
    document.getElementById('photoNote').value = 'talíř 26 cm';
  });
  await p.click('#apiEstBtn'); await p.waitForTimeout(1200);
  ck('rozpis se vyplnil', await p.locator('#aiCard').isVisible());
  ck('2 suroviny z odpovědi', (await p.locator('#aiList .item').count()) === 2);
  ck('název jídla', (await p.inputValue('#aiName')) === 'Kuřecí s rýží');
  ck('hlavička s klíčem', lastReq.headers['x-api-key'] === 'sk-ant-test-123');
  ck('hlavička pro prohlížeč', lastReq.headers['anthropic-dangerous-direct-browser-access'] === 'true');
  ck('model haiku', lastReq.body.model === 'claude-haiku-4-5');
  ck('poslal fotku i zadání', lastReq.body.messages[0].content[0].type === 'image'
    && lastReq.body.messages[0].content[1].text.includes('talíř 26 cm'));

  // --- uložení do deníku funguje dál
  await p.click('text=Přidat jako jedno jídlo'); await p.waitForTimeout(500);
  ck('přidáno do deníku', (await p.textContent('#logList')).includes('Kuřecí s rýží'));

  // --- etiketa přes API
  mode = 'label';
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="man"]');
  await p.click('text=+ Zadat potravinu ručně'); await p.waitForTimeout(300);
  ck('tlačítko u etikety vidět', await p.locator('#apiLabBtn').isVisible());
  await p.evaluate(() => {
    labelFile = new File([new Uint8Array([255, 216, 255, 217])], 'etiketa.jpg', { type: 'image/jpeg' });
  });
  // labelFile je maličký „JPEG" — shrinkPhoto ho neumí dekódovat? použij stejný 1×1 JPEG
  await p.evaluate(() => {
    const b64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    labelFile = new File([u8], 'etiketa.jpg', { type: 'image/jpeg' });
  });
  await p.click('#apiLabBtn'); await p.waitForTimeout(1200);
  ck('formulář vyplněn z etikety', (await p.inputValue('#edKcal')) === '412'
    && (await p.inputValue('#edName')) === 'Müsli tyčinka',
    'kcal=' + await p.inputValue('#edKcal') + ' name=' + await p.inputValue('#edName'));
  await p.evaluate(() => closeMod('modEdit'));

  // --- chybový stav 401
  status = 401; mode = 'meal';
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  await p.evaluate(() => {
    const b64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    photoFile = new File([u8], 'jidlo.jpg', { type: 'image/jpeg' });
  });
  await p.click('#apiEstBtn'); await p.waitForTimeout(800);
  ck('401 → srozumitelná hláška', (await p.textContent('#apiEstMsg')).includes('neplatný klíč'),
    await p.textContent('#apiEstMsg'));
  status = 200;

  // --- klíč není v exportu zálohy
  const exp = await p.evaluate(async () => JSON.stringify({
    goals, drinks,
    products: await dbAll('products'), log: await dbAll('log'),
    daily: await dbAll('daily'), ext: await dbAll('ext'), workout: await dbAll('workout')
  }));
  ck('klíč není v záloze', !exp.includes('sk-ant-test-123'));

  // --- klíč přežije restart
  await p.reload(); await p.waitForTimeout(600);
  await p.click('nav button[data-p="set"]'); await p.waitForTimeout(300);
  ck('klíč přežije restart', (await p.inputValue('#apiKey')) === 'sk-ant-test-123');

  console.log(errs.length ? 'PAGEERROR: ' + errs.join(' | ') : 'bez JS chyb');
  console.log('NEPROŠLO: ' + fail);
  await browser.close();
})();
