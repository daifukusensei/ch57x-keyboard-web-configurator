// Header with the tagline: light/dark at desktop width, and phone width.
const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
const URL=require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href;
(async()=>{
  const b=await chromium.launch();
  for(const [name,w,scheme] of [['header-light',1100,'light'],['header-dark',1100,'dark'],['header-mobile',390,'light']]){
    const p=await b.newPage({viewport:{width:w,height:300},colorScheme:scheme});
    await p.goto(URL);
    await p.locator('header.nav').screenshot({path:OUT+name+'.png'});
    if(name==='header-light') console.log('link:',await p.$eval('#tagline a',a=>a.textContent+' -> '+a.href+' target='+a.target));
  }
  await b.close();
})();
