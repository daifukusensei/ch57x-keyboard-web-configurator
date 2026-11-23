const autoConfirm=require('./lib/autoconfirm.cjs');
// Basic-tab keyboard: US (ANSI) by default whatever the browser language, US/UK choice (saved), board modifiers, nothing lost.
const {JSDOM}=require('jsdom'); const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../ch57x-keyboard-web-configurator.html'),'utf8');
let fail=0; const ok=(n,c)=>{ if(!c){fail++;console.log('FAIL',n);} else console.log('ok  ',n); };
function open(langs,store){
  const errors=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){
    Object.defineProperty(w.navigator,'languages',{get:()=>langs}); Object.defineProperty(w.navigator,'language',{get:()=>langs[0]});
    w.alert=()=>{}; w.addEventListener('error',e=>errors.push(e.message));
    for(const [k,v] of Object.entries(store||{})) w.localStorage.setItem(k,v);
  }});
  const w=dom.window,d=w.document; const c=autoConfirm(w);
  return {w,d,errors,c,click:el=>(typeof el==='string'?d.querySelector(el):el).dispatchEvent(new w.MouseEvent('click',{bubbles:true})),
    board:k=>d.querySelector('#kbBoard [data-key="'+k+'"]'), extra:k=>d.querySelector('#kbExtra [data-key="'+k+'"]'),
    act:()=>d.getElementById('action').value};
}
const ALL=['backslash','nonushash','nonusbackslash'];
(async()=>{
  // ---- default -> ANSI ----
  let p=open(['en-US','en']);
  ok('no script errors (US) '+p.errors.join(';'),p.errors.length===0);
  ok('US: board is ANSI',p.d.getElementById('kbBoard').classList.contains('ansi'));
  ok('select offers US and UK only (no Auto), US selected',[...p.d.querySelectorAll('#kbLayout option')].map(o=>o.value).join()==='us,uk'&&p.d.getElementById('kbLayout').value==='us');
  ok('US: backslash on the board, ISO keys listed below',!!p.board('backslash')&&!p.board('nonushash')&&!!p.extra('nonushash')&&!!p.extra('nonusbackslash'));
  ok('US: 2 shows @',p.board('2').textContent.includes('@'));
  ok('full size: 104 keys on the ANSI board',p.d.querySelectorAll('#kbBoard .kcap').length===104);
  ok('numpad on the board (marked .np), F13-F24 below, numpad = in the extra group',p.d.querySelectorAll('#kbBoard .np').length===17&&!!p.d.querySelector('#kbBoard .np [data-key="numpad5"]')
    &&!!p.d.querySelector('#kbBoard .np [data-key="numlock"]')&&!!p.d.querySelector('#kbGroups [data-key="f24"]')&&!!p.extra('numpadequal'));
  const npList=[...p.d.querySelectorAll('#kbNumpad [data-key]')].map(b=>b.dataset.key), npBoard=[...p.d.querySelectorAll('#kbBoard .np [data-key]')].map(b=>b.dataset.key);
  ok('phone numpad list offers exactly the board numpad keys',npList.length===17&&npBoard.every(k=>npList.includes(k)));
  // modifier keys on the board toggle the shared one-shot chips
  p.click('#btnBlank'); await p.c.tick();
  p.click('#kbBoard [data-mod="rshift"]'); p.click('#kbBoard [data-mod="ctrl"]');
  ok('board modifiers pressed',p.d.querySelector('#kbBoard [data-mod="ctrl"]').getAttribute('aria-pressed')==='true'&&p.d.querySelector('#modChips [data-mod="ctrl"]').getAttribute('aria-pressed')==='true');
  p.click(p.board('a')); ok('ctrl + rshift + A -> ctrl-rshift-a: '+p.act(),p.act()==='ctrl-rshift-a');
  ok('board modifiers are one-shot',p.d.querySelector('#kbBoard [data-mod="ctrl"]').getAttribute('aria-pressed')==='false');
  p.click(p.extra('nonushash')); ok('ISO # from the extra group -> nonushash',p.act()==='nonushash');
  p.click(p.board('numpadenter')); ok('numpad Enter on the board -> numpadenter',p.act()==='numpadenter');
  p.click('#kbNumpad [data-key="numpad7"]'); ok('phone numpad list -> numpad7',p.act()==='numpad7');
  ok('modifier row hidden on Basic (the board has the modifiers)',p.d.getElementById('modRow').hidden);
  // every keycode the old flat palette offered is still offered once
  const val=p.w.eval('validateAction');
  const keys=[...p.d.querySelectorAll('#pane-basic [data-key]:not(#kbNumpad *)')].map(b=>b.dataset.key);
  const want='abcdefghijklmnopqrstuvwxyz0123456789'.split('').concat(Array.from({length:24},(_,i)=>'f'+(i+1)),
    ['escape','tab','capslock','enter','space','backspace','delete','insert','application','printscreen','scrolllock','pause','numlock',
     'up','down','left','right','home','end','pageup','pagedown','minus','equal','leftbracket','rightbracket','semicolon','quote','grave','comma','dot','slash'],ALL,
    Array.from({length:10},(_,i)=>'numpad'+i),['numpadslash','numpadasterisk','numpadminus','numpadplus','numpadenter','numpaddot','numpadequal']);
  ok('all '+want.length+' keycodes offered: missing '+want.filter(k=>!keys.includes(k)).join(','),want.every(k=>keys.includes(k)));
  ok('keycodes unique and valid',new Set(keys).size===keys.length&&keys.every(k=>val(k).level==='ok'));

  // ---- no detection: a UK browser still starts on US ----
  p=open(['en-GB','en']);
  ok('no script errors (en-GB)',p.errors.length===0);
  ok('en-GB browser: still ANSI, nothing detected',p.d.getElementById('kbBoard').classList.contains('ansi')&&p.d.getElementById('kbLayout').value==='us');
  // ---- choosing UK -> ISO, saved ----
  let sel=p.d.getElementById('kbLayout'); sel.value='uk'; sel.dispatchEvent(new p.w.Event('change',{bubbles:true}));
  ok('choosing UK saves it',p.w.localStorage.getItem('ch57x-configurator-kblayout')==='uk');
  ok('UK: board is ISO with the tall Enter',p.d.getElementById('kbBoard').classList.contains('iso')&&!!p.d.querySelector('#kbBoard .isoenter [data-key="enter"]'));
  ok('UK: # and \\| keys on the board, ANSI backslash below',!!p.board('nonushash')&&!!p.board('nonusbackslash')&&!p.board('backslash')&&!!p.extra('backslash'));
  ok('UK legends: " on 2, £ on 3, @ on quote, ~ # , ¬ on grave, AltGr',p.board('2').textContent.includes('"')&&p.board('3').textContent.includes('£')
    &&p.board('quote').textContent.includes('@')&&p.board('nonushash').textContent.includes('~')&&p.board('grave').textContent.includes('¬')
    &&p.d.querySelector('#kbBoard [data-mod="ralt"]').textContent.includes('AltGr'));
  ok('full size: 105 keys on the ISO board',p.d.querySelectorAll('#kbBoard .kcap').length===105);
  p.click('#btnBlank'); await p.c.tick(); p.click(p.board('nonushash')); ok('UK # key -> nonushash (positional name)',p.act()==='nonushash');

  // ---- back to US, saved choices ----
  sel=p.d.getElementById('kbLayout'); sel.value='us'; sel.dispatchEvent(new p.w.Event('change',{bubbles:true}));
  ok('choosing US redraws ANSI',p.d.getElementById('kbBoard').classList.contains('ansi')&&p.w.localStorage.getItem('ch57x-configurator-kblayout')==='us');
  p=open(['en-US'],{'ch57x-configurator-kblayout':'uk'});
  ok('saved UK choice is restored',p.d.getElementById('kbBoard').classList.contains('iso')&&p.d.getElementById('kbLayout').value==='uk');
  for(const v of ['auto','bogus']){ p=open(['en-GB'],{'ch57x-configurator-kblayout':v});
    ok('saved "'+v+'" falls back to US',p.d.getElementById('kbBoard').classList.contains('ansi')&&p.d.getElementById('kbLayout').value==='us'&&p.errors.length===0); }
  console.log(fail?fail+' FAILED':'ALL PASSED'); process.exit(fail?1:0);
})();
