const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../../ch57x-config-editor.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseActionToMacro,bindPackets,makeReport,validateAction};')();
for(const fam of ['884x','8890','8850','884x-514c']) for(const a of ['{delay(100)}a','{delay(100)}left,a,right','{delay(6000)}a','{delay(6001)}a','a']){
  try{ const m=api.parseActionToMacro(a); const pk=api.bindPackets(fam,0,0,m); console.log(fam.padEnd(10),a.padEnd(26),'OK  ',pk.length,'packets'); }
  catch(e){ console.log(fam.padEnd(10),a.padEnd(26),'ERR ',e.message); }
}
console.log('validateAction {delay(100)}a ->',JSON.stringify(api.validateAction('{delay(100)}a')));
