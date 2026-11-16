const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); 
  // system light, then toggle to dark via the button
  const p = await b.newPage({viewport:{width:1100,height:900}, colorScheme:'light'});
  await p.goto('file:///home/claude/ch57x-config-editor.html');
  await p.screenshot({path:'light.png'});
  await p.click('#themeToggle');
  await p.screenshot({path:'dark.png'});
  console.log('attr after click:', await p.evaluate(()=>document.documentElement.dataset.theme), '| bg:', await p.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  // phone width, dark
  const m = await b.newPage({viewport:{width:390,height:800}});
  await m.goto('file:///home/claude/ch57x-config-editor.html'); await m.click('#themeToggle');
  await m.screenshot({path:'dark-mobile.png'});
  await b.close();
})();
