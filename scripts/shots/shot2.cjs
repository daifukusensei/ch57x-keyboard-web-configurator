const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  for (const w of [390, 360, 768, 1100]) {
    const p = await b.newPage({viewport:{width:w,height:800}});
    await p.goto(require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-config-editor.html')).href);
    const r = await p.evaluate(()=>({scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth}));
    console.log(w, JSON.stringify(r), r.scrollW<=r.clientW?'no horizontal scroll':'OVERFLOW');
    if (w===390) { await p.click('#themeToggle'); await p.screenshot({path:OUT+'dark-mobile2.png'}); }
  }
  await b.close();
})();
