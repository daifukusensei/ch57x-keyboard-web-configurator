// Confirmation dialog: light/dark, desktop and phone (Clear prompt on the selected key).
const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
const URL=require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href;
(async()=>{
  const b=await chromium.launch();
  for(const scheme of ['light','dark']) for(const [w,h,dev] of [[1300,900,'desk'],[390,800,'phone']]){
    const p=await b.newPage({viewport:{width:w,height:h},colorScheme:scheme});
    await p.goto(URL); await p.click('#btnClear'); await p.waitForTimeout(250);
    await p.screenshot({path:OUT+`confirm-${scheme}-${dev}.png`});
    await p.keyboard.press('Escape'); console.log(scheme,dev,'closed by Esc:',await p.$eval('#confirmDlg',e=>e.hidden));
    await p.close();
  }
  await b.close();
})();
