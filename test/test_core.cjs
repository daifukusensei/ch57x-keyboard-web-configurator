const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-config-editor.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseYaml,toYaml,validateAction,fromObj,normalizeState,EXAMPLE,parseActionToMacro};')();
let fail=0; const t=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
const st=api.fromObj(api.parseYaml(api.EXAMPLE));
t('3 layers',st.layers.length===3);
t('dims 3x4',st.layers[0].buttons.length===3&&st.layers[0].buttons[0].length===4);
t('chord w/ comma kept',st.layers[0].buttons[0][3]==='alt-ctrl,ctrl-b');
t('knob parsed',st.layers[2].knobs[0].ccw==='volumedown'&&st.layers[0].knobs[1].press==='shift-click');
const y=api.toYaml(st); const st2=api.fromObj(api.parseYaml(y));
t('roundtrip equal',JSON.stringify(st)===JSON.stringify(st2));
const alt=`# c
model: ch57x-2
orientation: normal   # trailing
rows: 1
columns: 2
knobs: 0
layers:
- buttons:
  - ["a", 'b']
  knobs: []
`;
const s3=api.fromObj(api.parseYaml(alt));
t('same-indent seq',s3.layers[0].buttons[0][0]==='a'&&s3.layers[0].buttons[0][1]==='b'&&s3.knobs===0);
const s4=JSON.parse(JSON.stringify(st)); s4.rows=2; s4.knobs=1; api.normalizeState(s4);
t('shrink',s4.layers[0].buttons.length===2&&s4.layers[0].knobs.length===1&&s4.layers[0].buttons[0][0]==='a');
s4.orientation='clockwise'; api.normalizeState(s4);
t('vertical dims',s4.layers[0].buttons.length===4&&s4.layers[0].buttons[0].length===2);
const all=[]; st.layers.forEach(l=>{l.buttons.forEach(r=>all.push(...r)); l.knobs.forEach(k=>all.push(k.ccw,k.press,k.cw));});
const bad=all.filter(a=>api.validateAction(a).level==='error');
t('example has no errors '+JSON.stringify(bad),bad.length===0);
const v=s=>api.validateAction(s);
t('ctrl-c ok',v('ctrl-c').level==='ok');
t('seq ok',v('h,e,l,l,o').level==='ok');
t('6 chords err',v('a,b,c,d,e,f').level==='error');
t('media+mod err',v('ctrl-play').level==='error');
t('media mixed err',v('play,a').level==='error');
t('mouse bad mod err',v('cmd-click').level==='error');
t('move range err',v('move(200,0)').level==='error');
t('move neg ok',v('move(-10,5)').level==='ok');
t('drag ok',v('shift-drag(left+right,0,10)').level==='ok');
t('wheel neg ok',v('ctrl-wheel(-1)').level==='ok');
t('bare wheel err',v('wheel').level==='error');
t('delay opt ok',v('{delay(100)}left,a,right').level==='ok');
t('bad opt err',v('{speed(1)}a').level==='error');
t('HID ok',v('ctrl-<101>').level==='ok');
t('unknown key warn',v('nosuchkey').level==='warn');
t('unknown mod err',v('hyper-a').level==='error');
t('empty chord err',v('a,,b').level==='error');
t('empty',v('').kind==='empty');
t('modifier-only ok',v('alt-shift').level==='ok');
// ---- mouse movement range is -127..127 (editor-wide) ----
{
  const t=(name,cond)=>{ if(!cond){ console.log('FAIL',name); fail++; } else console.log('ok  ',name); };
  const lvl=a=>api.validateAction(a).level;
  t('move(-127,127) valid',lvl('move(-127,127)')==='ok');
  t('move(-128,0) invalid',lvl('move(-128,0)')==='error');
  t('move(0,128) invalid',lvl('move(0,128)')==='error');
  t('drag(left,-128,0) invalid',lvl('drag(left,-128,0)')==='error');
  t('drag(left,-127,127) valid',lvl('drag(left,-127,127)')==='ok');
  t('wheel(-128) invalid',lvl('wheel(-128)')==='error');
  t('wheel(-127) valid',lvl('wheel(-127)')==='ok');
  t('range message says -127 to 127',/-127 to 127/.test(JSON.stringify(api.validateAction('move(-128,0)'))));
  let threw=''; try{ api.parseActionToMacro('move(-128,0)'); }catch(e){ threw=e.message; }
  t('upload parser rejects -128: '+threw,/-127\.\.127/.test(threw));
  t('upload parser accepts -127',(()=>{ try{ api.parseActionToMacro('move(-127,127)'); return true; }catch(e){ return false; } })());
}
console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
