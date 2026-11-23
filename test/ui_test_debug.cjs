// Developer tools switch: Read device info / Preview packets hidden by default, shown by #debugMode or ?debug=1,
// remembered in localStorage['ch57x-configurator-debug'], ?debug=0 turns it off, blocked localStorage only loses the memory.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
function page(url,{store=null,blockStorage=false}={}){
  const errors=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url,beforeParse(w){
    w.navigator.hid={getDevices:async()=>[],requestDevice:async()=>[],addEventListener(){}};
    if(store) for(const [k,v] of Object.entries(store)) w.localStorage.setItem(k,v);
    if(blockStorage){ const thrower=()=>{ throw new Error('blocked'); };
      Object.defineProperty(w,'localStorage',{get:thrower,configurable:true}); }
    w.addEventListener('error',e=>errors.push(e.message));
  }});
  return {w:dom.window,d:dom.window.document,errors};
}
const shown=(d,id)=>!d.getElementById(id).hidden;
(async()=>{
  // default: off
  let {w,d,errors}=page('http://localhost/'); await sleep(30);
  ok('no script errors '+errors.join(';'),errors.length===0);
  ok('hidden by default',!shown(d,'hidInfo') && !shown(d,'hidPreview') && !d.getElementById('debugMode').checked);
  ok('connect, layer select and upload still visible',shown(d,'hidConnect') && shown(d,'hidLayers') && shown(d,'hidUpload'));
  // toggle on via Help switch
  const cb=d.getElementById('debugMode'); cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('switch shows both buttons',shown(d,'hidInfo') && shown(d,'hidPreview'));
  ok('switch saves the preference',w.localStorage.getItem('ch57x-configurator-debug')==='1');
  cb.checked=false; cb.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('switch off hides them again',!shown(d,'hidInfo') && !shown(d,'hidPreview') && w.localStorage.getItem('ch57x-configurator-debug')==='0');
  // saved preference
  ({d,errors}=page('http://localhost/',{store:{'ch57x-configurator-debug':'1'}})); await sleep(30);
  ok('saved preference shows them',shown(d,'hidInfo') && shown(d,'hidPreview') && d.getElementById('debugMode').checked);
  // URL on
  ({w,d}=page('http://localhost/?debug=1')); await sleep(30);
  ok('?debug=1 shows them and saves',shown(d,'hidInfo') && shown(d,'hidPreview') && w.localStorage.getItem('ch57x-configurator-debug')==='1');
  ({w,d}=page('http://localhost/?debug')); await sleep(30);
  ok('bare ?debug shows them',shown(d,'hidPreview'));
  // URL off beats saved on
  ({w,d}=page('http://localhost/?debug=0',{store:{'ch57x-configurator-debug':'1'}})); await sleep(30);
  ok('?debug=0 hides them and saves',!shown(d,'hidInfo') && !shown(d,'hidPreview') && w.localStorage.getItem('ch57x-configurator-debug')==='0');
  // blocked storage
  ({d,errors}=page('http://localhost/?debug=1',{blockStorage:true})); await sleep(30);
  ok('blocked localStorage: no errors, ?debug=1 still works for this visit '+errors.join(';'),errors.length===0 && shown(d,'hidPreview'));
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
