const {chromium}=require('playwright'); const fs=require('fs');
const yaml=fs.readFileSync('notes/user.yaml','utf8');
(async()=>{
  const b=await chromium.launch();
  for(const [w,h] of [[360,800],[320,800],[1100,1700]]){
    const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1,colorScheme:'dark'});
    const p=await ctx.newPage();
    await p.goto('file:///home/claude/ch57x-config-editor.html');
    await p.evaluate(y=>{ document.getElementById('yamlIn').value=y; document.getElementById('btnImport').click(); },yaml);
    await p.click('#device .cell >> nth=4');
    const m=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,dev:(()=>{const d=document.getElementById('device');return [d.scrollWidth,d.clientWidth]})()}));
    console.log(w,'page scrollWidth',m.sw,'viewport',m.iw,'device scroll/client',m.dev.join('/'));
    if(w===1100){ await p.waitForTimeout(2200); await p.locator('#editor').screenshot({path:'shots_notes_editor.png'}); }
    await ctx.close();
  }
  await b.close();
})();
