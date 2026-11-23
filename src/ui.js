// ---------- UI ----------
const $ = id => document.getElementById(id);
const STORE = 'ch57x-configurator-v1';
const MOD_ORDER = ['ctrl','shift','alt','win','rctrl','rshift','ralt','rwin'];
const chips = new Set();
let state, layerIdx = 0, sel = {t:'b',r:0,c:0};
// "Show comments on keys" is a per-viewer preference (it is not part of the mapping).
const NOTES_PREF = 'ch57x-configurator-notes';
let showNotes = false;
try{ showNotes = localStorage.getItem(NOTES_PREF)==='1'; }catch(e){}
function saveNotesPref(){ try{ localStorage.setItem(NOTES_PREF, showNotes?'1':'0'); }catch(e){} }
// Keypad canvas zoom, 60–200 % in 10 % steps; also a per-viewer preference.
const ZOOM_PREF = 'ch57x-configurator-zoom', ZOOM_MIN = 60, ZOOM_MAX = 200, ZOOM_STEP = 10;
let zoomPct = 100;
try{ const z=parseInt(localStorage.getItem(ZOOM_PREF),10); if(z>=ZOOM_MIN && z<=ZOOM_MAX) zoomPct=Math.round(z/ZOOM_STEP)*ZOOM_STEP; }catch(e){}

function h(tag, props = {}, ...kids){
  const e = document.createElement(tag);
  for(const [k,v] of Object.entries(props)){
    if(k==='class') e.className=v;
    else if(k==='text') e.textContent=v;
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  kids.forEach(x => e.append(x));
  return e;
}
function toast(msg){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),1800);
}
function save(){ try{ localStorage.setItem(STORE, JSON.stringify({state,layerIdx})); }catch(e){} }
function loadSaved(){
  try{
    const raw=localStorage.getItem(STORE); if(!raw) return null;
    const o=JSON.parse(raw); const st=normalizeState(o.state);
    layerIdx=Math.min(o.layerIdx||0, st.layers.length-1); return st;
  }catch(e){ return null; }
}
const dims = () => dimsOf(state);
const layer = () => state.layers[layerIdx];
const getVal = t => t.t==='b' ? layer().buttons[t.r][t.c] : layer().knobs[t.k][t.p];
function setVal(t,v){ if(t.t==='b') layer().buttons[t.r][t.c]=v; else layer().knobs[t.k][t.p]=v; }
// per-key comments (written at the top of the YAML as "#@ L1 R1 C1: ..." lines, which the tool ignores)
const getNote = t => (t.t==='b' ? (layer().bnotes[t.r]||[])[t.c] : (layer().knotes[t.k]||{})[t.p]) || '';
function setNote(t,v){
  v=String(v).replace(/[\r\n]+/g,' ');
  if(t.t==='b') layer().bnotes[t.r][t.c]=v; else layer().knotes[t.k][t.p]=v;
}
const countNotes = st => st.layers.reduce((n,l)=>n
  + l.bnotes.reduce((m,row)=>m+row.filter(s=>s.trim()).length,0)
  + l.knotes.reduce((m,k)=>m+[k.ccw,k.press,k.cw].filter(s=>s.trim()).length,0),0);
const same = (a,b) => a.t===b.t && (a.t==='b' ? a.r===b.r&&a.c===b.c : a.k===b.k&&a.p===b.p);
function clampSel(){
  const {R,C}=dims();
  if(sel.t==='b'){ if(sel.r>=R||sel.c>=C) sel={t:'b',r:0,c:0}; }
  else if(sel.k>=state.knobs) sel = {t:'b',r:0,c:0};
}
function selLabel(t){
  return t.t==='b' ? 'Button row '+(t.r+1)+', column '+(t.c+1)
    : 'Knob '+(t.k+1)+' — '+({ccw:'rotate counter-clockwise',press:'press',cw:'rotate clockwise'})[t.p];
}

