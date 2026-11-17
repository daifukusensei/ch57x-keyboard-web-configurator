// localStorage keys were renamed (ch57x-editor-v1 / ch57x-editor-notes / ch57x-theme -> ch57x-configurator-*).
// Values saved under the old keys must be carried over once; existing new keys must win; old keys are kept.
const {JSDOM}=require('jsdom'); const fs=require('fs'), path=require('path');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const boot=seed=>{ const errors=[]; const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  for(const [k,v] of Object.entries(seed)) w.localStorage.setItem(k,v);
  w.matchMedia=()=>({matches:false,addEventListener(){}}); w.alert=()=>{};
  w.addEventListener('error',e=>errors.push(e.message)); }}); return {w:dom.window,d:dom.window.document,errors}; };

(async()=>{
  // a mapping saved by the previous version: one key changed to "x", with a comment
  const A=boot({}); await sleep(30);
  for(const [id,v] of [['action','x'],['note','old note']]){ const i=A.d.getElementById(id); i.value=v; i.dispatchEvent(new A.w.Event('input',{bubbles:true})); }
  const saved=A.w.localStorage.getItem('ch57x-configurator-v1');
  ok('edit is saved under the new key',saved!==null&&JSON.parse(saved).state.layers[0].bnotes[0][0]==='old note');
  const old={'ch57x-editor-v1':saved,'ch57x-editor-notes':'1','ch57x-theme':'dark'};

  const B=boot(old); await sleep(30);
  const ls=B.w.localStorage, cap=B.d.querySelector('.cell');
  ok('no script errors '+B.errors.join(';'),B.errors.length===0);
  ok('mapping migrated and shown',cap.querySelector('.val').textContent==='x'&&cap.querySelector('.note').textContent==='old note');
  ok('notes preference migrated',ls.getItem('ch57x-configurator-notes')==='1'&&B.d.getElementById('showNotes').checked);
  ok('theme migrated and applied before paint',ls.getItem('ch57x-configurator-theme')==='dark'&&B.d.documentElement.getAttribute('data-theme')==='dark');
  ok('old keys are kept',Object.keys(old).every(k=>ls.getItem(k)===old[k]));

  // a new key that already exists is not overwritten by an old one
  const C=boot({...old,'ch57x-configurator-theme':'light'}); await sleep(30);
  ok('existing new key wins',C.w.localStorage.getItem('ch57x-configurator-theme')==='light'&&C.d.documentElement.getAttribute('data-theme')==='light');

  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
