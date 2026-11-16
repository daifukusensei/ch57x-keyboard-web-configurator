const fs=require('fs');
const ref=require('./ref.cjs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../../ch57x-config-editor.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseActionToMacro,bindPackets,keyIdFor,planUpload,buttonIndex,WELL_KNOWN,MEDIA_VALUES,HID_MODS,fromObj,parseYaml,EXAMPLE,familyFromProductId};')();
let fail=0,n=0; const ok=(name,c)=>{n++; if(!c){fail++;console.log('FAIL',name);}};
// tables
ok('well-known list identical',JSON.stringify(api.WELL_KNOWN)===JSON.stringify(ref.WELL_KNOWN_CODES));
ok('media values identical',Object.entries(api.MEDIA_VALUES).every(([k,v])=>ref.MediaCodeValues[k]===v));
ok('modifier bit order',api.HID_MODS.every((m,i)=>ref.modifiersValue([m])===1<<i));
// examples
const actions=['a','ctrl-a','alt-shift','alt-ctrl,ctrl-b','<100>','click','click(middle)','click+rclick','ctrl-mclick','move(0,10)',
 'ctrl-move(5,5)','ctrl-wheelup','ctrl-click','wheelup','wheeldown','play','prev','next','mute','volumedown','volumeup','left','ctrl-enter','shift-wheeldown',
 'h,e,l,l,o','win-r,c,m,d,enter','{delay(100)}left,a,right','move(-10,5)','wheel(-3)','drag(left+right,-127,127)','calculator','screenlock','favorites','screenbrightnessup','f13','delete','slash','rshift-a','shift','ctrl-<4>'];
const keys=[0,1,5,11,[0,'ccw'],[0,'press'],[0,'cw'],[2,'cw'],[1,'press']];
for(const fam of ['884x','8890']){
  const kb= fam==='884x'?ref.makeKeyboard884x():ref.makeKeyboard8890();
  for(const a of actions){
    let macro; try{macro=api.parseActionToMacro(a);}catch(e){ok('parse '+a+' '+e.message,false);continue;}
    for(const layer of [0,2]) for(const key of keys){
      let mine,theirs,me,te;
      try{mine=api.bindPackets(fam,layer,key,macro);}catch(e){me=e.message;}
      try{theirs=kb.bindKey(layer,key,macro);}catch(e){te=e.message;}
      if(me||te){ ok(fam+' '+a+' error parity: mine='+me+' theirs='+te, !!me===!!te); continue; }
      ok(fam+' '+a+' L'+layer+' '+JSON.stringify(key), JSON.stringify(mine)===JSON.stringify(theirs));
    }
  }
}
// parse -> macro shape check for a few (names mapped to programmer's own code table)
const m1=api.parseActionToMacro('ctrl-a');
ok('macro shape',JSON.stringify(m1)==='{"type":"Keyboard","options":{"delay":0},"keyChords":[{"modifiers":["Ctrl"],"code":"A"}]}');
// full example plan on 884x: counts
const st=api.fromObj(api.parseYaml(api.EXAMPLE));
const plan=api.planUpload(st,'884x','all');
ok('plan no errors '+JSON.stringify(plan.errors),plan.errors.length===0);
ok('plan items = 3*(12+6)=54 got '+plan.items,plan.items===54);
// orientation mapping is a bijection
for(const o of ['normal','upsidedown','clockwise','counterclockwise']){
  const s={rows:3,columns:4,orientation:o}; const R=(o==='clockwise'||o==='counterclockwise')?4:3, C=(R===4)?3:4;
  const seen=new Set(); for(let r=0;r<R;r++)for(let c=0;c<C;c++)seen.add(api.buttonIndex(s,r,c));
  ok('bijection '+o,seen.size===12&&Math.min(...seen)===0&&Math.max(...seen)===11);
}
ok('family 8840',api.familyFromProductId(0x8840)==='884x'&&api.familyFromProductId(0x8842)==='884x'&&api.familyFromProductId(0x8890)==='8890'&&api.familyFromProductId(0x1234)===null);
// error cases
const bad=['ctrl-shift-click','play,a','hyper-a','a,,b','webpagehome','{speed(1)}a','move(200,0)','ctrl-play','nonexistentkey'];
for(const b of bad){ let threw=false; try{api.parseActionToMacro(b);}catch(e){threw=true;} ok('rejects '+b,threw); }
console.log(n+' checks, '+fail+' failed'); process.exit(fail?1:0);