// ----- rendering -----
function renderSettings(){
  $('orientation').value=state.orientation;
  $('rows').value=state.rows; $('columns').value=state.columns; $('knobs').value=state.knobs;
  $('showNotes').checked=showNotes;
}
function renderTabs(){
  const box=$('tabs'); box.replaceChildren();
  state.layers.forEach((_,i)=>box.append(h('button',{type:'button',class:'tab'+(i===layerIdx?' active':''),title:'Layer '+(i+1),
    'aria-label':'Layer '+(i+1),'aria-pressed':String(i===layerIdx),text:String(i+1),
    onclick:()=>{layerIdx=i;clampSel();renderAll();save();}})));
}
function cellEl(t,val,label,extra){
  const v=checkAction(state,val,t.t==='b');
  const cls=['cell']; if(extra) cls.push(extra);
  if(v.kind!=='empty'){ if(v.level==='error') cls.push('err'); else if(v.level==='warn') cls.push('warn'); }
  const on=same(t,sel); if(on) cls.push('sel');
  const note=getNote(t).trim(); if(note) cls.push('hasnote');
  return h('button',{type:'button',class:cls.join(' '),title:label+': '+(val||'(empty)')+(note?'\n'+note:''),'aria-pressed':String(on),
    onclick:()=>select(t)},
    h('span',{class:'lbl',text:label}), h('span',{class:'note',text:note}), h('span',{class:'val'+(val?'':' empty'),text:val||'—'}));
}
function renderDevice(){
  const dev=$('device'); dev.className='device '+state.orientation+(showNotes?' notes':''); dev.replaceChildren();
  const {R,C}=dims();
  const grid=h('div',{class:'grid'}); grid.style.gridTemplateColumns='repeat('+C+',var(--cw,86px))';
  for(let r=0;r<R;r++) for(let c=0;c<C;c++) grid.append(cellEl({t:'b',r,c},layer().buttons[r][c],'R'+(r+1)+' C'+(c+1)));
  dev.append(grid);
  if(state.knobs){
    const vertical = state.orientation==='clockwise'||state.orientation==='counterclockwise';
    const kb=h('div',{class:'knobs'+(vertical?'':' vert')});
    layer().knobs.forEach((k,n)=>{
      kb.append(h('div',{class:'knob'}, h('h3',{text:'Knob '+(n+1)}),
        h('div',{class:'dial'},
          cellEl({t:'k',k:n,p:'ccw'},k.ccw,'↺ ccw','small'),
          cellEl({t:'k',k:n,p:'press'},k.press,'● press','round'),
          cellEl({t:'k',k:n,p:'cw'},k.cw,'↻ cw','small'))));
    });
    dev.append(kb);
  }
}
function renderEditor(focus){
  $('editTitle').textContent='Layer '+(layerIdx+1)+' · '+selLabel(sel);
  $('action').value=getVal(sel);
  $('note').value=getNote(sel);
  renderMsg(); if(focus) $('action').focus();
}
function renderMsg(){
  syncDelayUi();
  const v=checkAction(state,getVal(sel),sel.t==='b'); const box=$('actionMsg'); box.replaceChildren();
  if(v.kind==='empty'){ box.append(h('span',{class:'hint',text:'Empty — pick or type an action.'})); return; }
  v.msgs.forEach(m=>{
    const div=h('div',{class:v.level==='error'?'err':'warn',text:(v.level==='error'?'✗ ':'⚠ ')+m.replace(/see Help$/,'see ')});
    if(/see Help$/.test(m)) div.append(h('a',{href:'#help-actions',class:'helpjump',text:'Help'}));   // opens Help at Actions
    box.append(div);
  });
  // The 1189:8890 firmware has no delay feature (the original tool refuses it too), so flag it while editing, not only at upload.
  if(hidDev && hidFamily()==='8890' && DELAY_RE.test(getVal(sel)))
    box.append(h('div',{class:'warn',text:'⚠ The connected keyboard (1189:8890) has no delay feature, so this action cannot be uploaded. Remove the delay option to upload it.'}));
  // The 4x4 514c:8850 protocol has no delay field: the action uploads, but without the pause.
  if(hidDev && hidFamily()==='8850' && DELAY_RE.test(getVal(sel)))
    box.append(h('div',{class:'warn',text:'⚠ The connected keyboard (514c:8850, 4×4 pad) ignores the delay option: this action uploads, but the keys are sent without the pause.'}));
}
function collectIssues(){
  const issues=[]; let empty=0;
  state.layers.forEach((l,li)=>{
    const chk=(val,label,isButton)=>{ const v=checkAction(state,val,isButton);
      if(v.kind==='empty'){empty++;return;}
      if(v.level!=='ok') v.msgs.forEach(m=>issues.push({level:v.level,text:'Layer '+(li+1)+', '+label+': '+m})); };
    l.buttons.forEach((row,r)=>row.forEach((val,c)=>chk(val,'R'+(r+1)+' C'+(c+1),true)));
    l.knobs.forEach((k,n)=>['ccw','press','cw'].forEach(p=>chk(k[p],'knob '+(n+1)+' '+p,false)));
  });
  return {issues,empty};
}
function renderYaml(){
  $('yamlOut').value=toYaml(state);
  const {issues,empty}=collectIssues();
  const box=$('summary'); box.replaceChildren();
  const errs=issues.filter(i=>i.level==='error').length, warns=issues.length-errs;
  // Only problems are reported; a clean mapping shows just the empty-action count, if any.
  if(issues.length) box.append(h('span',{class:errs?'err':'warn',
    text:errs?errs+' error'+(errs>1?'s':'')+(warns?', '+warns+' warning'+(warns>1?'s':''):''):warns+' warning'+(warns>1?'s':'')}));
  if(empty) box.append(h('span',{class:'hint',text:(issues.length?' · ':'')+empty+' empty action'+(empty>1?'s':'')}));
  if(issues.length){
    const ul=h('ul',{class:'issues'}); issues.slice(0,40).forEach(i=>ul.append(h('li',{class:i.level,text:i.text})));
    if(issues.length>40) ul.append(h('li',{text:'…and '+(issues.length-40)+' more'}));
    box.append(ul);
  }
}
function renderAll(){ renderSettings(); renderTabs(); renderDevice(); renderEditor(false); renderYaml(); hidSync(); }   // hidSync: the protocol for 514c:8850 depends on the layout
function select(t){ sel=t; renderDevice(); renderEditor(false); }
function onActionChanged(){ renderDevice(); renderMsg(); renderYaml(); save(); }

