const autoConfirm=require('./lib/autoconfirm.cjs');
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const sent=[]; const listeners={};
const dev={vendorId:0x514c,productId:0x8850,productName:'Mock Macropad',opened:false,
  collections:[{outputReports:[{reportId:3}]}],
  async open(){this.opened=true;},
  async sendReport(id,data){ sent.push({id,data:Array.from(data)});
    if(data[0]===0xfb){ setTimeout(()=>{ (listeners.inputreport||[]).forEach(f=>f({data:new DataView(new Uint8Array([0xfb,12,2,0]).buffer)})); },5); } },
  addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f);}, removeEventListener(t,f){listeners[t]=(listeners[t]||[]).filter(x=>x!==f);} };
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  w.navigator.hid={getDevices:async()=>[],requestDevice:async()=>[dev],addEventListener(){}};
  w.alert=()=>{};
  w.addEventListener('error',e=>errors.push(e.message));
}});
const w=dom.window,d=w.document; const c=autoConfirm(w); const click=id=>d.getElementById(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
(async()=>{
  await sleep(50);
  ok('no script errors '+errors.join(';'),errors.length===0);
  ok('upload disabled before connect',d.getElementById('hidUpload').disabled);
  click('hidPreview'); await sleep(20);
  ok('preview shows packets',/Layer 1 R1 C1 <- a/.test(d.getElementById('hidPlan').value) && /fe 01 01 01/.test(d.getElementById('hidPlan').value));
  click('hidConnect'); await sleep(50);
  ok("model follows device: "+d.getElementById("yamlOut").value.split("\n")[1],/^model: ch57x-3$/.test(d.getElementById("yamlOut").value.split("\n")[1]));
  ok('connected status names 12-key protocol: '+d.getElementById("hidStatus").textContent,/Connected: 514c:8850 .*ch57x-3 · protocol 884x-514c \(12-key\/4-knob\)$/.test(d.getElementById("hidStatus").textContent));
  ok('upload and info buttons enabled for the 12-key pad',!d.getElementById('hidUpload').disabled && !d.getElementById('hidInfo').disabled);
  sent.length=0;
  d.getElementById('hidLayers').value='0';
  click('hidUpload'); await sleep(200);
  ok('confirm shown, names protocol',/Write 18 binding/.test(c.last) && /protocol 884x-514c \(12-key\/4-knob\)/.test(c.last));
  // layer 1: 12 buttons + 6 knob actions = 18 bindings, each 4-5 packets
  ok('all reports id 3, 64 bytes',sent.length>0&&sent.every(s=>s.id===3&&s.data.length===64));
  const first=sent[0].data.slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join(' ');
  ok('first packet = fork 884x-style bind key1 a layer1: '+first,first==='fe 01 01 01 00 00 00 00 00 01 00 04');
  ok('commit trio present',sent.some(s=>s.data[0]===0xfd&&s.data[1]===0xfe&&s.data[2]===0xff));
  ok('finish packets aa aa present',sent.some(s=>s.data[0]===0xaa&&s.data[1]===0xaa));
  console.log('packets sent:',sent.length);
  ok('success status',/Uploaded 18 binding/.test(d.getElementById('hidStatus').textContent));
  // read device info works on this family
  click('hidInfo'); await sleep(60);
  ok('device info read: '+d.getElementById('hidStatus').textContent,/Device reports 12 buttons and 2 knobs/.test(d.getElementById('hidStatus').textContent));
  ok('info request was fb fb fb',sent.some(s=>s.data[0]===0xfb&&s.data[1]===0xfb&&s.data[2]===0xfb));
  // click with a modifier -> warning in preview and confirm, not an error
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  { const inp=d.getElementById('action'); inp.value='ctrl-click'; inp.dispatchEvent(new w.Event('input',{bubbles:true})); }
  click('hidPreview'); await sleep(20);
  ok('preview shows WARN for click modifier',/WARN\s+Layer 1 R1 C1: this keyboard ignores the "ctrl" modifier on a click/.test(d.getElementById('hidPlan').value) && !/ERROR/.test(d.getElementById('hidPlan').value));
  c.asked.length=0; sent.length=0;
  click('hidUpload'); await sleep(200);
  ok('confirm repeats the warning, upload proceeds',/ignores the "ctrl" modifier/.test(c.last)&&sent.length>0);
  ok('click packet = 5,0,1,0,0,0 (modifier dropped)',sent.some(s=>s.data[3]===3 && s.data.slice(9,15).join()==='5,0,1,0,0,0'));
  // unsupported in this variant -> error, blocks upload
  { const inp=d.getElementById('action'); inp.value='alt-drag(right,10,0)'; inp.dispatchEvent(new w.Event('input',{bubbles:true})); }
  sent.length=0; click('hidUpload'); await sleep(100);
  ok('drag blocked on 12-key pad: '+d.getElementById('hidStatus').textContent,sent.length===0&&/^Cannot upload — Layer 1 R1 C1: /.test(d.getElementById('hidStatus').textContent)&&/Drag action is not supported/.test(d.getElementById('hidPlan').value));
  { const inp=d.getElementById('action'); inp.value='a'; inp.dispatchEvent(new w.Event('input',{bubbles:true})); }
  // invalid action blocks upload
  sent.length=0;
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const inp=d.getElementById('action'); inp.value='hyper-a'; inp.dispatchEvent(new w.Event('input',{bubbles:true}));
  click('hidUpload'); await sleep(100);
  ok('invalid action blocks upload',sent.length===0&&/^Cannot upload — Layer 1 R1 C1: /.test(d.getElementById('hidStatus').textContent));
  { const inp=d.getElementById('action'); inp.value='a'; inp.dispatchEvent(new w.Event('input',{bubbles:true})); }
  // 16-button layout -> the 4x4 (ch57x-3) protocol is chosen instead
  { const r=d.getElementById('rows'), c=d.getElementById('columns'); r.value='4'; r.dispatchEvent(new w.Event('change',{bubbles:true})); c.value='4'; c.dispatchEvent(new w.Event('change',{bubbles:true})); }
  await sleep(30);
  ok('layout is now 4x4: '+d.getElementById('rows').value+'x'+d.getElementById('columns').value,d.getElementById('rows').value==='4'&&d.getElementById('columns').value==='4');
  ok('info button disabled for the 4x4 pad',d.getElementById('hidInfo').disabled===true);
  sent.length=0; c.asked.length=0;
  click('hidUpload'); await sleep(250);
  ok('confirm names 4x4 protocol: '+c.last.split('\n')[0],/protocol 8850 \(4×4 pad\)/.test(c.last));
  const f2=sent.length?sent[0].data.slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join(' '):'';
  ok('first packet = upstream 4x4 bind: '+f2,f2==='fd 01 01 01 00 01 00 00 04 00 00 00');
  // a delay on the 4x4 pad is dropped by the protocol: amber warning while editing, WARN in preview + confirm, upload proceeds
  const msg=()=>d.getElementById('actionMsg').textContent;
  ok('no 4x4 delay warning without a delay',!/ignores the delay option/.test(msg()));
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  { const inp=d.getElementById('action'); inp.value='{delay(100)}a,b'; inp.dispatchEvent(new w.Event('input',{bubbles:true})); }
  ok('editor warns about delay on 4x4: '+msg(),/514c:8850, 4×4 pad\) ignores the delay option/.test(msg()) && d.querySelector('#actionMsg .warn')!==null);
  click('hidPreview'); await sleep(20);
  ok('preview shows WARN for 4x4 delay',/WARN\s+Layer 1 R1 C1: the delay option is ignored on this keyboard \(4×4 pad\)/.test(d.getElementById('hidPlan').value) && !/ERROR/.test(d.getElementById('hidPlan').value));
  sent.length=0; c.asked.length=0;
  click('hidUpload'); await sleep(250);
  ok('confirm repeats the 4x4 delay warning, upload proceeds',/delay option is ignored/.test(c.last)&&sent.length>0);
  { const r=d.getElementById('rows'); r.value='3'; r.dispatchEvent(new w.Event('change',{bubbles:true})); } await sleep(30);
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  ok('12-key layout: no 4x4 delay warning (delay is supported there): '+msg(),!/ignores the delay option/.test(msg()));
  // script generator still works
  ok('script button present',!!d.getElementById('btnUpScript'));
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
