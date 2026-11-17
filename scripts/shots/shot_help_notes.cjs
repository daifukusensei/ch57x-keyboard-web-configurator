// Help section "Comments on keys" (the #@ format), light and phone width.
const OUT=require('path').join(__dirname,'out')+'/'; require('fs').mkdirSync(OUT,{recursive:true});
const { chromium } = require('playwright');
const URL=require('url').pathToFileURL(require('path').join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href;
(async()=>{
  const b=await chromium.launch();
  for(const [name,w] of [['help-notes',1100],['help-notes-mobile',390]]){
    const p=await b.newPage({viewport:{width:w,height:2400}});
    await p.goto(URL+'#help');
    const h=p.locator('#help h3',{hasText:'Comments on keys'});
    await h.evaluate(e=>{ const d=e.closest('details'); if(d) d.open=true; });
    const box=await h.boundingBox(); const end=await p.locator('#help h3',{hasText:'Direct upload'}).boundingBox();
    await p.screenshot({path:OUT+name+'.png',fullPage:true,clip:{x:0,y:box.y-10,width:w,height:end.y-box.y+10}});
  }
  await b.close();
})();
