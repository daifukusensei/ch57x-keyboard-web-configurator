// Keypad canvas at 100 % / 150 % / 60 %, with and without comments, light + dark + phone.
const path=require('path'),fs=require('fs'),url=require('url');
const OUT=path.join(__dirname,'out')+'/'; fs.mkdirSync(OUT,{recursive:true});
const {chromium}=require('playwright');
const yaml=fs.readFileSync(path.join(__dirname,'../../test/fixtures/user.yaml'),'utf8');
(async()=>{
  const b=await chromium.launch();
  const run=async(name,vp,theme,fn)=>{
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,colorScheme:theme});
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url.pathToFileURL(path.join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href);
    await p.evaluate(y=>{ document.getElementById('yamlIn').value=y; document.getElementById('btnImport').click(); },yaml);
    await p.waitForTimeout(300); const ok=await p.$('#confirmOk:visible'); if(ok) await ok.click();
    if(fn) await fn(p);
    await p.waitForTimeout(2200);   // let the toast fade
    await p.screenshot({path:OUT+'shots_zoom_'+name+'.png',fullPage:true});
    if(errs.length) console.log(name,'ERRORS',errs);
    await ctx.close();
  };
  const z=n=>async p=>{ for(let i=0;i<Math.abs(n);i++) await p.click(n>0?'#zoomIn':'#zoomOut'); };
  await run('100_dark',{width:1280,height:1600},'dark');
  await run('100_light_dots',{width:1280,height:1600},'light',async p=>{ if(await p.isChecked('#showNotes')) await p.click('#showNotes'); });
  await run('150_dark',{width:1280,height:1600},'dark',z(5));
  await run('60_dark',{width:1280,height:1600},'dark',z(-4));
  await run('mobile',{width:390,height:2200},'dark');
  await b.close();
})();