// ----- keycode palette -----
const PANES = ['basic','media','mouse','advanced'];
const MODLABEL = {ctrl:'Ctrl',shift:'Shift',alt:'Alt',win:'Win',rctrl:'R-Ctrl',rshift:'R-Shift',ralt:'R-Alt',rwin:'R-Win'};
// Keys that are not on the drawn full-size board (they keep the flat-list look).
const KEYGROUPS = [
  ['Function F13–F24',Array.from({length:12},(_,i)=>'f'+(i+13))],
];

// ----- physical keyboard (full-size: main block, navigation cluster, numpad) for the Basic tab -----
// Key names are positional HID usages, so the board geometry is shared; a layout only changes
// the shape (ISO: tall Enter, extra key beside Left Shift) and the printed legends.
// Each entry: [name, x, y, width=1, height=1] in key units (u). Names in MOD_ORDER toggle the modifier chips.
const KB_NUMPAD_X = 18.5;   // keys from here right are the numpad (sizes live in style.css: --kbw, 6.25u high)
function kbGeometry(iso){
  const Y=[0,1.25,2.25,3.25,4.25,5.25];   // row tops: the F-row sits 0.25u above the main block
  const row=(r,x,names,w=1)=>names.map((n,i)=>[n,x+i*w,Y[r],w]);
  const k=[['escape',0,0]].concat(
    row(0,2,['f1','f2','f3','f4']), row(0,6.5,['f5','f6','f7','f8']), row(0,11,['f9','f10','f11','f12']),
    row(0,15.25,['printscreen','scrolllock','pause']),
    row(1,0,['grave','1','2','3','4','5','6','7','8','9','0','minus','equal']), [['backspace',13,Y[1],2]],
    row(1,15.25,['insert','home','pageup']),
    [['tab',0,Y[2],1.5]], row(2,1.5,'qwertyuiop'.split('').concat(['leftbracket','rightbracket'])),
    row(2,15.25,['delete','end','pagedown']),
    [['capslock',0,Y[3],1.75]], row(3,1.75,'asdfghjkl'.split('').concat(['semicolon','quote'])),
    row(4,2.25,'zxcvbnm'.split('').concat(['comma','dot','slash'])), [['rshift',12.25,Y[4],2.75],['up',16.25,Y[4]]],
    [['ctrl',0,Y[5],1.25],['win',1.25,Y[5],1.25],['alt',2.5,Y[5],1.25],['space',3.75,Y[5],6.25],
     ['ralt',10,Y[5],1.25],['rwin',11.25,Y[5],1.25],['application',12.5,Y[5],1.25],['rctrl',13.75,Y[5],1.25]],
    row(5,15.25,['left','down','right']),
    row(1,18.5,['numlock','numpadslash','numpadasterisk','numpadminus']),
    row(2,18.5,['numpad7','numpad8','numpad9']), [['numpadplus',21.5,Y[2],1,2]],
    row(3,18.5,['numpad4','numpad5','numpad6']),
    row(4,18.5,['numpad1','numpad2','numpad3']), [['numpadenter',21.5,Y[4],1,2]],
    [['numpad0',18.5,Y[5],2],['numpaddot',20.5,Y[5]]]);
  if(iso) k.push(['enter',13.5,Y[2],1.5,2],['nonushash',12.75,Y[3]],['shift',0,Y[4],1.25],['nonusbackslash',1.25,Y[4]]);
  else k.push(['backslash',13.5,Y[2],1.5],['enter',12.75,Y[3],2.25],['shift',0,Y[4],2.25]);
  return k;
}
// Legends: a string, or [shifted, unshifted] for a two-legend cap. Letters default to their capital.
const KB_LEGEND_US = {escape:'Esc',printscreen:'PrtSc',scrolllock:'ScrLk',pause:'Pause',insert:'Ins',home:'Home',pageup:'PgUp',
  delete:'Del',end:'End',pagedown:'PgDn',backspace:'Backspace',tab:'Tab',capslock:'Caps Lock',enter:'Enter',space:'',
  ctrl:'Ctrl',shift:'Shift',alt:'Alt',win:'Win',rctrl:'Ctrl',rshift:'Shift',ralt:'Alt',rwin:'Win',application:'Menu',
  up:'↑',down:'↓',left:'←',right:'→',
  grave:['~','`'],1:['!','1'],2:['@','2'],3:['#','3'],4:['$','4'],5:['%','5'],6:['^','6'],7:['&','7'],8:['*','8'],9:['(','9'],0:[')','0'],
  minus:['_','-'],equal:['+','='],leftbracket:['{','['],rightbracket:['}',']'],backslash:['|','\\'],
  semicolon:[':',';'],quote:['"',"'"],comma:['<',','],dot:['>','.'],slash:['?','/'],nonushash:['~','#'],nonusbackslash:['|','\\']};
