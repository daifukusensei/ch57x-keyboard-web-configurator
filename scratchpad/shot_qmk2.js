const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch();
  const shot=async(name,theme,vp,full,prep)=>{
    const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1,colorScheme:theme});
    const p=await ctx.newPage();
    await p.addInitScript(t=>{ try{localStorage.setItem('ch57x-theme',t);}catch(e){} },theme);
    await p.goto('file:///home/claude/ch57x-config-editor.html'); await p.waitForTimeout(150);
    if(prep) await prep(p);
    await p.screenshot({path:'qmk/'+name+'.png',fullPage:full});
    await ctx.close();
  };
  await shot('v2-desk-viewport','light',{width:1100,height:760},false,async p=>{ await p.locator('.cell').nth(1).click(); await p.mouse.wheel(0,500); await p.waitForTimeout(100); });
  await shot('v2-mobile-top','dark',{width:390,height:700},false);
  await b.close();
})();
