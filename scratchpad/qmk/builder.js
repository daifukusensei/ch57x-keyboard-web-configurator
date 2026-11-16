// ----- keycode palette -----
const PANES = ['basic','media','mouse','advanced'];
const MODLABEL = {ctrl:'Ctrl',shift:'Shift',alt:'Alt',win:'Win',rctrl:'R-Ctrl',rshift:'R-Shift',ralt:'R-Alt',rwin:'R-Win'};
const KEYLABEL = {escape:'Esc',backspace:'⌫',delete:'Del',enter:'Enter',space:'Space',tab:'Tab',capslock:'Caps',insert:'Ins',
  printscreen:'PrtSc',scrolllock:'ScrLk',pause:'Pause',numlock:'NumLk',application:'Menu',up:'↑',down:'↓',left:'←',right:'→',
  home:'Home',end:'End',pageup:'PgUp',pagedown:'PgDn',minus:'-',equal:'=',leftbracket:'[',rightbracket:']',backslash:'\\',
  semicolon:';',quote:"'",grave:'`',comma:',',dot:'.',slash:'/',nonushash:'#',nonusbackslash:'\\|',
  numpadslash:'/',numpadasterisk:'*',numpadminus:'−',numpadplus:'+',numpadenter:'Ent',numpaddot:'.',numpadequal:'='};
for(let i=0;i<10;i++) KEYLABEL['numpad'+i]=String(i);
const KEYGROUPS = [
  ['Letters','abcdefghijklmnopqrstuvwxyz'.split('')],
  ['Numbers','0123456789'.split('')],
  ['Function',Array.from({length:24},(_,i)=>'f'+(i+1))],
  ['Controls',['escape','tab','capslock','enter','space','backspace','delete','insert','application','printscreen','scrolllock','pause','numlock']],
  ['Navigation',['up','down','left','right','home','end','pageup','pagedown']],
  ['Symbols',['minus','equal','leftbracket','rightbracket','backslash','semicolon','quote','grave','comma','dot','slash','nonushash','nonusbackslash']],
  ['Numpad',Array.from({length:10},(_,i)=>'numpad'+i).concat(['numpadslash','numpadasterisk','numpadminus','numpadplus','numpadenter','numpaddot','numpadequal'])],
];
const MEDIALABEL = {screenbrightnessup:'Bright +',screenbrightnessdown:'Bright −',next:'Next',previous:'Prev',stop:'Stop',play:'Play',
  mute:'Mute',volumeup:'Vol +',volumedown:'Vol −',favorites:'Favorites',calculator:'Calc',screenlock:'Lock',
  webpagehome:'Web home',webpageback:'Web back',webpageforward:'Web fwd'};

function pcap(label,title,onclick,extra,data){
  const props={type:'button',class:'pcap'+(extra?' '+extra:''),title,'aria-label':title,text:label,onclick};
  if(data) props['data-key']=data;
  return h('button',props);
}
function group(title,caps){ const g=h('div',{class:'pgroup'},h('h4',{text:title}),h('div',{class:'caps'})); caps.forEach(c=>g.lastChild.append(c)); return g; }
function buildControls(){
  const mc=$('modChips');
  MOD_ORDER.forEach(m=>{
    if(m==='rctrl') mc.append(h('span',{class:'modsep'}));
    const b=h('button',{type:'button',class:'pcap mod','data-mod':m,'aria-pressed':'false',
      title:m+' — applies to the next keycode you click',text:MODLABEL[m]});
    b.addEventListener('click',()=>{ chips.has(m)?chips.delete(m):chips.add(m); syncMods(); });
    mc.append(b);
  });
  const basic=$('pane-basic');
  KEYGROUPS.forEach(([title,keys])=>basic.append(group(title,keys.map(k=>
    pcap(k.length===1?k.toUpperCase():(KEYLABEL[k]||k.toUpperCase()),k,()=>assignKey(k),k.length>3?'wide':'',k)))));
  $('pane-media').append(group('Media keys',MEDIA.filter(m=>m!=='prev').map(m=>
    pcap(MEDIALABEL[m]||m,m,()=>assignKey(m),'wide',m))));
  const mouseCaps=(id,items)=>items.forEach(([label,core])=>$(id).append(pcap(label,core,()=>assignMouse(core),'wide')));
  mouseCaps('mouseClicks',[['Left click','click(left)'],['Right click','click(right)'],['Middle click','click(middle)']]);
  mouseCaps('mouseWheels',[['Wheel ▲','wheelup'],['Wheel ▼','wheeldown']]);
  setPane('basic');
}
function setPane(n){
  PANES.forEach(p=>{
    const on=p===n; $('pane-'+p).hidden=!on;
    const t=$('ptab-'+p); t.classList.toggle('active',on); t.setAttribute('aria-selected',String(on));
  });
  $('modRow').hidden = !(n==='basic'||n==='mouse');
}
function syncMods(){
  $('modChips').querySelectorAll('button[data-mod]').forEach(b=>b.setAttribute('aria-pressed',String(chips.has(b.dataset.mod))));
}
const orderedMods = allowed => MOD_ORDER.filter(m=>chips.has(m) && (!allowed||allowed[m]));
const appendMode = () => $('seqMode').checked;
function consumeMods(){ chips.clear(); syncMods(); }   // modifiers are one-shot: they apply to the next keycode only
function assignKey(key){
  const media=MEDIA.includes(key);
  applyAction(media ? key : orderedMods().concat(key).join('-'), appendMode());
  if(!media) consumeMods();
}
function assignMouse(core){
  const dropped=MOD_ORDER.filter(m=>chips.has(m)&&!MODS_MOUSE[m]);
  if(dropped.length) toast('Mouse actions only take ctrl, shift and alt — left out: '+dropped.join(', '));
  applyAction(orderedMods(MODS_MOUSE).concat(core).join('-'), appendMode());
  consumeMods();
}
const clampMove = v => Math.max(-127,Math.min(127,parseInt(v,10)||0));
function applyAction(str, append){
  if(str==null) return;
  const cur=getVal(sel).trim();
  setVal(sel, append && cur ? cur+','+str : str);
  $('action').value=getVal(sel); onActionChanged();
}
function wirePalette(){
  document.querySelectorAll('.ptab').forEach(b=>b.addEventListener('click',()=>setPane(b.dataset.pane)));
  $('msMove').addEventListener('click',()=>assignMouse('move('+clampMove($('mx').value)+','+clampMove($('my').value)+')'));
  $('msDrag').addEventListener('click',()=>assignMouse('drag('+$('mbtn').value+','+clampMove($('mx').value)+','+clampMove($('my').value)+')'));
  $('msWheel').addEventListener('click',()=>assignMouse('wheel('+clampMove($('mn').value)+')'));
  $('hidCodeSet').addEventListener('click',()=>{
    const v=$('bhid').value.trim();
    if(!/^\d+$/.test(v)||+v>255){ toast('Enter a code from 0 to 255'); return; }
    assignKey('<'+parseInt(v,10)+'>');
  });
  document.querySelectorAll('#helpLink,.helpjump').forEach(a=>a.addEventListener('click',()=>{ $('help').open=true; }));
}

