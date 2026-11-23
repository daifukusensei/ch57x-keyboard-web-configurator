const autoConfirm=require('./lib/autoconfirm.cjs');
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const sent=[]; const listeners={};
const dev={vendorId:0x1189,productId:0x8840,productName:'Mock Macropad',opened:false,
  collections:[{outputReports:[{reportId:3}]}],
  async open(){this.opened=true;},
  async sendReport(id,data){ sent.push({id,data:Array.from(data)});
    if(data[0]===0xfb){ setTimeout(()=>{ (listeners.inputreport||[]).forEach(f=>f({data:new DataView(new Uint8Array([0xfb,12,2,0]).buffer)})); },5); } },
  addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f);}, removeEventListener(t,f){listeners[t]=(listeners[t]||[]).filter(x=>x!==f);} };
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/?debug=1',beforeParse(w){
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
  ok("model follows device: "+d.getElementById("yamlOut").value.split("\n")[1],/^model: ch57x-1$/.test(d.getElementById("yamlOut").value.split("\n")[1]));
  ok('connected status',/Connected: 1189:8840 .*ch57x-1/.test(d.getElementById("hidStatus").textContent));
  ok('upload enabled',!d.getElementById('hidUpload').disabled && !d.getElementById('hidInfo').disabled);
  click('hidInfo'); await sleep(80);
  ok('device info read '+d.getElementById('hidStatus').textContent,/12 buttons and 2 knobs/.test(d.getElementById('hidStatus').textContent));
  ok('info packet sent',sent.some(s=>s.data[0]===0xfb&&s.id===3));
  sent.length=0;
  d.getElementById('hidLayers').value='0';
  click('hidUpload'); await sleep(200);
  ok('confirm shown',/Write 18 binding/.test(c.last));
  // layer 1: 12 buttons + 6 knob actions = 18 bindings, each 4-5 packets
  ok('all reports id 3, 64 bytes',sent.length>0&&sent.every(s=>s.id===3&&s.data.length===64));
  const first=sent[0].data.slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join(' ');
  ok('first packet = bind key1 "a" layer1: '+first,first==='fe 01 01 01 00 00 00 00 00 01 00 04');
  ok('commit trio present',sent.some(s=>s.data[0]===0xfd&&s.data[1]===0xfe&&s.data[2]===0xff));
  console.log('packets sent:',sent.length);
  ok('success status',/Uploaded 18 binding/.test(d.getElementById('hidStatus').textContent));
  // the Write selector names each layer: "Layer 3" uploads layer 3 even while layer 1 is on screen
  ok('Write options: All layers, Layer 1-3',[...d.getElementById('hidLayers').options].map(o=>o.textContent).join('|')==='All layers|Layer 1|Layer 2|Layer 3');
  sent.length=0; c.asked.length=0; d.getElementById('hidLayers').value='2';
  click('hidUpload'); await sleep(200);
  const binds=sent.filter(s=>s.data[0]===0xfe);
  ok('Layer 3 chosen while viewing layer 1: confirm says layer 3, packets carry layer byte 3',/on layer 3\./.test(c.last)&&binds.length>0&&binds.every(s=>s.data[2]===3)&&/^Layer 1/.test(d.getElementById('editTitle').textContent));
  d.getElementById('hidLayers').value='all'; sent.length=0;
  click('hidUpload'); await sleep(300);
  ok('All layers: confirm says all 3 layers, packets for layers 1-3',/on all 3 layers\./.test(c.last)&&[1,2,3].every(n=>sent.some(s=>s.data[0]===0xfe&&s.data[2]===n)));
  d.getElementById('hidLayers').value='0';
  // invalid action blocks upload
  sent.length=0;
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const inp=d.getElementById('action'); inp.value='hyper-a'; inp.dispatchEvent(new w.Event('input',{bubbles:true}));
  click('hidUpload'); await sleep(100);
  ok('invalid action blocks upload',sent.length===0&&/^Cannot upload — Layer 1 R1 C1: /.test(d.getElementById('hidStatus').textContent));
  // script generator still works
  ok('no CLI-script controls',!d.getElementById('btnUpScript')&&!d.getElementById('upOs'));
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
