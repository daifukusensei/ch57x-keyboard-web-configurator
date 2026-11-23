// Header + layout settings card with Load config / Save config / New blank, desktop and phone width, and the Save dialog.
const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
const URL=require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href;
(async()=>{
  const b=await chromium.launch();
  for(const [name,w] of [['config-desktop',1280],['config-mobile',390]]){
    const p=await b.newPage({viewport:{width:w,height:1400}});
    await p.goto(URL);
    const top=await p.locator('header.nav').boundingBox(), card=await p.locator('#settingsCard').boundingBox();
    await p.screenshot({path:OUT+name+'.png',clip:{x:0,y:top.y,width:w,height:card.y+card.height-top.y+8}});
    if(name==='config-desktop'){ await p.click('#btnSave'); await p.screenshot({path:OUT+'config-save-dialog.png'}); }
  }
  await b.close();
})();
