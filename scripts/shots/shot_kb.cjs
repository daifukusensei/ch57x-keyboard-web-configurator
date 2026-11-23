// Basic-tab keyboard: US (ANSI) and UK (ISO) picked in #kbLayout, light/dark, desktop, narrow desktop and phone.
const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
const URL=require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href;
(async()=>{
  const b=await chromium.launch();
  for(const tag of ['us','uk']) for(const scheme of ['light','dark']) for(const [w,dev] of [[1300,"desk"],[1100,"mid"],[360,"phone"]]){
    const ctx=await b.newContext({colorScheme:scheme,viewport:{width:w,height:2400}});
    const p=await ctx.newPage(); await p.goto(URL);
    await p.selectOption('#kbLayout',tag);
    await p.click('[data-key="a"]'); await p.click('#kbBoard [data-mod="ctrl"]');
    const card=await p.$('.palette'); await card.screenshot({path:OUT+`kb-${tag}-${scheme}-${dev}.png`});
    const sw=await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    console.log(tag,scheme,dev,'h-scroll:',sw, 'layout:',await p.$eval('#kbLayout',s=>s.selectedOptions[0].textContent));
    await ctx.close();
  }
  await b.close();
})();
