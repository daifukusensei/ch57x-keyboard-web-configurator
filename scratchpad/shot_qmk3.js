const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1100,height:900},deviceScaleFactor:2,colorScheme:'light'});
  const p=await ctx.newPage(); await p.goto('file:///home/claude/ch57x-config-editor.html'); await p.waitForTimeout(150);
  await p.locator('.case').screenshot({path:'qmk/v2-case.png'}); await b.close();
})();