for(let i=1;i<=12;i++) KB_LEGEND_US['f'+i]='F'+i;
for(let i=0;i<10;i++) KB_LEGEND_US['numpad'+i]=String(i);
Object.assign(KB_LEGEND_US,{numlock:'Num',numpadslash:'/',numpadasterisk:'*',numpadminus:'−',numpadplus:'+',numpadenter:'Enter',numpaddot:'.'});
// Shorter legends used when the board is drawn narrow (phones).
const KB_SHORT = {printscreen:'PS',scrolllock:'SL',pause:'Pa',insert:'In',home:'Hm',pageup:'PU',delete:'De',end:'En',pagedown:'PD',
  backspace:'⌫',tab:'⇥',capslock:'Cap',enter:'⏎',numpadenter:'⏎',numlock:'NL',shift:'⇧',rshift:'⇧',ctrl:'Ct',rctrl:'Ct',alt:'Al',ralt:'Al',win:'Wi',rwin:'Wi',application:'☰'};
// Add a layout here (e.g. de / fr) with its own legend overrides; `match` tests the browser language.
const KB_LAYOUTS = {
  us:{name:'US (ANSI)', iso:false, match:null, legend:{}},
  uk:{name:'UK (ISO)', iso:true, match:/^en-(gb|uk|ie)\b/i,
    legend:{grave:['¬','`'],2:['"','2'],3:['£','3'],quote:['@',"'"],nonushash:['~','#'],nonusbackslash:['|','\\'],ralt:'AltGr'}},
};
const KB_PREF = 'ch57x-configurator-kblayout';   // 'auto' (default) | a KB_LAYOUTS id
function detectKbLayout(){
  const langs=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'']);
  const lang=String(langs[0]||'');
  return Object.keys(KB_LAYOUTS).find(id=>KB_LAYOUTS[id].match&&KB_LAYOUTS[id].match.test(lang))||'us';
}
let kbPref='auto';
try{ const v=localStorage.getItem(KB_PREF); if(v==='auto'||KB_LAYOUTS[v]) kbPref=v; }catch(e){}
const kbLayoutId = () => kbPref==='auto' ? detectKbLayout() : kbPref;
function kbLegend(name,lay){ const l=lay.legend[name]!==undefined?lay.legend[name]:KB_LEGEND_US[name]; return l!==undefined?l:name.toUpperCase(); }
function buildBoard(){
  const lay=KB_LAYOUTS[kbLayoutId()];
  const board=$('kbBoard'); board.replaceChildren(); board.className='kb'+(lay.iso?' iso':' ansi');
  board.setAttribute('aria-label','Keyboard, '+lay.name+' layout');
  const geo=kbGeometry(lay.iso), onBoard=new Set();
  geo.forEach(([name,x,y,w=1,hgt=1])=>{
    const isMod=MOD_ORDER.includes(name), leg=kbLegend(name,lay);
    const legs=Array.isArray(leg)?[h('span',{class:'top',text:leg[0]}),h('span',{class:'bot',text:leg[1]})]
      : KB_SHORT[name]&&leg ? [h('span',{class:'one long',text:leg}),h('span',{class:'one short',text:name==='ralt'&&leg==='AltGr'?'AG':KB_SHORT[name]})]
      : [h('span',{class:'one',text:leg})];
    const props={type:'button',class:'kcap'+(isMod?' mod':'')+(w>=1.5?' wide':''),title:name,'aria-label':name};
    if(isMod){ props['data-mod']=name; props['aria-pressed']=String(chips.has(name)); props.title=name+' — applies to the next keycode you click'; }
    else { props['data-key']=name; onBoard.add(name); }
    const b=h('button',props,...legs);
    b.addEventListener('click',isMod?()=>toggleMod(name):()=>assignKey(name));
    // position in key units; CSS turns them into percentages of --kbw (the board drops the numpad on phones)
    const pos=h('div',{class:'kpos'+(name==='enter'&&lay.iso?' isoenter':'')+(x>=KB_NUMPAD_X?' np':''),
      style:'--x:'+x+';--y:'+y+';--w:'+w+';--h:'+hgt},b);
    board.append(pos);
  });
  // phones: the same numpad keycodes as a flat list (CSS shows it only when the board's numpad is hidden)
  const np=$('kbNumpad'); np.replaceChildren(group('Numpad',['numlock','numpad0','numpad1','numpad2','numpad3','numpad4','numpad5','numpad6','numpad7','numpad8','numpad9','numpadslash','numpadasterisk','numpadminus','numpadplus','numpadenter','numpaddot'].map(n=>{
    const l=kbLegend(n,lay); return pcap(n==='numlock'?'NumLk':l,n,()=>assignKey(n),n.length>8&&n!=='numpadminus'?'wide':'',n); })));
  // keycodes this layout has no key for (e.g. ANSI backslash on ISO, the ISO keys on ANSI) stay reachable
  const extra=$('kbExtra'); extra.replaceChildren();
  const missing=['backslash','nonushash','nonusbackslash','numpadequal'].filter(n=>!onBoard.has(n));
  const xlabel={backslash:'ANSI \\',nonushash:'ISO #',nonusbackslash:'ISO \\|',numpadequal:'Numpad ='};
  if(missing.length) extra.append(group('Not on a '+lay.name+' keyboard',missing.map(n=>pcap(xlabel[n],n,()=>assignKey(n),'wide',n))));
  $('kbLayout').querySelector('option[value="auto"]').textContent='Auto — '+KB_LAYOUTS[detectKbLayout()].name;
  $('kbLayout').value=kbPref;
}
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
    b.addEventListener('click',()=>toggleMod(m));
    mc.append(b);
  });
  $('kbLayout').append(h('option',{value:'auto',text:'Auto'}),...Object.entries(KB_LAYOUTS).map(([id,l])=>h('option',{value:id,text:l.name})));
  buildBoard();
  $('kbLayout').addEventListener('change',()=>{ kbPref=$('kbLayout').value; try{ localStorage.setItem(KB_PREF,kbPref); }catch(e){} buildBoard(); });
  const basic=$('kbGroups');
  KEYGROUPS.forEach(([title,keys])=>basic.append(group(title,keys.map(k=>
    pcap(k.toUpperCase(),k,()=>assignKey(k),k.length>3?'wide':'',k)))));
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
  $('modRow').hidden = n!=='mouse';   // the Basic tab's keyboard has its own modifier keys
}
function toggleMod(m){ chips.has(m)?chips.delete(m):chips.add(m); syncMods(); }
function syncMods(){
  document.querySelectorAll('button[data-mod]').forEach(b=>b.setAttribute('aria-pressed',String(chips.has(b.dataset.mod))));
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
  // delegated, so links added later (the "see Help" in key warnings) open the drawer too; the browser then scrolls to the anchor
  document.addEventListener('click',e=>{ if(e.target.closest&&e.target.closest('#helpLink,.helpjump')) $('help').open=true; });
}

