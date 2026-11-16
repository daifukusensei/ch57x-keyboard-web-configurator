// ---------- UI ----------
const $ = id => document.getElementById(id);
const STORE = 'ch57x-editor-v1';
const MOD_ORDER = ['ctrl','shift','alt','win','rctrl','rshift','ralt','rwin'];
const chips = new Set();
let state, layerIdx = 0, sel = {t:'b',r:0,c:0};
// "Show comments on keys" is a per-viewer preference (it is not part of the mapping).
const NOTES_PREF = 'ch57x-editor-notes';
let showNotes = false;
try{ showNotes = localStorage.getItem(NOTES_PREF)==='1'; }catch(e){}
function saveNotesPref(){ try{ localStorage.setItem(NOTES_PREF, showNotes?'1':'0'); }catch(e){} }

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
// per-key comments (written to the YAML as "# ..." comments, which the tool ignores)
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
  const tools=h('div',{class:'layertools'});
  tools.append(h('button',{type:'button',class:'tool',title:'Add layer (most boards have 3)','aria-label':'Add layer',text:'+',onclick:()=>{
    state.layers.push(blankLayer(state)); layerIdx=state.layers.length-1; renderAll(); save();}}));
  tools.append(h('button',{type:'button',class:'tool',title:'Duplicate this layer','aria-label':'Duplicate layer',text:'⧉',onclick:()=>{
    state.layers.splice(layerIdx+1,0,JSON.parse(JSON.stringify(layer()))); layerIdx++; renderAll(); save();}}));
  const rm=h('button',{type:'button',class:'tool',title:'Remove this layer','aria-label':'Remove layer',text:'−',onclick:()=>{
    if(state.layers.length<2) return; state.layers.splice(layerIdx,1); layerIdx=Math.max(0,layerIdx-1); renderAll(); save();}});
  rm.disabled = state.layers.length<2;
  tools.append(rm);
  box.append(tools);
}
function cellEl(t,val,label,extra){
  const v=validateAction(val);
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
  const grid=h('div',{class:'grid'}); grid.style.gridTemplateColumns='repeat('+C+',var(--cw,70px))';
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
  const v=validateAction(getVal(sel)); const box=$('actionMsg'); box.replaceChildren();
  if(v.kind==='empty'){ box.append(h('span',{class:'hint',text:'Empty — pick or type an action.'})); return; }
  if(v.level==='ok') box.append(h('span',{class:'ok',text:'✓ Valid '+v.kind+' action'}));
  v.msgs.forEach(m=>box.append(h('div',{class:v.level==='error'?'err':'warn',text:(v.level==='error'?'✗ ':'⚠ ')+m})));
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
    const chk=(val,label)=>{ const v=validateAction(val);
      if(v.kind==='empty'){empty++;return;}
      if(v.level!=='ok') v.msgs.forEach(m=>issues.push({level:v.level,text:'Layer '+(li+1)+', '+label+': '+m})); };
    l.buttons.forEach((row,r)=>row.forEach((val,c)=>chk(val,'R'+(r+1)+' C'+(c+1))));
    l.knobs.forEach((k,n)=>['ccw','press','cw'].forEach(p=>chk(k[p],'knob '+(n+1)+' '+p)));
  });
  return {issues,empty};
}
function renderYaml(){
  $('yamlOut').value=toYaml(state);
  const {issues,empty}=collectIssues();
  const box=$('summary'); box.replaceChildren();
  const errs=issues.filter(i=>i.level==='error').length, warns=issues.length-errs;
  box.append(h('span',{class:errs?'err':warns?'warn':'ok',
    text:errs?errs+' error'+(errs>1?'s':'')+(warns?', '+warns+' warning'+(warns>1?'s':''):''):
         warns?warns+' warning'+(warns>1?'s':''):'No problems found'}));
  if(empty) box.append(h('span',{class:'hint',text:' · '+empty+' empty action'+(empty>1?'s':'')}));
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

// ----- events -----
function rebuildFromSettings(){
  state.orientation=$('orientation').value;
  state.rows=$('rows').value; state.columns=$('columns').value; state.knobs=$('knobs').value;
  normalizeState(state); clampSel(); renderAll(); save();
}
['orientation','rows','columns','knobs'].forEach(id=>$(id).addEventListener('change',rebuildFromSettings));
$('action').addEventListener('input',e=>{ setVal(sel,e.target.value); onActionChanged(); });
$('note').addEventListener('input',e=>{ setNote(sel,e.target.value); renderDevice(); renderYaml(); save(); });
$('showNotes').addEventListener('change',e=>{ showNotes=e.target.checked; saveNotesPref(); renderDevice(); });
$('btnClear').addEventListener('click',()=>{
  if(getVal(sel).trim()!=='' && !confirm('Clear this action?')) return;
  setVal(sel,''); $('action').value=''; onActionChanged(); $('action').focus();
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
$('btnExample').addEventListener('click',()=>{
  if(!confirm('Discard the current mapping and load the repo example?')) return;
  loadText(EXAMPLE,'Loaded repo example');
});
$('btnBlank').addEventListener('click',()=>{
  if(!confirm('Discard the current mapping and start blank?')) return;
  state=normalizeState({model:'ch57x-2',orientation:'normal',rows:3,columns:4,knobs:2,layers:[]});
  layerIdx=0; sel={t:'b',r:0,c:0}; renderAll(); save();
});
function loadText(text, okMsg){
  try{
    state=fromObj(parseYaml(text)); layerIdx=0; sel={t:'b',r:0,c:0};
    // A file that documents its keys is more useful with the comments showing, so turn that view on.
    const n=countNotes(state); if(n && !showNotes){ showNotes=true; saveNotesPref(); }
    renderAll(); save(); toast((okMsg||'Loaded')+(n?' · '+n+' comment'+(n>1?'s':'')+' on keys':''));
  }catch(e){ toast('Import failed: '+e.message); }
}
$('btnImport').addEventListener('click',()=>{ const t=$('yamlIn').value; if(t.trim()) loadText(t,'Imported YAML'); else toast('Paste some YAML first'); });
$('fileIn').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader(); rd.onload=()=>loadText(String(rd.result),'Loaded '+f.name); rd.readAsText(f);
  e.target.value='';
});
$('btnCopy').addEventListener('click',async()=>{
  const text=$('yamlOut').value;
  try{ await navigator.clipboard.writeText(text); toast('YAML copied'); }
  catch(e){ $('yamlOut').select(); try{ document.execCommand('copy'); toast('YAML copied'); }catch(_){ toast('Select and copy manually'); } }
});
$('btnDownload').addEventListener('click',()=>{
  const blob=new Blob([$('yamlOut').value],{type:'text/yaml'});
  const a=h('a',{href:URL.createObjectURL(blob),download:'mapping.yaml'});
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
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
function hidWhich(){ return $('hidLayers').value==='all' ? 'all' : layerIdx; }
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
  if(!navigator.hid){ hidSay('err','WebHID is not available in this browser. Use Chrome or Edge on desktop, or the CLI script below.'); return; }
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
    hidSay('ok','Connected: '+hidDev.vendorId.toString(16)+':'+hidDev.productId.toString(16)+' '+(hidDev.productName||'')+' · '+(di?di.model+' · protocol '+famName(fam)+(di.pid===0x8850&&di.vid===0x514c?' — chosen from your layout':''):'unknown'));
    if(!fam){ hidSay('err','Product 0x'+hidDev.productId.toString(16)+' is not a known family; upload is disabled.'); hidDev=null; }
  }catch(e){ hidSay('err','Could not connect: '+e.message); hidDev=null; }
  hidSync(); renderMsg();
}
$('hidConnect').addEventListener('click',hidConnect);
if(navigator.hid){
  navigator.hid.addEventListener('disconnect',e=>{
    if(e.device===hidDev){ hidDev=null; hidDeviceInfo=null; hidSync(); renderMsg(); hidSay('warn','Keyboard disconnected.'); }
  });
}else{ hidSay('warn','WebHID is not available in this browser — use Chrome or Edge on desktop, or the CLI script below.'); }
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
    ($('hidLayers').value==='all'?'all '+state.layers.length+' layer(s)':'layer '+(layerIdx+1))+'?'+(warns.length?'\n\n'+warns.join('\n\n'):'');
  if(!confirm(msg)) return;
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

// ----- upload script -----
function upDefaults(){
  const win = $('upOs').value==='ps1';
  $('upTool').value = win ? '.\\ch57x-keyboard-tool.exe' : './ch57x-keyboard-tool';
  $('upSudoWrap').style.display = win ? 'none' : '';
}
$('upOs').value = /win/i.test(navigator.platform||'') ? 'ps1' : 'sh';
$('upOs').addEventListener('change',upDefaults); upDefaults();
function buildScript(){
  const {issues}=collectIssues();
  const errs=issues.filter(i=>i.level==='error').length;
  if(errs && !confirm(errs+' action(s) are invalid. Generate the script anyway? (validate will stop the upload if the tool rejects them.)')) return null;
  try{ return makeUploadScript(toYaml(state), $('upOs').value, $('upTool').value.trim()||'ch57x-keyboard-tool', $('upSudo').checked); }
  catch(e){ toast(e.message); return null; }
}
$('btnUpScript').addEventListener('click',()=>{
  const s=buildScript(); if(s==null) return;
  const ext=$('upOs').value, blob=new Blob([s],{type:'text/plain'});
  const a=h('a',{href:URL.createObjectURL(blob),download:'upload-ch57x.'+ext});
  document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
});
$('btnUpCopy').addEventListener('click',async()=>{
  const s=buildScript(); if(s==null) return;
  try{ await navigator.clipboard.writeText(s); toast('Script copied'); } catch(e){ toast('Copy failed — use Download'); }
});

// ----- init -----
buildControls();
state = loadSaved() || fromObj(parseYaml(EXAMPLE));
clampSel(); renderAll();
