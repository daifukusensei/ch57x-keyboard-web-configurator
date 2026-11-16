const {chromium}=require('playwright'); const fs=require('fs');
const yaml=fs.readFileSync('notes/user.yaml','utf8');
(async()=>{
  const b=await chromium.launch(); 
  const run=async(name,vp,theme,fn)=>{
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,colorScheme:theme});
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file:///home/claude/ch57x-config-editor.html'); 
    await p.evaluate(()=>{ window.confirm=()=>true; });
    await p.evaluate(y=>{ document.getElementById('yamlIn').value=y; document.getElementById('btnImport').click(); },yaml);
    if(fn) await fn(p);
    await p.waitForTimeout(2200);   // let the toast fade
    await p.screenshot({path:'shots_notes_'+name+'.png',fullPage:false}); 
    if(errs.length) console.log(name,'ERRORS',errs);
    await ctx.close();
  };
  await run('desktop_dark',{width:1100,height:900},'dark',async p=>{ await p.click('#device .cell >> nth=4'); });
  await run('desktop_light',{width:1100,height:900},'light',async p=>{ await p.click('#device .cell >> nth=4'); });
  await run('dots_only',{width:1100,height:900},'dark',async p=>{ await p.click('#showNotes'); await p.click('#device .cell >> nth=3'); });
  await run('mobile',{width:390,height:900},'dark',async p=>{ await p.click('#device .cell >> nth=4'); });
  await b.close();
})();
