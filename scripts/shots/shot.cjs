const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch(); 
  // system light, then toggle to dark via the button
  const p = await b.newPage({viewport:{width:1100,height:900}, colorScheme:'light'});
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-config-editor.html')).href);
  await p.screenshot({path:OUT+'light.png'});
  await p.click('#themeToggle');
  await p.screenshot({path:OUT+'dark.png'});
  console.log('attr after click:', await p.evaluate(()=>document.documentElement.dataset.theme), '| bg:', await p.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  // phone width, dark
  const m = await b.newPage({viewport:{width:390,height:800}});
  await m.goto(require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-config-editor.html')).href); await m.click('#themeToggle');
  await m.screenshot({path:OUT+'dark-mobile.png'});
  await b.close();
})();
