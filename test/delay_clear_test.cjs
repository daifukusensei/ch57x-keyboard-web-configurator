const {JSDOM}=require('jsdom'); const fs=require('fs'); const autoConfirm=require('./lib/autoconfirm.cjs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){ w.addEventListener('error',e=>errors.push(e.message)); }});
const w=dom.window,d=w.document,$=id=>d.getElementById(id); const c=autoConfirm(w,false);
const click=el=>(typeof el==='string'?$(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const type=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true})); };
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
(async()=>{
ok('page loads without script errors '+errors.join(';'),errors.length===0);
const cells=()=>d.querySelectorAll('.cell');
click(cells()[0]);
// --- clear confirmation
ok('selected cell has action',$('action').value==='a');
c.answer=false; click('btnClear'); await c.tick();
ok('clear asks when action has content: '+c.last,c.asked.length===1&&c.last==='Layer 1 · Button row 1, column 1: "a"'&&$('confirmTitle').textContent==='Clear this key?');
ok('declining keeps action',$('action').value==='a');
c.answer=true; click('btnClear'); await c.tick();
ok('accepting clears',$('action').value==='' && c.asked.length===2);
click('btnClear'); await c.tick();
ok('no prompt when already empty',c.asked.length===2);
// --- delay toggle
ok('button starts as Apply',$('btnDelay').textContent==='Apply delay option');
click('btnDelay'); ok('apply with no action: refused',$('action').value==='');
type('action','left,a,right');
click('btnDelay'); ok('apply with no delay value: refused',$('action').value==='left,a,right');
$('delay').value='100';
click('btnDelay');
ok('apply -> {delay(100)} prefix',$('action').value==='{delay(100)}left,a,right');
ok('button now says Remove',$('btnDelay').textContent==='Remove delay option');
ok('delay shown in input',$('delay').value==='100');
ok('yaml carries delay',/\{delay\(100\)\}left,a,right/.test($('yamlOut').value));
click('btnDelay');
ok('remove strips prefix',$('action').value==='left,a,right' && $('btnDelay').textContent==='Apply delay option');
// typing a delay by hand flips the button
type('action','{delay(250)}x,y');
ok('hand-typed delay flips to Remove',$('btnDelay').textContent==='Remove delay option' && $('delay').value==='250');
// selecting another cell resets label
click(cells()[1]);
ok('other cell without delay shows Apply',$('btnDelay').textContent==='Apply delay option');
click(cells()[0]);
ok('back on delayed cell shows Remove',$('btnDelay').textContent==='Remove delay option');
console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
