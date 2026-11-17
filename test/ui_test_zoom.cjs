// Keypad canvas: zoom buttons / Ctrl+wheel (clamped, saved per viewer), and keycap text in the same typeface as the Basic keyboard.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
function open(store,brokenStorage){
  const errors=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
    w.alert=()=>{}; w.addEventListener('error',e=>errors.push(e.message));
    for(const [k,v] of Object.entries(store||{})) w.localStorage.setItem(k,v);
    if(brokenStorage) Object.defineProperty(w,'localStorage',{get(){ throw new Error('blocked'); }});
  }});
  const w=dom.window,d=w.document;
  return {w,d,errors,click:id=>d.getElementById(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true})),
    zoom:()=>d.getElementById('device').style.getPropertyValue('--zoom'), label:()=>d.getElementById('zoomReset').textContent,
    saved:()=>w.localStorage.getItem('ch57x-configurator-zoom')};
}
let p=open();
ok('no script errors '+p.errors.join(';'),p.errors.length===0);
ok('starts at 100%',p.zoom()==='1'&&p.label()==='100%');
p.click('zoomIn'); ok('zoom in -> 110%',p.zoom()==='1.1'&&p.label()==='110%'&&p.saved()==='110');
for(let i=0;i<20;i++) p.click('zoomIn');
ok('clamped at 200%, + disabled',p.zoom()==='2'&&p.d.getElementById('zoomIn').disabled&&!p.d.getElementById('zoomOut').disabled);
for(let i=0;i<30;i++) p.click('zoomOut');
ok('clamped at 60%, - disabled',p.zoom()==='0.6'&&p.d.getElementById('zoomOut').disabled);
p.click('zoomReset'); ok('reset -> 100%',p.zoom()==='1'&&p.saved()==='100');
const wheel=(dy,ctrl)=>{ const e=new p.w.WheelEvent('wheel',{deltaY:dy,ctrlKey:ctrl,bubbles:true,cancelable:true}); p.d.querySelector('#device .cell').dispatchEvent(e); return e.defaultPrevented; };
ok('plain wheel does nothing',!wheel(-100,false)&&p.zoom()==='1');
ok('ctrl+wheel up zooms in (page zoom prevented)',wheel(-100,true)&&p.zoom()==='1.1');
ok('ctrl+wheel down zooms out',wheel(100,true)&&p.zoom()==='1');
p.click('btnExample'); ok('zoom survives a re-render',p.zoom()==='1');
p=open({'ch57x-configurator-zoom':'150'}); ok('saved zoom restored',p.zoom()==='1.5'&&p.label()==='150%');
p=open({'ch57x-configurator-zoom':'banana'}); ok('bad saved value -> 100%',p.zoom()==='1');
p=open({'ch57x-configurator-zoom':'900'}); ok('out-of-range saved value -> 100%',p.zoom()==='1');
p=open(null,true); ok('blocked localStorage: no errors '+p.errors.join(';'),p.errors.length===0);
p.click('zoomIn'); ok('blocked localStorage: zoom still works',p.zoom()==='1.1');
// typeface: keypad text uses the same font token and size as the Basic-tab keycaps
const css=html.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
const rule=sel=>{ const m=css.match(new RegExp(sel.replace(/[.*]/g,'\\$&')+'\\{([^}]*)\\}')); return m?m[1]:''; };
ok('.kcap uses --ui-font, max 12.5px',/var\(--ui-font\)/.test(rule('.kcap'))&&/12\.5px/.test(rule('.kcap')));
ok('.cell .val uses --ui-font at 12.5px (not mono)',/600 12\.5px\/[\d.]+ var\(--ui-font\)/.test(rule('.cell .val'))&&!/--mono/.test(rule('.cell .val')));
ok('.cell .note uses --ui-font at 12.5px',/600 12\.5px\/[\d.]+ var\(--ui-font\)/.test(rule('.cell .note')));
console.log(fail?fail+' FAILED':'all passed'); process.exit(fail?1:0);