// ----- confirmation dialog: replaces window.confirm (themed; Esc or a click outside = cancel, Enter = OK) -----
let confirmDone=null, confirmDownOutside=null;
function askConfirm(message,{title='Are you sure?',ok='OK',danger=false}={}){
  if(confirmDone) confirmDone(false);
  confirmDownOutside=null;
  const dlg=$('confirmDlg'), okb=$('confirmOk'), back=document.activeElement;
  $('confirmTitle').textContent=title; $('confirmMsg').textContent=message;
  okb.textContent=ok; okb.className=danger?'danger':'primary';
  dlg.hidden=false; document.body.classList.add('modal-open'); okb.focus();
  return new Promise(res=>{ confirmDone=v=>{
    confirmDone=null; dlg.hidden=true; document.body.classList.remove('modal-open');
    if(back&&back.focus&&document.contains(back)) back.focus();
    res(v);
  }; });
}
$('confirmOk').addEventListener('click',()=>confirmDone&&confirmDone(true));
$('confirmCancel').addEventListener('click',()=>confirmDone&&confirmDone(false));
// outside = the faded backdrop; a drag that starts inside the box and ends outside does not cancel
$('confirmDlg').addEventListener('mousedown',e=>{ confirmDownOutside = e.target===$('confirmDlg'); });
$('confirmDlg').addEventListener('click',e=>{ if(e.target===$('confirmDlg')&&confirmDownOutside!==false&&confirmDone) confirmDone(false); confirmDownOutside=null; });
document.addEventListener('keydown',e=>{
  if(!confirmDone) return;
  if(e.key==='Escape'){ e.preventDefault(); confirmDone(false); }
  else if(e.key==='Enter'){ e.preventDefault(); confirmDone(document.activeElement!==$('confirmCancel')); }   // Enter on a focused Cancel still cancels
  else if(e.key==='Tab'){   // keep focus inside the dialog
    const btns=[$('confirmCancel'),$('confirmOk')], i=btns.indexOf(document.activeElement);
    e.preventDefault(); btns[(i+(e.shiftKey?btns.length-1:1))%btns.length].focus();
  }
},true);

