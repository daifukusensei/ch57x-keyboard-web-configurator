const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-config-editor.html'),'utf8');
let answer=false, asked=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){ w.confirm=m=>{asked.push(m);return answer;}; }});
const w=dom.window,d=w.document; const click=id=>d.getElementById(id).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
// make a change
d.querySelector('.cell').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const inp=d.getElementById('action'); inp.value='ctrl-z'; inp.dispatchEvent(new w.Event('input',{bubbles:true}));
const before=d.getElementById('yamlOut').value;
answer=false; click('btnExample');
ok('example asks for confirmation',asked.length===1);
ok('declining keeps edits',d.getElementById('yamlOut').value===before && /ctrl-z/.test(before));
answer=true; click('btnExample');
ok('accepting loads example',asked.length===2 && !/ctrl-z/.test(d.getElementById('yamlOut').value));
answer=false; click('btnBlank');
ok('blank still asks',asked.length===3);
console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
