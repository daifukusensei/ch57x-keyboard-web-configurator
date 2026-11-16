const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1000,height:900}});
  await p.addInitScript(()=>{
    const dev={vendorId:0x514c,productId:0x8850,productName:'Macropad',opened:false,collections:[{outputReports:[{reportId:3}]}],
      async open(){this.opened=true;},async sendReport(){},addEventListener(){},removeEventListener(){}};
    Object.defineProperty(navigator,'hid',{value:{getDevices:async()=>[],requestDevice:async()=>[dev],addEventListener(){}}});
  });
  await p.goto(require('url').pathToFileURL(require('path').join(__dirname,'../ch57x-config-editor.html')).href);
  await p.click('#hidConnect'); await p.waitForTimeout(200);
  await p.click('#hidPreview'); await p.waitForTimeout(100);
  const sec=await p.locator('#hidConnect').locator('xpath=ancestor::section[1]');
  await sec.screenshot({path:'shot3.png'});
  await b.close();
})();