// ----- events -----
function rebuildFromSettings(){
  if($('orientation').value!==state.orientation){   // keys and knobs keep their physical position; the selection follows
    const m=reorient(state,$('orientation').value);
    if(sel.t==='b'){ const [r,c]=m.button(sel.r,sel.c)||[0,0]; sel={t:'b',r,c}; }
    else sel={...sel,k:m.knob(sel.k)};
  }
  state.rows=$('rows').value; state.columns=$('columns').value; state.knobs=$('knobs').value;
  normalizeState(state); clampSel(); renderAll(); save();
}
['orientation','rows','columns','knobs'].forEach(id=>$(id).addEventListener('change',rebuildFromSettings));
$('action').addEventListener('input',e=>{ setVal(sel,e.target.value); onActionChanged(); });
$('note').addEventListener('input',e=>{ setNote(sel,e.target.value); renderDevice(); renderYaml(); save(); });
$('showNotes').addEventListener('change',e=>{ showNotes=e.target.checked; saveNotesPref(); renderDevice(); });
function applyZoom(){
  $('device').style.setProperty('--zoom', zoomPct/100);
  $('zoomReset').textContent=zoomPct+'%';
  $('zoomOut').disabled=zoomPct<=ZOOM_MIN; $('zoomIn').disabled=zoomPct>=ZOOM_MAX;
}
function setZoom(pct){
  zoomPct=Math.min(ZOOM_MAX,Math.max(ZOOM_MIN,pct)); applyZoom();
  try{ localStorage.setItem(ZOOM_PREF, String(zoomPct)); }catch(e){}
}
$('zoomIn').addEventListener('click',()=>setZoom(zoomPct+ZOOM_STEP));
$('zoomOut').addEventListener('click',()=>setZoom(zoomPct-ZOOM_STEP));
$('zoomReset').addEventListener('click',()=>setZoom(100));
// Ctrl/Cmd + wheel over the keypad zooms the keypad instead of the page
document.querySelector('.case').addEventListener('wheel',e=>{
  if(!(e.ctrlKey||e.metaKey) || !e.deltaY) return;
  e.preventDefault(); setZoom(zoomPct+(e.deltaY<0?ZOOM_STEP:-ZOOM_STEP));
},{passive:false});
applyZoom();
// Clear empties the action and its comment; it asks only when there is something to lose.
$('btnClear').addEventListener('click',async()=>{
  const v=getVal(sel).trim(), n=getNote(sel).trim();
  if((v||n) && !await askConfirm('Layer '+(layerIdx+1)+' · '+selLabel(sel)+': '+(v?'"'+v+'"':'comment "'+n+'"'),
    {title:'Clear this key?',ok:'Clear',danger:true})) return;
  setVal(sel,''); setNote(sel,''); $('action').value=''; $('note').value=''; onActionChanged(); $('action').focus();
});
wirePalette();
// The delay button toggles between "Apply delay option" and "Remove delay option" depending on the selected action.
const DELAY_RE=/^\s*\{\s*delay\(\s*(\d+)\s*\)\s*\}\s*/;
function syncDelayUi(){
  const m=getVal(sel).match(DELAY_RE), btn=$('btnDelay'), inp=$('delay');
  if(m){ btn.textContent='Remove delay option'; inp.value=m[1]; inp.disabled=true; }
  else { btn.textContent='Apply delay option'; inp.disabled=false; }
}
$('btnDelay').addEventListener('click',()=>{
  const cur=getVal(sel);
  if(DELAY_RE.test(cur)){
    setVal(sel,cur.replace(DELAY_RE,''));
  } else {
    const ms=$('delay').value.trim();
    if(cur.trim()===''){ toast('Enter an action first'); return; }
    if(!/^\d+$/.test(ms)){ toast('Enter a delay in milliseconds first'); $('delay').focus(); return; }
    setVal(sel,'{delay('+parseInt(ms,10)+')}'+cur.trim());
  }
  $('action').value=getVal(sel); onActionChanged();
});
const DISCARD_MSG='This replaces the current mapping on all layers. Use Save config first if you want to keep it.';
// Save config reuses the name of the file last loaded, and its line endings (the user's files are CRLF).
let cfgName='mapping.yaml', cfgCrlf=false;
$('btnLoad').addEventListener('click',async()=>{
  if(!await askConfirm(DISCARD_MSG,{title:'Load a config file?',ok:'Choose file',danger:true})) return;
  $('fileIn').click();   // the OK click still counts as the user gesture the file picker needs
});
$('btnSave').addEventListener('click',async()=>{
  if(!await askConfirm('Downloads the mapping on all layers as "'+cfgName+'".',
    {title:'Save the config file?',ok:'Save'})) return;
  const text=$('yamlOut').value.replace(/\r?\n/g,cfgCrlf?'\r\n':'\n');
  const a=h('a',{href:URL.createObjectURL(new Blob([text],{type:'text/yaml'})),download:cfgName});
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
  toast('Saved '+cfgName);
});
$('btnBlank').addEventListener('click',async()=>{
  if(!await askConfirm(DISCARD_MSG,{title:'Start with a blank mapping?',ok:'Start blank',danger:true})) return;
  state=normalizeState({model:'ch57x-2',orientation:'normal',rows:3,columns:4,knobs:2,layers:[]});
  layerIdx=0; sel={t:'b',r:0,c:0}; cfgName='mapping.yaml'; cfgCrlf=false; renderAll(); save();
});
function loadText(text, okMsg){
  try{
    const obj=parseYaml(text), extra=Array.isArray(obj&&obj.layers)?obj.layers.length-LAYER_COUNT:0;
    state=fromObj(obj); layerIdx=0; sel={t:'b',r:0,c:0};
    // A file that documents its keys is more useful with the comments showing, so turn that view on.
    const n=countNotes(state); if(n && !showNotes){ showNotes=true; saveNotesPref(); }
    const u=state.unmatchedNotes||0;
    renderAll(); save(); toast((okMsg||'Loaded')+(n?' · '+n+' comment'+(n>1?'s':'')+' on keys':'')
      +(u?' · '+u+' comment line'+(u>1?'s':'')+' matched no key (skipped)':'')
      +(extra>0?' · only the first '+LAYER_COUNT+' layers kept':''));
    return true;
  }catch(e){ toast('Import failed: '+e.message); return false; }
}
$('btnImport').addEventListener('click',()=>{ const t=$('yamlIn').value; if(t.trim()) loadText(t,'Imported YAML'); else toast('Paste some YAML first'); });
$('fileIn').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{ const t=String(rd.result); if(loadText(t,'Loaded '+f.name)){ cfgName=f.name; cfgCrlf=/\r\n/.test(t); } };
  rd.readAsText(f);
  e.target.value='';
});
$('btnCopy').addEventListener('click',async()=>{
  const text=$('yamlOut').value;
  try{ await navigator.clipboard.writeText(text); toast('YAML copied'); }
  catch(e){ $('yamlOut').select(); try{ document.execCommand('copy'); toast('YAML copied'); }catch(_){ toast('Select and copy manually'); } }
});

