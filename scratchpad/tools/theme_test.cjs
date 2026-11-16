const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../../ch57x-config-editor.html'),'utf8');
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
function load({stored,systemDark}){
  let listeners=[];
  return new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',beforeParse(w){
    if(stored) w.localStorage.setItem('ch57x-theme',stored);
    w.__mq={matches:systemDark,addEventListener:(t,f)=>listeners.push(f)};
    w.matchMedia=()=>w.__mq; w.__fire=v=>{w.__mq.matches=v;listeners.forEach(f=>f());};
  }}).window;
}
const btnText=w=>w.document.getElementById('themeToggle').textContent;
const attr=w=>w.document.documentElement.getAttribute('data-theme');
const click=w=>w.document.getElementById('themeToggle').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
let w=load({systemDark:false});
ok('light system: no override, offers Dark',attr(w)===null&&/Dark/.test(btnText(w)));
click(w); ok('click -> dark, saved',attr(w)==='dark'&&w.localStorage.getItem('ch57x-theme')==='dark'&&/Light/.test(btnText(w)));
click(w); ok('click -> light, saved',attr(w)==='light'&&w.localStorage.getItem('ch57x-theme')==='light'&&/Dark/.test(btnText(w)));
w=load({systemDark:true});
ok('dark system: offers Light',attr(w)===null&&/Light/.test(btnText(w)));
click(w); ok('dark system click -> light override',attr(w)==='light');
w=load({stored:'dark',systemDark:false});
ok('stored dark applied on load',attr(w)==='dark'&&/Light/.test(btnText(w)));
w=load({systemDark:false}); w.__fire(true);
ok('follows system change when no saved choice',/Light/.test(btnText(w)));
// CSS contract: explicit overrides exist and dark media block does not clobber explicit light
ok('css has explicit dark + light guard',/:root\[data-theme="dark"\]\{/.test(html)&&/:root:not\(\[data-theme="light"\]\)/.test(html));
ok('app still renders',w.document.getElementById('yamlOut').value.includes('layers:'));
console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
