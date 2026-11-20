// Rules and keys taken over from upstream (kriomant/ch57x-keyboard-tool):
//  - config.rs: a pad with 1 row (or column) and exactly 1 knob takes modifiers only on the first key of a button's sequence;
//  - the web-page media keys (webpagehome/back/forward) upload directly on every family.
// Packet bytes for the web-page keys are checked against upstream's own output in oracle_cmp.cjs.
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseActionToMacro,bindPackets,planUpload,fromObj,parseYaml,checkAction,validateAction};')();
let n=0, fail=0; const ok=(name,c)=>{ n++; if(!c){ fail++; console.log('FAIL',name); } };

// --- 1 row (or column) + 1 knob: same pass/fail as upstream's validate (checked case by case with its binary, 2026-11-19)
const y=(r,c,k,act)=>'rows: '+r+'\ncolumns: '+c+'\nknobs: '+k+'\nlayers:\n  - buttons:\n'+Array.from({length:r},()=>'      - ['+Array(c).fill(JSON.stringify(act)).join(', ')+']').join('\n')+
  '\n    knobs:'+(k?'\n'+Array.from({length:k},()=>'      - ccw: '+JSON.stringify(act)+'\n        press: ""\n        cw: ""').join('\n'):' []')+'\n';
const errs=(r,c,k,act)=>api.planUpload(api.fromObj(api.parseYaml(y(r,c,k,act))),'884x',0).errors;
ok('1x3 + 1 knob: "a,ctrl-b" is an error on each button, not on the knob',errs(1,3,1,'a,ctrl-b').length===3 && errs(1,3,1,'a,ctrl-b').every(e=>/R1 C\d: A pad with 1 row/.test(e)));
ok('3x1 + 1 knob: same',errs(3,1,1,'a,ctrl-b').length===3);
ok('1x1 + 1 knob: same',errs(1,1,1,'a,alt-b').length===1);
ok('modifiers on the first key are fine',errs(1,3,1,'ctrl-a,b').length===0);
ok('a modifier-only later chord counts (as upstream)',errs(1,3,1,'a,shift').length===3);
ok('1x3 + 2 knobs: allowed',errs(1,3,2,'a,ctrl-b').length===0);
ok('1x4 + 0 knobs: allowed',errs(1,4,0,'a,ctrl-b').length===0);
ok('2x3 + 1 knob: allowed',errs(2,3,1,'a,ctrl-b').length===0);
const st=api.fromObj(api.parseYaml(y(1,3,1,'a')));
ok('checkAction flags buttons, not knobs; validateAction alone does not',api.checkAction(st,'a,ctrl-b',true).level==='error'
  && api.checkAction(st,'a,ctrl-b',false).level==='ok' && api.validateAction('a,ctrl-b').level==='ok');

// --- web-page media keys
for(const k of ['webpagehome','webpageback','webpageforward']){
  ok(k+' is a valid media action',api.validateAction(k).level==='ok' && api.validateAction(k).kind==='media');
  for(const fam of ['884x','8890','8850','884x-514c']){
    let e=null; try{ api.bindPackets(fam,0,0,api.parseActionToMacro(k)); }catch(x){ e=x.message; }
    ok(k+' binds on '+fam+(e?' ('+e+')':''),!e);
  }
}
ok('webpageforward on 884x',JSON.stringify(api.bindPackets('884x',0,0,api.parseActionToMacro('webpageforward'))[0])==='[254,1,1,2,0,0,0,0,0,0,37,2,0,0,0,0]');

// --- the page shows the rule on the key and under the action
(async()=>{
  const errors=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){ w.addEventListener('error',e=>errors.push(e.message)); }});
  const w=dom.window, d=w.document, $=id=>d.getElementById(id);
  await new Promise(r=>setTimeout(r,50));
  const set=(id,v)=>{ $(id).value=v; $(id).dispatchEvent(new w.Event('change',{bubbles:true})); $(id).dispatchEvent(new w.Event('input',{bubbles:true})); };
  set('rows','1'); set('columns','3'); set('knobs','1');
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  $('action').value='a,ctrl-b'; $('action').dispatchEvent(new w.Event('input',{bubbles:true}));
  ok('error shown under the action: '+$('actionMsg').textContent,/A pad with 1 row \(or column\) and 1 knob/.test($('actionMsg').textContent));
  ok('key marked as an error',d.querySelector('.cell').classList.contains('err'));
  ok('summary counts it',/error/i.test($('summary').textContent));
  set('knobs','2');
  ok('with 2 knobs it is valid again',!d.querySelector('.cell').classList.contains('err'));
  ok('no script errors '+errors.join(';'),errors.length===0);
  console.log(n+' checks, '+fail+' failed'); process.exit(fail?1:0);
})();