// ----- direct upload (WebHID) -----
const HID_FILTERS = DEVICES.map(d=>({vendorId:d.vid,productId:d.pid}));
let hidDev = null, hidDeviceInfo = null, hidBusy = false;
const isCfgDev = d => d.collections.some(c=>c.outputReports && c.outputReports.some(r=>r.reportId===3));
const hex = bytes => bytes.map(b=>(b&0xff).toString(16).padStart(2,'0')).join(' ');
function hidSay(kind,text){ const b=$('hidStatus'); b.replaceChildren(h('span',{class:kind,text})); }
// Follows the current layout: 514c:8850 is the 4x4 pad for a 16-button layout and the 12-key/4-knob pad otherwise.
function hidFamily(){ return hidDev ? resolveFamily(hidDev.vendorId,hidDev.productId,state) : null; }
const famName = f => f+(FAMILY_LABEL[f]&&FAMILY_LABEL[f]!==f ? ' ('+FAMILY_LABEL[f]+')' : '');
function hidSync(){
  const on=!!hidDev && !hidBusy;
  $('hidInfo').disabled = !on || !['884x','884x-514c'].includes(hidFamily());
  $('hidUpload').disabled = !on;
  $('hidConnect').disabled = hidBusy;
}
function hidWhich(){ const v=$('hidLayers').value; return v==='all' ? 'all' : Math.min(parseInt(v,10)||0, state.layers.length-1); }   // 'all' or a layer index
// First blocking problem, spelled out, so the status line says what to fix rather than just that something is wrong.
const planErrorText = plan => plan.errors[0]+(plan.errors.length>1 ? ' (+'+(plan.errors.length-1)+' more, see list)' : '');
function showPlan(plan){
  const ta=$('hidPlan'); ta.hidden=false;
  const lines=[];
  plan.errors.forEach(e=>lines.push('ERROR  '+e));
  plan.warnings.forEach(w=>lines.push('WARN   '+w));
  plan.packets.forEach(p=>{ if(p.desc) lines.push('# '+p.desc); lines.push('  '+hex(p.bytes)); });
  ta.value=lines.join('\n') || '(nothing to send)';
}
function readDeviceInfo(dev){
  return new Promise((resolve,reject)=>{
    const to=setTimeout(()=>{ dev.removeEventListener('inputreport',on); reject(new Error('The keyboard did not answer')); },1500);
    const on=e=>{
      const d=new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength);
      if(d[0]===0xfb){ clearTimeout(to); dev.removeEventListener('inputreport',on); resolve({buttons:d[1],encoders:d[2]}); }
    };
    dev.addEventListener('inputreport',on);
    dev.sendReport(3,makeReport([0xfb,0xfb,0xfb])).catch(err=>{ clearTimeout(to); dev.removeEventListener('inputreport',on); reject(err); });
  });
}
async function hidConnect(){
  if(!navigator.hid){ hidSay('err','WebHID is not available in this browser. Use Chrome or Edge on desktop, or the command-line tool (see Help).'); return; }
  try{
    let devs=(await navigator.hid.getDevices()).filter(d=>HID_FILTERS.some(f=>f.vendorId===d.vendorId&&f.productId===d.productId)&&isCfgDev(d));
    if(!devs.length) devs=(await navigator.hid.requestDevice({filters:HID_FILTERS})).filter(isCfgDev);
    if(!devs.length){
      hidSay('err','No configuration interface found. In the chooser, pick the keyboard entry that exposes it (try each), and on Linux make sure a udev rule grants your user access to the hidraw device.');
      return;
    }
    hidDev=devs[0]; hidDeviceInfo=null;
    if(!hidDev.opened) await hidDev.open();
    const fam=hidFamily();
    const di=deviceInfo(hidDev.vendorId,hidDev.productId);
    if(di){ // keep the exported YAML's `model:` consistent with the connected device (same table as the original CLI)
      state.model=di.model; renderYaml(); save();
    }
    hidSay('ok','Connected: '+hidDev.vendorId.toString(16)+':'+hidDev.productId.toString(16)+' '+(hidDev.productName||'')+' · '+(di?di.model+' · protocol '+famName(fam):'unknown'));
    if(!fam){ hidSay('err','Product 0x'+hidDev.productId.toString(16)+' is not a known family; upload is disabled.'); hidDev=null; }
  }catch(e){ hidSay('err','Could not connect: '+e.message); hidDev=null; }
  hidSync(); renderMsg();
}
$('hidConnect').addEventListener('click',hidConnect);
if(navigator.hid){
  navigator.hid.addEventListener('disconnect',e=>{
    if(e.device===hidDev){ hidDev=null; hidDeviceInfo=null; hidSync(); renderMsg(); hidSay('warn','Keyboard disconnected.'); }
  });
}else{ hidSay('warn','WebHID is not available in this browser — use Chrome or Edge on desktop, or the command-line tool (see Help).'); }
$('hidInfo').addEventListener('click',async()=>{
  if(!hidDev) return; hidBusy=true; hidSync();
  try{
    hidDeviceInfo=await readDeviceInfo(hidDev);
    const want=state.rows*state.columns;
    const mismatch=(hidDeviceInfo.buttons&&hidDeviceInfo.buttons!==want)||hidDeviceInfo.encoders!==state.knobs;
    hidSay(mismatch?'warn':'ok','Device reports '+hidDeviceInfo.buttons+' buttons and '+hidDeviceInfo.encoders+' knobs'+
      (mismatch?' — your layout is '+want+' buttons and '+state.knobs+' knobs.':'.'));
  }catch(e){ hidSay('err','Could not read device info: '+e.message); }
  hidBusy=false; hidSync();
});
$('hidPreview').addEventListener('click',()=>{
  const fam=hidFamily()||'884x';
  const plan=planUpload(state,fam,hidWhich());
  showPlan(plan);
  hidSay(plan.errors.length?'err':plan.warnings.length?'warn':'ok',
    plan.errors.length ? 'Cannot upload — '+planErrorText(plan)
      : plan.items+' binding(s), '+plan.packets.length+' packet(s)'+(plan.skipped?', '+plan.skipped+' empty skipped':'')+
        (plan.warnings.length?', '+plan.warnings.length+' warning(s) (see list)':'')+' — protocol '+famName(fam)+(hidDev?'':' (no keyboard connected; showing 884x)'));
});
$('hidUpload').addEventListener('click',async()=>{
  if(!hidDev||hidBusy) return;
  const plan=planUpload(state,hidFamily(),hidWhich());
  showPlan(plan);
  if(plan.errors.length){ hidSay('err','Cannot upload — '+planErrorText(plan)+'. Fix '+(plan.errors.length>1?'these':'this')+' first.'); return; }
  if(!plan.items){ hidSay('warn','Nothing to upload: every action is empty.'); return; }
  const warns=plan.warnings.slice();
  if(hidDeviceInfo &&((hidDeviceInfo.buttons&&hidDeviceInfo.buttons!==state.rows*state.columns)||hidDeviceInfo.encoders!==state.knobs))
    warns.push('Your layout ('+state.rows*state.columns+' buttons, '+state.knobs+' knobs) differs from what the keyboard reports ('+hidDeviceInfo.buttons+' buttons, '+hidDeviceInfo.encoders+' knobs).');
  const msg='Write '+plan.items+' binding(s) ('+plan.packets.length+' packets, protocol '+famName(hidFamily())+') to the keyboard, replacing those keys on '+
    (hidWhich()==='all'?'all '+state.layers.length+' layers':'layer '+(hidWhich()+1))+'.'+(warns.length?'\n\n'+warns.join('\n\n'):'');
  if(!await askConfirm(msg,{title:'Upload to the keyboard?',ok:'Upload'})) return;
  if(!hidDev||hidBusy) return;   // unplugged or another upload started while the dialog was open
  hidBusy=true; hidSync();
  try{
    for(let i=0;i<plan.packets.length;i++){
      await hidDev.sendReport(3,makeReport(plan.packets[i].bytes));
      if(i%5===0||i===plan.packets.length-1) hidSay('ok','Sending… '+(i+1)+' / '+plan.packets.length);
    }
    hidSay('ok','Uploaded '+plan.items+' binding(s). If a key still behaves oddly, replug the keyboard and test again.');
    toast('Uploaded to keyboard');
  }catch(e){ hidSay('err','Upload failed after partial write: '+e.message+'. Reconnect and try again.'); }
  hidBusy=false; hidSync();
});
hidSync();

// ----- init -----
buildControls();
state = loadSaved() || fromObj(parseYaml(EXAMPLE));
clampSel(); renderAll();
