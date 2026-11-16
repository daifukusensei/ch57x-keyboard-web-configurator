const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-config-editor.html'),'utf8');
const sent=[];
const dev={vendorId:0x1189,productId:0x8890,productName:'Mock 8890',opened:false,collections:[{outputReports:[{reportId:3}]}],
  async open(){this.opened=true;}, async sendReport(id,data){ sent.push({id,data:Array.from(data)}); },
  addEventListener(){}, removeEventListener(){} };
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
  w.navigator.hid={getDevices:async()=>[],requestDevice:async()=>[dev],addEventListener(){}};
  w.confirm=(m)=>{w.__confirm=m;return true;}; w.alert=()=>{};
  w.addEventListener('error',e=>errors.push(e.message));
}});
const w=dom.window,d=w.document; const click=id=>d.getElementById(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const setAction=v=>{ const i=d.getElementById('action'); i.value=v; i.dispatchEvent(new w.Event('input',{bubbles:true})); };
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
(async()=>{
  await sleep(50);
  ok('no script errors '+errors.join(';'),errors.length===0);
  ok('movement inputs limited to -127..127',['mx','my','mn'].every(id=>d.getElementById(id).min==='-127'&&d.getElementById(id).max==='127'));
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  setAction('{delay(100)}a');
  ok('no device warning before connecting',!/no delay feature/.test(d.getElementById('actionMsg').textContent));
  click('hidConnect'); await sleep(50);
  ok('connected as 8890: '+d.getElementById('hidStatus').textContent,/Connected: 1189:8890 .*ch57x-2 · protocol 8890/.test(d.getElementById('hidStatus').textContent));
  ok('editor warns about delay once connected: '+d.getElementById('actionMsg').textContent,/connected keyboard \(1189:8890\) has no delay feature/.test(d.getElementById('actionMsg').textContent));
  d.getElementById('hidLayers').value='current';
  click('hidPreview'); await sleep(20);
  ok('preview status names the reason: '+d.getElementById('hidStatus').textContent,/^Cannot upload — Layer 1 R1 C1: delay is not supported by this keyboard model$/.test(d.getElementById('hidStatus').textContent.trim()));
  sent.length=0; w.__confirm='';
  click('hidUpload'); await sleep(100);
  ok('upload blocked, reason shown: '+d.getElementById('hidStatus').textContent,sent.length===0&&!w.__confirm&&/^Cannot upload — Layer 1 R1 C1: delay is not supported by this keyboard model\. Fix this first\.$/.test(d.getElementById('hidStatus').textContent.trim()));
  // a second bad action -> count of the rest
  d.querySelectorAll('.cell')[1].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  setAction('{delay(50)}b'); click('hidUpload'); await sleep(50);
  ok('several problems: first one named, rest counted: '+d.getElementById('hidStatus').textContent,/\(\+1 more, see list\)/.test(d.getElementById('hidStatus').textContent));
  setAction('b');
  // removing the delay makes it uploadable
  d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  setAction('a');
  ok('warning gone after removing delay',!/no delay feature/.test(d.getElementById('actionMsg').textContent));
  sent.length=0; click('hidUpload'); await sleep(200);
  ok('upload proceeds without the delay',sent.length>0&&/Uploaded/.test(d.getElementById('hidStatus').textContent));
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
