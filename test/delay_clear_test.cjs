const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-config-editor.html'),'utf8');
let answer=false, asked=[]; const errors=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){ w.confirm=m=>{asked.push(m);return answer;}; w.addEventListener('error',e=>errors.push(e.message)); }});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
const click=el=>(typeof el==='string'?$(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const type=(id,v)=>{ const e=$(id); e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true})); };
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
ok('page loads without script errors '+errors.join(';'),errors.length===0);
const cells=()=>d.querySelectorAll('.cell');
click(cells()[0]);
// --- clear confirmation
ok('selected cell has action',$('action').value==='a');
answer=false; click('btnClear');
ok('clear asks when action has content',asked.length===1);
ok('declining keeps action',$('action').value==='a');
answer=true; click('btnClear');
ok('accepting clears',$('action').value==='' && asked.length===2);
click('btnClear');
ok('no prompt when already empty',asked.length===2);
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
