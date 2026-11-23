// ---------- Core logic (no DOM) ----------
const ORIENTATIONS = ['normal','upsidedown','clockwise','counterclockwise'];
const LAYER_COUNT = 3;   // every CH57x board has exactly 3 layers
const MODS_KB = {ctrl:1,rctrl:1,shift:1,rshift:1,alt:1,opt:1,ralt:1,ropt:1,win:1,cmd:1,rwin:1,rcmd:1};
const MODS_MOUSE = {ctrl:1,shift:1,alt:1};
const MEDIA = ['screenbrightnessup','screenbrightnessdown','next','previous','prev','stop','play','mute',
  'volumeup','volumedown','favorites','calculator','screenlock','webpagehome','webpageback','webpageforward'];
// The tool only knows key *names*; a typed symbol gets a hint with the name to use instead (shifted ones as on a US layout).
// "," and "-" are not listed: they separate chords and modifiers, so they never reach the key check on their own.
const CHAR_KEYS = {';':'semicolon',"'":'quote','.':'dot','/':'slash','=':'equal','[':'leftbracket',']':'rightbracket',
  '\\':'backslash','`':'grave',':':'shift-semicolon','"':'shift-quote','<':'shift-comma','>':'shift-dot','?':'shift-slash',
  '+':'shift-equal','_':'shift-minus','{':'shift-leftbracket','}':'shift-rightbracket','|':'shift-backslash','~':'shift-grave',
  '!':'shift-1','@':'shift-2','#':'shift-3','$':'shift-4','%':'shift-5','^':'shift-6','&':'shift-7','*':'shift-8','(':'shift-9',')':'shift-0'};
const KNOWN_KEYS = new Set();   // filled below from the full key table (lowercase, as in the original tool)
const BTN = '(?:left|right|middle)(?:\\+(?:left|right|middle))*';
const NUM = '-?\\d+';

function splitTop(s, sep){
  const out=[]; let d=0, cur='';
  for(const ch of s){
    if(ch==='(') d++; else if(ch===')') d--;
    if(ch===sep && d===0){ out.push(cur); cur=''; } else cur+=ch;
  }
  out.push(cur); return out;
}
function splitDash(s){
  const out=[]; let d=0, cur='';
  for(const ch of s){
    if(ch==='(') d++; else if(ch===')') d--;
    if(ch==='-' && d===0 && cur!==''){ out.push(cur); cur=''; } else cur+=ch;
  }
  out.push(cur); return out;
}
function inRange(vals){ return vals.every(v=>{const n=parseInt(v,10);return n>=-127&&n<=127;}); }

// Returns null if token is not a mouse action, else {kind, error?}
function mouseParse(tok){
  let m;
  if(/^(click|rclick|mclick)(\+(click|rclick|mclick))*$/.test(tok)) return {kind:'click'};
  if(new RegExp('^click\\(\\s*'+BTN+'\\s*\\)$').test(tok)) return {kind:'click'};
  const chk=(kind,vals)=> inRange(vals)?{kind}:{kind,error:'Value out of range (-127 to 127)'};
  if((m=tok.match(new RegExp('^move\\(\\s*('+NUM+')\\s*,\\s*('+NUM+')\\s*\\)$')))) return chk('move',[m[1],m[2]]);
  if((m=tok.match(new RegExp('^drag\\(\\s*('+BTN+')\\s*,\\s*('+NUM+')\\s*,\\s*('+NUM+')\\s*\\)$')))) return chk('drag',[m[2],m[3]]);
  if((m=tok.match(new RegExp('^wheel\\(\\s*('+NUM+')\\s*\\)$')))) return chk('wheel',[m[1]]);
  if(tok==='wheelup'||tok==='wheeldown') return {kind:'wheel'};
  if(/^(click|move|drag|wheel)$/.test(tok)) return {kind:'mouse',error:'"'+tok+'" needs arguments, e.g. '+(tok==='click'?'click(left)':tok==='move'?'move(10,0)':tok==='drag'?'drag(left,10,0)':'wheel(1)')};
  if(/^(click|rclick|mclick|move|drag|wheel)\(/.test(tok)) return {kind:'mouse',error:'Malformed mouse action "'+tok+'"'};
  return null;
}

function validateAction(raw){
  const res={level:'ok',kind:'keys',msgs:[]};
  const err=m=>{res.level='error';res.msgs.push(m);};
  const warn=m=>{if(res.level==='ok')res.level='warn';res.msgs.push(m);};
  let s=(raw==null?'':String(raw)).trim();
  if(!s){res.level='warn';res.kind='empty';res.msgs.push('Empty. It is written as "" — run validate to confirm the tool accepts that.');return res;}
  const om=s.match(/^\{([^}]*)\}(.*)$/);
  if(om){
    if(!/^\s*delay\(\s*\d+\s*\)\s*$/.test(om[1])) err('Only the {delay(<ms>)} option is supported');
    s=om[2].trim();
    if(!s){err('Option given but no keys follow');return res;}
  }
  const chords=splitTop(s,',').map(x=>x.trim());
  if(chords.length>5) err('At most 5 chords per key ('+chords.length+' given; chords are separated by commas)');
  const kinds=[];
  for(const c of chords){
    if(!c){err('Empty chord: two commas in a row, or a comma at the start or end');continue;}
    const toks=splitDash(c); const key=toks.pop(); const mods=toks;
    if(!key){err('Missing key in "'+c+'"');continue;}
    const mp=mouseParse(key);
    if(mp){
      kinds.push('mouse');
      if(mp.error) err(mp.error);
      mods.forEach(m=>{ if(!MODS_MOUSE[m]) err('Modifier "'+m+'" is not supported for mouse actions (ctrl, shift, alt only)'); });
    } else if(MEDIA.includes(key)){
      kinds.push('media');
      if(mods.length) err('Media key "'+key+'" cannot take modifiers');
    } else {
      kinds.push('keys');
      mods.forEach(m=>{ if(!MODS_KB[m]) err('Unknown modifier "'+m+'"'); });
      if(/^<\d+>$/.test(key)){ const n=parseInt(key.slice(1,-1),10); if(n>255) warn('HID code '+n+' is above 255'); }
      else if(MODS_KB[key]){ /* modifier-only chord, e.g. alt-shift */ }
      else if(CHAR_KEYS[key]) err('"'+key+'" is not a key name; use "'+CHAR_KEYS[key]+'"'+(CHAR_KEYS[key].includes('-')?' (US layout)':''));
      else if(!KNOWN_KEYS.has(key.toLowerCase())) warn('"'+key+'" is not a key name this editor recognises. Check the spelling, pick the key from the keycode palette, or see Help');
    }
  }
  const set=new Set(kinds);
  if(set.has('media') && (kinds.length>1)) err('A media key must be the only chord, with no modifiers or other keys');
  else if(set.has('mouse') && kinds.length>1) warn('Mouse actions in a sequence with other chords are untested here; run validate');
  res.kind = set.size===1 ? [...set][0] : 'mixed';
  if(om && (set.has('media')||set.has('mouse')) && kinds.length===1) warn('delay option has no effect on a single action');
  return res;
}

