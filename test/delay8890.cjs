// Delay handling per family at upload time: limits (≤ 6000 ms) and "no delay on 1189:8890".
// The 4×4 8850 driver drops the delay, as upstream k8850_4x4 does (KeyboardEvent(_, presses)), and warns about it.
const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseActionToMacro,bindPackets,makeReport,validateAction,familyWarnings};')();
const MAX='maximum supported delay is 6000 ms', NODELAY='delay is not supported by this keyboard model';
const ACTIONS=['{delay(100)}a','{delay(100)}left,a,right','{delay(6000)}a','{delay(6001)}a','a'];
// expected: number of packets, or the error message
const EXPECT={
  '884x':      [5,5,5,MAX,4],
  '8890':      [NODELAY,NODELAY,NODELAY,NODELAY,4],
  '8850':      [2,2,2,2,2],
  '884x-514c': [5,5,5,MAX,4],
};
let fail=0; const ok=(n,c,got)=>{ if(!c) fail++; console.log(c?'ok  ':'FAIL',n,c?'':'-> got '+got); };
for(const [fam,exp] of Object.entries(EXPECT)) ACTIONS.forEach((a,i)=>{
  let got; try{ got=api.bindPackets(fam,0,0,api.parseActionToMacro(a)).length; }catch(e){ got=e.message; }
  ok(`${fam} ${a} -> ${exp[i]}`, got===exp[i], got);
});
const warns=(fam,a)=>api.familyWarnings(fam,api.parseActionToMacro(a));
ok('8850 (4×4): delay -> warning', warns('8850','{delay(100)}a').some(m=>/delay option is ignored/.test(m)));
ok('8850 (4×4): no delay -> no warning', warns('8850','a').length===0);
ok('other families: no 4×4 delay warning', ['884x','884x-514c'].every(f=>warns(f,'{delay(100)}a').length===0));
ok('validateAction {delay(100)}a is ok (family-independent)', api.validateAction('{delay(100)}a').level==='ok');
console.log(fail?fail+' FAILED':'ALL PASSED');
process.exit(fail?1:0);
