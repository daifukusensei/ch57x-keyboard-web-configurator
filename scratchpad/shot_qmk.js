const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();
  const mk=async(name,theme,vp,prep)=>{
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,colorScheme:theme});
    const p=await ctx.newPage();
    await p.addInitScript(t=>{ try{localStorage.setItem('ch57x-theme',t);}catch(e){} },theme);
    await p.goto('file:///home/claude/ch57x-config-editor.html'); await p.waitForTimeout(150);
    if(prep) await prep(p);
    await p.screenshot({path:'qmk/'+name+'.png',fullPage:true});
    await ctx.close();
  };
  const pick=async p=>{ await p.locator('.cell').nth(1).click(); await p.locator('#pane-basic [data-key="c"]').click(); };
  await mk('desk-light','light',{width:1100,height:900},pick);
  await mk('desk-dark','dark',{width:1100,height:900},async p=>{ await pick(p); await p.locator('#ptab-mouse').click(); });
  await mk('mobile-dark','dark',{width:390,height:844},pick);
  await b.close();
})();