// Layout rule from the original tool's config.rs (render): a pad with one row or one column of buttons and exactly one knob
// can only apply modifiers to the first key of a button's sequence. Knob actions are not affected.
const isOneRowOneKnob = st => (st.rows===1||st.columns===1) && st.knobs===1;
const ONE_ROW_MSG = 'A pad with 1 row (or column) and 1 knob only takes modifiers on the first key of a sequence';
function oneRowViolation(raw){
  let m; try{ m=parseActionToMacro(raw); }catch(e){ return false; }
  return !!m && m.type==='Keyboard' && m.keyChords.slice(1).some(c=>c.modifiers.length>0);
}
// validateAction plus the checks that depend on the layout. isButton: true for a button, false for a knob action.
function checkAction(st,raw,isButton){
  const res=validateAction(raw);
  if(isButton && st && isOneRowOneKnob(st) && oneRowViolation(raw)){ res.level='error'; res.msgs.push(ONE_ROW_MSG); }
  return res;
}

// ---------- YAML (subset used by the tool) ----------
function stripComment(line){
  let q=null;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(q){ if(ch==='\\'&&q==='"') i++; else if(ch===q) q=null; }
    else if(ch==='"'||ch==="'") q=ch;
    else if(ch==='#'&&(i===0||/\s/.test(line[i-1]))) return line.slice(0,i);
  }
  return line;
}
function splitFlow(s){
  const out=[]; let cur='', q=null;
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(q){ cur+=ch; if(ch==='\\'&&q==='"'){cur+=s[++i]||'';} else if(ch===q) q=null; }
    else if(ch==='"'||ch==="'"){ q=ch; cur+=ch; }
    else if(ch===','){ out.push(cur); cur=''; }
    else cur+=ch;
  }
  if(cur.trim()!==''||out.length) out.push(cur);
  return out;
}
function parseScalar(s){
  s=s.trim();
  if(s[0]==='['&&s[s.length-1]===']'){
    const inner=s.slice(1,-1).trim();
    return inner?splitFlow(inner).map(parseScalar):[];
  }
  if(s[0]==='"'){ try{return JSON.parse(s);}catch(e){return s.slice(1,-1);} }
  if(s[0]==="'") return s.slice(1,-1).replace(/''/g,"'");
  return s;
}
function parseYaml(src){
  const lines=[], keyNotes=[];
  for(const raw of String(src).split(/\r?\n/)){
    if(/^\s*#@/.test(raw)){ keyNotes.push(parseNoteLine(raw)); continue; }   // per-key comment (null if malformed)
    const t=stripComment(raw);
    if(!t.trim()||t.trim()==='---'||t.trim()==='...') continue;
    if(/^\t/.test(t)) throw new Error('Tabs are not allowed for indentation');
    lines.push({indent:t.match(/^ */)[0].length,text:t.trim()});
  }
  let i=0;
  const isSeq=t=>t==='-'||t.startsWith('- ');
  const isKV=t=>/^[A-Za-z_][\w-]*\s*:(\s|$)/.test(t);
  function parseBlock(){ const l=lines[i]; return isSeq(l.text)?parseSeq(l.indent):parseMap(l.indent); }
  function parseSeq(indent){
    const arr=[];
    while(i<lines.length&&lines[i].indent===indent&&isSeq(lines[i].text)){
      const rest=lines[i].text.slice(1).trim();
      if(!rest){ i++; arr.push(i<lines.length&&lines[i].indent>indent?parseBlock():null); continue; }
      if(isKV(rest)){
        const off=lines[i].text.length-rest.length;
        lines[i]={indent:indent+off,text:rest};
        arr.push(parseMap(indent+off));
      } else {
        arr.push(parseScalar(rest)); i++;
      }
    }
    return arr;
  }
  function parseMap(indent){
    const obj={};
    while(i<lines.length&&lines[i].indent===indent&&isKV(lines[i].text)){
      const t=lines[i].text, idx=t.indexOf(':');
      const key=t.slice(0,idx).trim(), rest=t.slice(idx+1).trim();
      i++;
      if(rest) obj[key]=parseScalar(rest);
      else if(i<lines.length&&lines[i].indent>indent) obj[key]=parseBlock();
      else if(i<lines.length&&lines[i].indent===indent&&isSeq(lines[i].text)) obj[key]=parseSeq(indent);
      else obj[key]=null;
    }
    return obj;
  }
  if(!lines.length) throw new Error('File is empty');
  const root=parseBlock();
  if(i<lines.length) throw new Error('Could not parse near: '+lines[i].text.slice(0,40));
  if(root&&typeof root==='object') Object.defineProperty(root,'__keyNotes',{value:keyNotes});   // read by fromObj
  return root;
}

function dimsOf(st){
  return (st.orientation==='clockwise'||st.orientation==='counterclockwise')
    ? {R:st.columns,C:st.rows} : {R:st.rows,C:st.columns};
}
function blankLayer(st){
  const {R,C}=dimsOf(st);
  return {buttons:Array.from({length:R},()=>Array(C).fill('')),
          knobs:Array.from({length:st.knobs},()=>({ccw:'',press:'',cw:''})),
          bnotes:Array.from({length:R},()=>Array(C).fill('')),             // per-key comments, same shape as buttons / knobs
          knotes:Array.from({length:st.knobs},()=>({ccw:'',press:'',cw:''}))};
}
// Per-key comments live in a block of "#@" lines at the top of the file, one per key, which the tool ignores:
//   #@ L1 R2 C3: text          button: layer, row, column (1-based, in the file's buttons order)
//   #@ L1 K1 ccw: text         knob: layer, knob, ccw | press | cw
// The text runs to the end of the line and is taken as written, so it needs no escaping.
const NOTE_LINE = /^\s*#@\s*L(\d+)\s+(?:R(\d+)\s+C(\d+)|K(\d+)\s+(ccw|press|cw))\s*:[ \t]?(.*)$/i;
function parseNoteLine(line){
  const m=NOTE_LINE.exec(line);
  if(!m) return null;
  const text=m[6].trim();
  return m[2] ? {layer:+m[1]-1,r:+m[2]-1,c:+m[3]-1,text}
              : {layer:+m[1]-1,k:+m[4]-1,p:m[5].toLowerCase(),text};
}
function noteLines(st){
  const oneLine=s=>String(s||'').replace(/\s+/g,' ').trim();
  const out=[];
  st.layers.forEach((l,li)=>{
    (l.bnotes||[]).forEach((row,r)=>row.forEach((t,c)=>{ t=oneLine(t); if(t) out.push('#@ L'+(li+1)+' R'+(r+1)+' C'+(c+1)+': '+t); }));
    (l.knotes||[]).forEach((k,n)=>['ccw','press','cw'].forEach(p=>{ const t=oneLine(k[p]); if(t) out.push('#@ L'+(li+1)+' K'+(n+1)+' '+p+': '+t); }));
  });
  return out;
}
function clampInt(v,lo,hi,def){ v=parseInt(v,10); if(isNaN(v)) v=def; return Math.max(lo,Math.min(hi,v)); }
function normalizeState(st){
  st.rows=clampInt(st.rows,1,8,3); st.columns=clampInt(st.columns,1,8,4); st.knobs=clampInt(st.knobs,0,6,0);
  if(!ORIENTATIONS.includes(st.orientation)) st.orientation='normal';
  st.layers=(st.layers||[]).slice(0,LAYER_COUNT);
  while(st.layers.length<LAYER_COUNT) st.layers.push(blankLayer(st));
  const {R,C}=dimsOf(st);
  st.layers.forEach(l=>{
    const b=[];
    for(let r=0;r<R;r++){ b.push([]); for(let c=0;c<C;c++) b[r].push(String((l.buttons&&l.buttons[r]&&l.buttons[r][c])??'')); }
    l.buttons=b;
    const k=[];
    for(let n=0;n<st.knobs;n++){ const o=(l.knobs&&l.knobs[n])||{}; k.push({ccw:String(o.ccw??''),press:String(o.press??''),cw:String(o.cw??'')}); }
    l.knobs=k;
    const bn=[];
    for(let r=0;r<R;r++){ bn.push([]); for(let c=0;c<C;c++) bn[r].push(String((l.bnotes&&l.bnotes[r]&&l.bnotes[r][c])??'')); }
    l.bnotes=bn;
    const kn=[];
    for(let n=0;n<st.knobs;n++){ const o=(l.knotes&&l.knotes[n])||{}; kn.push({ccw:String(o.ccw??''),press:String(o.press??''),cw:String(o.cw??'')}); }
    l.knotes=kn;
  });
  return st;
}
function fromObj(o){
  if(!o||typeof o!=='object'||Array.isArray(o)) throw new Error('Top level must be a mapping');
  const st={model:String(o.model||'ch57x-2'),orientation:o.orientation||'normal',
    rows:o.rows,columns:o.columns,knobs:o.knobs==null?0:o.knobs,layers:[]};
  if(!Array.isArray(o.layers)||!o.layers.length) throw new Error('No "layers" found');
  o.layers.forEach(l=>{
    st.layers.push({buttons:(l&&l.buttons||[]).map(r=>Array.isArray(r)?r:[r]), knobs:(l&&l.knobs||[]).map(k=>k||{})});
  });
  normalizeState(st);
  // "#@" comment lines collected by parseYaml; ones that name no key on this pad are counted, not applied.
  // A later line for the same key wins.
  let unmatched=0;
  (o.__keyNotes||[]).forEach(n=>{
    const l=n&&st.layers[n.layer];
    if(!n||!l||n.layer<0) unmatched++;
    else if(n.p){ if(l.knotes[n.k]) l.knotes[n.k][n.p]=n.text; else unmatched++; }
    else if(l.bnotes[n.r]&&n.c>=0&&n.c<l.bnotes[n.r].length) l.bnotes[n.r][n.c]=n.text;
    else unmatched++;
  });
  Object.defineProperty(st,'unmatchedNotes',{value:unmatched,configurable:true});   // not saved with the mapping
  return st;
}
function toYaml(st){
  const q=s=>JSON.stringify(String(s));
  const out=['# Generated by CH57x Keyboard Web Configurator'];
  const notes=noteLines(st);
  if(notes.length) out.push('# Key comments (the tool ignores them): "#@ L<layer> R<row> C<column>: text" for a button,',
    '# "#@ L<layer> K<knob> ccw|press|cw: text" for a knob.', ...notes);
  out.push('model: '+st.model,'orientation: '+st.orientation,
    'rows: '+st.rows,'columns: '+st.columns,'knobs: '+st.knobs,'layers:');
  st.layers.forEach((l,li)=>{
    if(li) out.push('');
    out.push('  - buttons:');
    l.buttons.forEach(r=>out.push('      - ['+r.map(q).join(', ')+']'));
    if(!l.knobs.length) out.push('    knobs: []');
    else{
      out.push('    knobs:');
      l.knobs.forEach(k=>out.push('      - ccw: '+q(k.ccw),'        press: '+q(k.press),'        cw: '+q(k.cw)));
    }
  });
  return out.join('\n')+'\n';
}

// ---------- Direct upload via WebHID ----------
// Packet formats ported from github.com/PollRobots/ch57x-programmer (MIT), itself derived from kriomant/ch57x-keyboard-tool.
const WELL_KNOWN = [
  "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "1","2","3","4","5","6","7","8","9","0","Enter","Escape","Backspace","Tab","Space",
  "Minus","Equal","LeftBracket","RightBracket","Backslash","NonUSHash","Semicolon","Quote","Grave","Comma","Dot","Slash",
  "CapsLock","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
  "PrintScreen","ScrollLock","Pause","Insert","Home","PageUp","Delete","End","PageDown","Right","Left","Down","Up",
  "NumLock","NumPadSlash","NumPadAsterisk","NumPadMinus","NumPadPlus","NumPadEnter",
  "NumPad1","NumPad2","NumPad3","NumPad4","NumPad5","NumPad6","NumPad7","NumPad8","NumPad9","NumPad0","NumPadDot",
  "NonUSBackslash","Application","Power","NumPadEqual",
  "F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24"];
const HID_MODS = ['Ctrl','Shift','Alt','Meta','RightCtrl','RightShift','RightAlt','RightMeta'];
const KB_MOD_NAME = {ctrl:'Ctrl',shift:'Shift',alt:'Alt',opt:'Alt',win:'Meta',cmd:'Meta',
  rctrl:'RightCtrl',rshift:'RightShift',ralt:'RightAlt',ropt:'RightAlt',rwin:'RightMeta',rcmd:'RightMeta'};
// Names exactly as the original tool accepts them: the lowercase code names (so "escape" and "delete", not "esc"/"del"),
// plus its two Mac aliases.
const WK_BY_NAME = (()=>{ const m={}; WELL_KNOWN.forEach(n=>{ m[n.toLowerCase()]=n; }); m.macbrightnessdown='ScrollLock'; m.macbrightnessup='Pause'; return m; })();
Object.keys(WK_BY_NAME).forEach(k=>KNOWN_KEYS.add(k));
const MEDIA_VALUES = {BrightnessUp:0x6f,BrightnessDown:0x70,Next:0xb5,Previous:0xb6,Stop:0xb7,Play:0xcd,Mute:0xe2,
  VolumeUp:0xe9,VolumeDown:0xea,Favorites:0x182,Calculator:0x192,Screenlock:0x19e,
  WebPageHome:0x223,WebPageBack:0x224,WebPageForward:0x225};
const MEDIA_BY_NAME = {screenbrightnessup:'BrightnessUp',screenbrightnessdown:'BrightnessDown',next:'Next',previous:'Previous',
  prev:'Previous',stop:'Stop',play:'Play',mute:'Mute',volumeup:'VolumeUp',volumedown:'VolumeDown',favorites:'Favorites',
  calculator:'Calculator',screenlock:'Screenlock',webpagehome:'WebPageHome',webpageback:'WebPageBack',webpageforward:'WebPageForward'};
const ENC_ACTION = {ccw:0,press:1,cw:2};
const MOUSE_BTN = {Left:1,Right:2,Middle:4};
const MOUSE_MOD = {Ctrl:1,Shift:2,Alt:4};   // Alt is 0x04 in the original tool (ch57x-programmer uses 3); verified against its output
const MACRO_KIND = {Keyboard:1,Media:2,Mouse:3};
const modsValue = mods => mods.reduce((a,m)=>a|(1<<HID_MODS.indexOf(m)),0);
const codeVal = c => c===undefined ? 0 : typeof c==='number' ? c : WELL_KNOWN.indexOf(c)+4;
const btnVal = bs => bs.reduce((a,b)=>a|MOUSE_BTN[b],0);
function s2u(v){ if(v<=-128) return 128; if(v>=127) return 127; if(v>0) return v; return 256+v; }
const capBtns = s => [...new Set(s.split('+').map(b=>b.trim()).map(b=>b[0].toUpperCase()+b.slice(1)))];

function mouseDetail(tok){
  let m;
  if(/^(click|rclick|mclick)(\+(click|rclick|mclick))*$/.test(tok)){
    const al={click:'Left',rclick:'Right',mclick:'Middle'};
    return {type:'Click',buttons:[...new Set(tok.split('+').map(x=>al[x]))]};
  }
  if((m=tok.match(new RegExp('^click\\(\\s*('+BTN+')\\s*\\)$')))) return {type:'Click',buttons:capBtns(m[1])};
  if((m=tok.match(new RegExp('^move\\(\\s*('+NUM+')\\s*,\\s*('+NUM+')\\s*\\)$')))) return {type:'Move',x:+m[1],y:+m[2]};
  if((m=tok.match(new RegExp('^drag\\(\\s*('+BTN+')\\s*,\\s*('+NUM+')\\s*,\\s*('+NUM+')\\s*\\)$')))) return {type:'Drag',buttons:capBtns(m[1]),x:+m[2],y:+m[3]};
  if((m=tok.match(new RegExp('^wheel\\(\\s*('+NUM+')\\s*\\)$')))) return {type:'Wheel',delta:+m[1]};
  if(tok==='wheelup') return {type:'Wheel',delta:1};
  if(tok==='wheeldown') return {type:'Wheel',delta:-1};
  return null;
}
// One chord -> {kind:'key',chord} | {kind:'mouse',macro} | {kind:'media',macro}
function parseChord(c){
  const toks=splitDash(c); const key=toks.pop(); const mods=toks;
  const md=mouseDetail(key);
  if(md){
    if(mods.length>1) throw new Error('mouse actions support one modifier ('+c+')');
    let modifier;
    if(mods.length){ if(!MODS_MOUSE[mods[0]]) throw new Error('mouse modifier must be ctrl, shift or alt ('+c+')'); modifier=KB_MOD_NAME[mods[0]]; }
    for(const v of [md.x,md.y,md.delta]) if(v!==undefined && (v<-127||v>127)) throw new Error('value out of range -127..127 ('+c+')');
    return {kind:'mouse',macro:{type:'Mouse',action:md,modifier}};
  }
  if(MEDIA_BY_NAME[key]){
    if(mods.length) throw new Error('media keys cannot take modifiers ('+c+')');
    return {kind:'media',macro:{type:'Media',mediaCode:MEDIA_BY_NAME[key]}};
  }
  const modNames=[];
  for(const m of mods){ if(!KB_MOD_NAME[m]) throw new Error('unknown modifier "'+m+'"'); modNames.push(KB_MOD_NAME[m]); }
  if(KB_MOD_NAME[key]) return {kind:'key',chord:{modifiers:[...modNames,KB_MOD_NAME[key]]}};   // modifier-only chord
  if(/^<\d+>$/.test(key)){ const n=parseInt(key.slice(1,-1),10); if(n>255) throw new Error('HID code above 255'); return {kind:'key',chord:{modifiers:modNames,code:n}}; }
  const wk=WK_BY_NAME[key.toLowerCase()];
  if(!wk) throw new Error('unknown key "'+key+'" (use <hid code> for keys without a known name)');
  return {kind:'key',chord:{modifiers:modNames,code:wk}};
}
// -> null for empty action, else Macro in the shape used by ch57x-programmer
function parseActionToMacro(raw){
  let s=String(raw==null?'':raw).trim(); if(!s) return null;
  let delay=0; const om=s.match(/^\{\s*delay\(\s*(\d+)\s*\)\s*\}(.*)$/);
  if(om){ delay=parseInt(om[1],10); s=om[2].trim(); }
  else if(/^\{/.test(s)) throw new Error('only the {delay(<ms>)} option is supported');
  const chords=splitTop(s,',').map(x=>x.trim());
  if(chords.some(c=>!c)) throw new Error('empty chord');
  const parsed=chords.map(parseChord);
  const nonKey=parsed.find(p=>p.kind!=='key');
  if(nonKey){
    if(parsed.length>1) throw new Error('mouse/media actions cannot be combined in a sequence');
    return nonKey.macro;
  }
  return {type:'Keyboard',options:{delay},keyChords:parsed.map(p=>p.chord)};
}

function keyIdFor(family,key){
  const maxButtons = (family==='884x'||family==='884x-514c') ? 15 : family==='8850' ? 16 : 12;
  if(typeof key==='number'){
    if(key>=maxButtons) throw new Error('button index '+key+' is out of range for this keyboard family');
    return key+1;
  }
  const [enc,act]=key;
  if(family==='884x-514c'){
    // 12-key/4-knob pad (Key::to_key_id in the fork): knobs 1-3 follow the buttons as usual, the 4th knob uses ids 13-15.
    if(enc>=4) throw new Error('this protocol supports at most 4 knobs');
    if(enc===3) return 13+ENC_ACTION[act];
  } else if(family!=='8850' && enc>=3) throw new Error('this protocol supports at most 3 knobs');
  return maxButtons+1+3*enc+ENC_ACTION[act];
}
function bind884x(layer,kid,macro){
  if(layer>=16) throw new Error('invalid layer index '+layer);
  const m=[0xfe,kid,layer+1,MACRO_KIND[macro.type],0,0,0,0,0];
  if(macro.type==='Keyboard'){
    const p=macro.keyChords;
    if(p.length>18) throw new Error('macro sequence too long ('+p.length+', max 18)');
    if(p.length===1 && p[0].code===undefined) m.push(0); else m.push(p.length);
    for(const c of p) m.push(modsValue(c.modifiers),codeVal(c.code));
  } else if(macro.type==='Media'){
    const v=MEDIA_VALUES[macro.mediaCode]; m.push(0,v&0xff,(v>>8)&0xff,0,0,0,0);
  } else {
    const a=macro.action, mv=MOUSE_MOD[macro.modifier]||0;
    if(a.type==='Move') m.push(0x05,mv,0,s2u(a.x),s2u(a.y));
    else if(a.type==='Drag') m.push(0x05,mv,btnVal(a.buttons),s2u(a.x),s2u(a.y));
    else if(a.type==='Click') m.push(0x01,mv,btnVal(a.buttons));
    else m.push(0x03,mv,0,0,0,s2u(a.delta));
  }
  const out=[m];
  if(macro.type==='Keyboard' && macro.options.delay>0){
    const d=macro.options.delay; if(d>6000) throw new Error('maximum supported delay is 6000 ms');
    out.push([0xfe,kid,layer+1,5,d&0xff,(d>>8)&0xff]);
  }
  out.push([0xaa,0xaa,0,0,0,0,0,0],[0xfd,0xfe,0xff],[0xaa,0xaa,0,0,0,0,0,0]);
  return out;
}
function bind8890(layer,kid,macro){
  if(layer>=16) throw new Error('invalid layer index '+layer);
  const out=[[0xfe,layer+1,1,1]];
  const head=((layer+1)<<4)|MACRO_KIND[macro.type];
  if(macro.type==='Keyboard'){
    if(macro.options.delay!==0) throw new Error('delay is not supported by this keyboard model');
    if(macro.keyChords.length>6) throw new Error('macro sequence too long ('+macro.keyChords.length+', max 6)');
    const items=[[0,0],...macro.keyChords.map(c=>[modsValue(c.modifiers),codeVal(c.code)])];
    items.forEach(([mo,co],i)=>out.push([kid,head,macro.keyChords.length,i,mo,co]));
  } else if(macro.type==='Mouse'){
    const a=macro.action;
    out.push([kid,head,a.buttons?btnVal(a.buttons):0,a.x!==undefined?s2u(a.x):0,a.y!==undefined?s2u(a.y):0,
      a.delta!==undefined?s2u(a.delta):0,MOUSE_MOD[macro.modifier]||0]);
  } else {
    const v=MEDIA_VALUES[macro.mediaCode]; out.push([kid,head,v&0xff,(v>>8)&0xff]);
  }
  out.push([0xaa,0xaa]);
  return out;
}
// ch57x-3 (514c:8850). Ported from kriomant/ch57x-keyboard-tool src/keyboard/k8850_4x4.rs; the leading 0x03 of its
// messages is the HID report ID, which WebHID's sendReport adds itself, so it is not part of the data here.
const MOD_CODE_8850 = {Ctrl:0xf1,Shift:0xf2,Alt:0xf3,Meta:0xf4,RightCtrl:0xf5,RightShift:0xf6,RightAlt:0xf7,RightMeta:0xf8};
function bind8850(layer,kid,macro){
  if(layer>15) throw new Error('invalid layer index '+layer);
  const m=[0xfd,kid,layer+1,MACRO_KIND[macro.type]];
  if(macro.type==='Keyboard'){
    const seq=[];
    for(const c of macro.keyChords){
      const mods=HID_MODS.filter(x=>c.modifiers.includes(x));   // fixed order, duplicates collapsed
      mods.forEach(x=>seq.push([0,0,MOD_CODE_8850[x]]));
      seq.push([0,0,codeVal(c.code)]);
    }
    if(seq.length>18) throw new Error('macro sequence is too long');
    m.push(0,seq.length); seq.forEach(e=>m.push(...e));
  } else if(macro.type==='Media'){
    const v=MEDIA_VALUES[macro.mediaCode]; m.push(0,2,0,0,v&0xff,0,0,(v>>8)&0xff);
  } else {
    const a=macro.action, d=new Array(17).fill(0); d[0]=1; d[1]=4;
    d[4]=macro.modifier ? MOD_CODE_8850[macro.modifier] : 0;
    if(a.type==='Move'){ d[10]=s2u(a.x); d[13]=s2u(a.y); }
    else if(a.type==='Drag') throw new Error('Mouse Drag action is not supported by this keyboard');
    else if(a.type==='Click') d[7]=btnVal(a.buttons);
    else d[16]=s2u(a.delta);
    m.push(...d);
  }
  return [m,[0xfd,0xfe,0xff]];
}
// 12-key/4-knob pad, 514c:8850 (family '884x-514c'). Ported from the fork daifukusensei/ch57x-keyboard-tool-enhanced,
// src/keyboard/k884x.rs (Keyboard884x::bind_key), which differs from the upstream 884x writer above:
//  - the header always holds the chord count (upstream writes 0 for a single modifier-only chord);
//  - every mouse action is sent as [5, modifier, button, x, y, wheel] (upstream uses 1/3/5 as the first byte);
//  - a click carries no modifier, wheel moves one step only, and there is no drag;
//  - the delay packet is a full copy of the macro packet with kind=5 and the delay in bytes 4-5.
// The leading 0x03 of its messages is the HID report ID, which WebHID's sendReport adds itself, so it is not part of the data here.
function bind884xFork(layer,kid,macro){
  if(layer>15) throw new Error('invalid layer index '+layer);
  const m=[0xfe,kid,layer+1,MACRO_KIND[macro.type],0,0,0,0,0];
  const delay = macro.type==='Keyboard' ? macro.options.delay : 0;
  if(macro.type==='Keyboard'){
    const p=macro.keyChords;
    if(p.length+(delay>0?1:0)>18) throw new Error('macro sequence too long (max 18 entries, a delay counts as one)');
    m.push(p.length);
    for(const c of p) m.push(modsValue(c.modifiers),codeVal(c.code));
  } else if(macro.type==='Media'){
    const v=MEDIA_VALUES[macro.mediaCode]; m.push(0,v&0xff,(v>>8)&0xff,0,0,0,0);
  } else {
    const a=macro.action, mv=MOUSE_MOD[macro.modifier]||0;
    m.push(5);
    if(a.type==='Click') m.push(0,btnVal(a.buttons),0,0,0);
    else if(a.type==='Move') m.push(mv,0,a.x&0xff,a.y&0xff,0);
    else if(a.type==='Wheel'){
      if(a.delta!==1 && a.delta!==-1) throw new Error('this keyboard supports wheel up/down by one step only (wheelup, wheeldown)');
      m.push(mv,0,0,0,a.delta>0?1:255);
    }
    else throw new Error('Mouse Drag action is not supported by this keyboard');
  }
  const out=[m];
  if(delay>0){
    if(delay>6000) throw new Error('maximum supported delay is 6000 ms');
    const d=m.slice(); d[3]=5; d[4]=delay&0xff; d[5]=(delay>>8)&0xff;
    out.push(d);
  }
  out.push([0xaa,0xaa,0,0,0,0,0,0],[0xfd,0xfe,0xff],[0xaa,0xaa,0,0,0,0,0,0]);
  return out;
}
function bindPackets(family,layer,key,macro){
  const kid=keyIdFor(family,key);
  return family==='884x' ? bind884x(layer,kid,macro) : family==='884x-514c' ? bind884xFork(layer,kid,macro)
    : family==='8850' ? bind8850(layer,kid,macro) : bind8890(layer,kid,macro);
}
// Things the keyboard will do differently from what the YAML says, without being an error.
function familyWarnings(family,macro){
  const w=[];
  if(family==='884x-514c' && macro.type==='Mouse' && macro.action.type==='Click' && macro.modifier)
    w.push('this keyboard ignores the "'+macro.modifier.toLowerCase()+'" modifier on a click and sends a plain click');
  // The 4x4 protocol (upstream k8850_4x4) has no delay field, so the delay is dropped. The pad itself may support
  // delays (via its vendor software), but how they are encoded is unknown, so nothing better can be sent yet.
  if(family==='8850' && macro.type==='Keyboard' && macro.options.delay>0)
    w.push('the delay option is ignored on this keyboard (4×4 pad); the keys are sent without the pause');
  return w;
}
// Devices WebHID upload knows about. `model` is the value of the YAML `model:` key in the original tool.
const DEVICES=[
  {vid:0x1189,pid:0x8840,family:'884x',model:'ch57x-1'},
  {vid:0x1189,pid:0x8842,family:'884x',model:'ch57x-1'},
  {vid:0x1189,pid:0x8890,family:'8890',model:'ch57x-2'},
  {vid:0x514c,pid:0x8850,family:'8850',model:'ch57x-3'}];
const deviceInfo=(vid,pid)=>DEVICES.find(d=>d.vid===vid&&d.pid===pid)||null;
function familyFromProductId(pid,vid=0x1189){ const d=deviceInfo(vid,pid); return d?d.family:null; }
// 514c:8850 is shared by two different keyboards: the 4x4 pad (ch57x-3, 16 keys, upstream k8850_4x4 protocol) and the
// 12-key/4-knob pad, which speaks the modified 884x protocol above. The USB ids cannot tell them apart, so the layout does.
function resolveFamily(vid,pid,st){
  const d=deviceInfo(vid,pid); if(!d) return null;
  if(d.family==='8850' && st.rows*st.columns!==16) return '884x-514c';
  return d.family;
}
const FAMILY_LABEL={'884x':'884x','8890':'8890','8850':'4×4 pad','884x-514c':'12-key/4-knob'};
function makeReport(data){
  const b=new Uint8Array(64);
  for(let i=0;i<64&&i<data.length;i++){
    const v=data[i];
    if(v===undefined||!Number.isInteger(v)) continue;
    if(v>=0&&v<0x100) b[i]=v;
    if(v<0&&v>-127) b[i]=0x100+v;
  }
  return b;
}
// Maps a grid cell (as laid out in the YAML for the chosen orientation) to the keyboard's 0-based button index.
function buttonIndex(st,r,c){
  const R=st.rows, C=st.columns;
  switch(st.orientation){
    case 'upsidedown': return R*C-1-(r*C+c);
    case 'clockwise': return (R-1-c)*C+r;
    case 'counterclockwise': return c*C+(C-1-r);
    default: return r*C+c;
  }
}
const knobsReversed = o => o==='upsidedown'||o==='clockwise';   // as reorient_row() in the original tool
// Changing the orientation keeps every action and comment on the same physical key/knob: each grid cell moves
// to the cell with the same hardware index (buttonIndex) in the new orientation, and the knob list flips when
// knobsReversed changes. Mutates st (expects it normalized) and returns {button:(r,c)=>[r,c], knob:n=>n} for
// moving a selection along with it.
function reorient(st,to){
  const from=st.orientation, ident={button:(r,c)=>[r,c],knob:n=>n};
  if(!ORIENTATIONS.includes(to)||to===from) return ident;
  const src={rows:st.rows,columns:st.columns,orientation:from}, dst={...src,orientation:to};   // st.orientation changes below
  const {R,C}=dimsOf(src), {R:R2,C:C2}=dimsOf(dst);
  const pos=[];
  for(let r=0;r<R2;r++) for(let c=0;c<C2;c++) pos[buttonIndex(dst,r,c)]=[r,c];
  const flip=knobsReversed(from)!==knobsReversed(to), K=st.knobs;
  const map={button:(r,c)=>pos[buttonIndex(src,r,c)], knob:n=>flip?K-1-n:n};
  const move=g=>{
    const out=Array.from({length:R2},()=>Array(C2).fill(''));
    for(let r=0;r<R;r++) for(let c=0;c<C;c++){ const [r2,c2]=map.button(r,c); out[r2][c2]=g[r][c]; }
    return out;
  };
  st.layers.forEach(l=>{
    l.buttons=move(l.buttons); l.bnotes=move(l.bnotes);
    if(flip){ l.knobs=l.knobs.slice().reverse(); l.knotes=l.knotes.slice().reverse(); }
  });
  st.orientation=to;
  return map;
}
// which: 'all' or a 0-based layer index
function planUpload(st,family,which){
  const plan={packets:[],items:0,skipped:0,errors:[],warnings:[]};
  const layers = which==='all' ? st.layers.map((l,i)=>[l,i]) : [[st.layers[which],which]];
  const reverseKnobs = knobsReversed(st.orientation);
  for(const [l,li] of layers){
    const add=(label,val,key)=>{
      try{
        const macro=parseActionToMacro(val);
        if(!macro){ plan.skipped++; return; }
        if(typeof key==='number' && isOneRowOneKnob(st) && oneRowViolation(val)) throw new Error(ONE_ROW_MSG);
        const pk=bindPackets(family,li,key,macro);
        familyWarnings(family,macro).forEach(w=>plan.warnings.push('Layer '+(li+1)+' '+label+': '+w));
        pk.forEach((bytes,i)=>plan.packets.push({desc:i===0?('Layer '+(li+1)+' '+label+' <- '+val):'',bytes}));
        plan.items++;
      }catch(e){ plan.errors.push('Layer '+(li+1)+' '+label+': '+e.message); }
    };
    l.buttons.forEach((row,r)=>row.forEach((v,c)=>add('R'+(r+1)+' C'+(c+1),v,buttonIndex(st,r,c))));
    const n=l.knobs.length;
    l.knobs.forEach((k,i)=>['ccw','press','cw'].forEach(p=>add('knob '+(i+1)+' '+p,k[p],[reverseKnobs?n-1-i:i,p])));
  }
  return plan;
}

const EXAMPLE = `model: ch57x-2
orientation: normal
rows: 3
columns: 4
knobs: 2
layers:
  - buttons:
      - ["a", "ctrl-a", "alt-shift", "alt-ctrl,ctrl-b"]
      - ["e", "f", "g", "h"]
      - ["<100>", "j", "k", "l"]
    knobs:
      - ccw: "wheelup"
        press: "click"
        cw: "wheeldown"
      - ccw: "shift-wheelup"
        press: "shift-click"
        cw: "shift-wheeldown"
  - buttons:
      - ["click", "click(middle)", "click+rclick", "ctrl-mclick"]
      - ["move(0,10)", "alt-drag(right,10,0)", "ctrl-move(5,5)", "ctrl-wheelup"]
      - ["alt-wheel(1)", "ctrl-click", "wheelup", "wheelup"]
    knobs:
      - ccw: "left"
        press: "enter"
        cw: "right"
      - ccw: "ctrl-left"
        press: "ctrl-enter"
        cw: "ctrl-right"
  - buttons:
      - ["play", "prev", "next", "mute"]
      - ["2", "3", "4", "5"]
      - ["6", "7", "8", "9"]
    knobs:
      - ccw: "volumedown"
        press: "mute"
        cw: "volumeup"
      - ccw: "d"
        press: "e"
        cw: "f"
`;
