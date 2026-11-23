// Changing the orientation keeps every action, comment and selection on the same physical key and knob.
const autoConfirm=require('./lib/autoconfirm.cjs');
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {reorient,normalizeState,planUpload,ORIENTATIONS};')();
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };

// ---- core: hardware index -> action is unchanged by every orientation change ----
// The upload plan's packets are keyed by hardware index, so compare plans (descriptions name file positions, bytes do not).
const bytesOf=st=>JSON.stringify(api.planUpload(st,'884x','all').packets.map(p=>p.bytes.join()).sort());
function filled(o,rows,columns,knobs){
  const st=api.normalizeState({model:'ch57x-2',orientation:o,rows,columns,knobs,layers:[]});
  let n=0; const keys='abcdefghijklmnopqrstuvwxyz0123456789';
  st.layers.forEach((l,li)=>{
    l.buttons.forEach((row,r)=>row.forEach((_,c)=>{ row[c]=keys[n%keys.length]; l.bnotes[r][c]='note '+li+'/'+(n++); }));
    l.knobs.forEach((k,i)=>{ k.ccw='f'+(i+1); k.press='f'+(i+7); k.cw='f'+(i+13); l.knotes[i].press='kn '+li+'/'+i; });
  });
  return st;
}
let bad=0, pairs=0;
for(const [rows,columns,knobs] of [[3,4,2],[1,3,1],[2,5,3],[4,4,0],[1,1,1]])
  for(const a of api.ORIENTATIONS) for(const b of api.ORIENTATIONS){
    if(a===b) continue; pairs++;
    const st=filled(a,rows,columns,knobs), before=bytesOf(st), orig=JSON.stringify(st.layers);
    const m=api.reorient(st,b);
    const shape=st.layers[0].buttons.length+'x'+(st.layers[0].buttons[0]||[]).length;
    const want=(b==='clockwise'||b==='counterclockwise')?columns+'x'+rows:rows+'x'+columns;
    if(st.orientation!==b||shape!==want||bytesOf(st)!==before){ bad++; console.log('  moved wrongly',rows,columns,knobs,a,'->',b); continue; }
    // comments follow the same map as the actions
    const o=JSON.parse(orig); let noteBad=false;
    o.forEach((l,li)=>l.buttons.forEach((row,r)=>row.forEach((v,c)=>{ const [r2,c2]=m.button(r,c);
      if(st.layers[li].buttons[r2][c2]!==v||st.layers[li].bnotes[r2][c2]!==l.bnotes[r][c]) noteBad=true; })));
    o.forEach((l,li)=>l.knobs.forEach((k,i)=>{ const j=m.knob(i);
      if(st.layers[li].knobs[j].press!==k.press||st.layers[li].knotes[j].press!==l.knotes[i].press) noteBad=true; }));
    if(noteBad){ bad++; console.log('  comments/map mismatch',rows,columns,knobs,a,'->',b); continue; }
    api.reorient(st,a);
    if(JSON.stringify(st.layers)!==orig){ bad++; console.log('  no round trip',rows,columns,knobs,a,'<->',b); }
  }
ok('every orientation change keeps each action on its hardware key ('+pairs+' cases, '+bad+' bad)',bad===0);
{ const st=filled('normal',3,4,2), s=JSON.stringify(st); api.reorient(st,'normal'); api.reorient(st,'sideways');
  ok('same or unknown orientation changes nothing',JSON.stringify(st)===s); }

// ---- UI: changing the select moves keys, comments and the selection ----
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  w.navigator.hid={getDevices:async()=>[],requestDevice:async()=>[],addEventListener(){}};
  w.addEventListener('error',e=>errors.push(e.message));
}});
const w=dom.window,d=w.document; autoConfirm(w);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const $=id=>d.getElementById(id);
const cells=()=>[...d.querySelectorAll('#device .cell')];
const yaml=()=>$('yamlOut').value;
const setOrientation=o=>{ $('orientation').value=o; $('orientation').dispatchEvent(new w.Event('change',{bubbles:true})); };
(async()=>{
  await sleep(50);
  $('yamlIn').value=['#@ L1 R1 C2: second key','#@ L1 K1 press: first knob','model: ch57x-2','orientation: normal','rows: 2','columns: 3','knobs: 2',
    'layers:','  - buttons:','      - ["a", "b", "c"]','      - ["d", "e", "f"]','    knobs:',
    '      - ccw: "f1"','        press: "f2"','        cw: "f3"','      - ccw: "f4"','        press: "f5"','        cw: "f6"',''].join('\r\n');
  $('btnImport').dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(10);
  cells()[1].dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(5);   // R1 C2 = "b"
  ok('selected b',$('action').value==='b');
  setOrientation('upsidedown'); await sleep(5);
  ok('upside down: rows reversed and mirrored',/- \["f", "e", "d"\]\s+- \["c", "b", "a"\]/.test(yaml()));
  ok('upside down: knobs swapped',/ccw: "f4"[\s\S]*ccw: "f1"/.test(yaml()));
  ok('comment moved with its key',/#@ L1 R2 C2: second key/.test(yaml()));
  ok('knob comment moved with its knob',/#@ L1 K2 press: first knob/.test(yaml()));
  ok('selection follows the key: '+$('editTitle').textContent,$('action').value==='b'&&/row 2, column 2/.test($('editTitle').textContent));
  setOrientation('clockwise'); await sleep(5);
  ok('clockwise: 3x2 grid',/- \["d", "a"\]\s+- \["e", "b"\]\s+- \["f", "c"\]/.test(yaml()));
  ok('clockwise: knobs still reversed',/ccw: "f4"[\s\S]*ccw: "f1"/.test(yaml()));
  ok('selection still on b: '+$('editTitle').textContent,$('action').value==='b'&&/row 2, column 2/.test($('editTitle').textContent));
  setOrientation('counterclockwise'); await sleep(5);
  ok('counterclockwise: 3x2 grid',/- \["c", "f"\]\s+- \["b", "e"\]\s+- \["a", "d"\]/.test(yaml()));
  ok('counterclockwise: knobs in order',/ccw: "f1"[\s\S]*ccw: "f4"/.test(yaml()));
  setOrientation('normal'); await sleep(5);
  ok('back to normal: original layout',/- \["a", "b", "c"\]\s+- \["d", "e", "f"\]/.test(yaml())&&/#@ L1 R1 C2: second key/.test(yaml()));
  ok('no script errors '+errors.join(';'),errors.length===0);
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
