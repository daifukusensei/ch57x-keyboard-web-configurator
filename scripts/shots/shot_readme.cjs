// README screenshot -> docs/screenshot.png: top section (header to the action editor), light theme, repo example,
// R1 C2 selected, 2x scale, cropped to the header's width (drops the reserved scrollbar gutter). Rerun after visible UI changes.
const path=require('path'),fs=require('fs'),url=require('url');
const OUT=path.join(__dirname,'../../docs/screenshot.png'); fs.mkdirSync(path.dirname(OUT),{recursive:true});
const {chromium}=require('playwright');
const PAGE=url.pathToFileURL(path.join(__dirname,'../../ch57x-keyboard-web-configurator.html')).href;
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1300,height:2600},deviceScaleFactor:2,colorScheme:'light'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(PAGE);
  await p.locator('#device .cell').nth(1).click(); await p.waitForTimeout(150);
  const {w,h}=await p.evaluate(()=>({w:Math.floor(document.querySelector('header.nav').getBoundingClientRect().width),h:document.getElementById('editor').getBoundingClientRect().bottom+scrollY+8}));
  await p.screenshot({path:OUT,clip:{x:0,y:0,width:w,height:Math.ceil(h)}});
  if(errs.length){ console.log('page errors',errs); process.exitCode=1; }
  console.log('wrote',OUT,w+'x'+Math.ceil(h),'(css px, 2x)');
  await b.close();
})();
