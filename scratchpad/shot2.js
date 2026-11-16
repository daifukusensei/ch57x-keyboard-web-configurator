const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch();
  for (const w of [390, 360, 768, 1100]) {
    const p = await b.newPage({viewport:{width:w,height:800}});
    await p.goto('file:///home/claude/ch57x-config-editor.html');
    const r = await p.evaluate(()=>({scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth}));
    console.log(w, JSON.stringify(r), r.scrollW<=r.clientW?'no horizontal scroll':'OVERFLOW');
    if (w===390) { await p.click('#themeToggle'); await p.screenshot({path:'dark-mobile2.png'}); }
  }
  await b.close();
})();
