const { chromium } = require('playwright');
const PROSTREDI = require('./prostredi');
(async () => {
  const b = await chromium.launch({executablePath:PROSTREDI.EXE});
  const ctx = await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://127.0.0.1:8811/index.html'); await p.waitForTimeout(900);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');

  console.log('1. přepínač je na stránce Foto =', await p.isVisible('#gProj'));
  console.log('2. v Nastavení už není =', (await p.locator('#p-set #gProj').count())===0);
  console.log('3. výchozí stav: návod skrytý =', !(await p.isVisible('#projOn')),
              '| tlačítko =', await p.textContent('#shareBtn'));

  await p.check('#gProj'); await p.waitForTimeout(500);
  console.log('4. po zaškrtnutí: uloží se hned =', (await p.textContent('#toast')).includes('zapnut'));
  console.log('   návod viditelný =', await p.isVisible('#projOn'),
              '| tlačítko =', await p.textContent('#shareBtn'));
  const steps = await p.locator('#projOn li').allTextContents();
  console.log('   kroky:', steps.map(t=>t.trim()).join(' → '));

  await p.reload(); await p.waitForTimeout(1000);
  await p.click('nav button[data-p="scan"]'); await p.click('#addSeg button[data-s="photo"]');
  console.log('5. přežilo restart BEZ tlačítka Uložit cíle =', await p.isChecked('#gProj'),
              '| návod =', await p.isVisible('#projOn'));

  // uložení fotky
  await p.evaluate(()=>{
    const c=document.createElement('canvas'); c.width=c.height=8;
    c.getContext('2d').fillRect(0,0,8,8);
    return new Promise(r=>c.toBlob(b=>{ photoFile=new File([b],'x.png',{type:'image/png'});
      document.getElementById('photoPrev').src=URL.createObjectURL(b);
      document.getElementById('photoPrev').style.display=''; r(); },'image/png'));
  });
  const dl = p.waitForEvent('download');
  await p.click('text=Uložit fotku do telefonu');
  const d = await dl;
  console.log('6. fotka se uloží jako', d.suggestedFilename());
  await p.waitForTimeout(300);
  console.log('   toast:', (await p.textContent('#toast')).trim());

  // bez fotky nesmí spadnout
  await p.evaluate(()=>{ photoFile=null; });
  await p.click('text=Uložit fotku do telefonu'); await p.waitForTimeout(300);
  console.log('7. bez fotky hlásí:', (await p.textContent('#toast')).trim());

  // vypnutí
  await p.uncheck('#gProj'); await p.waitForTimeout(400);
  console.log('8. vypnutí: návod skrytý =', !(await p.isVisible('#projOn')),
              '| zpráva zpět plná =', (await p.evaluate(()=>promptFor('meal'))).includes('polozky'));
  console.log('\nJS chyby: '+(errs.length?errs.join(';'):'žádné'));
  await b.close();
})();
