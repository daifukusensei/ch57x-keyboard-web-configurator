const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../../ch57x-config-editor.html'),'utf8');
const core=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const api=new Function(core+';return {parseActionToMacro,bindPackets,makeReport,planUpload,buttonIndex,fromObj,parseYaml,normalizeState};')();
const KEYS={b0:0,b5:5,b11:11,b15:15,k0ccw:[0,'ccw'],k0press:[0,'press'],k1cw:[1,'cw'],k2press:[2,'press']};
const lines=fs.readFileSync(require('path').join(__dirname,'../orig/oracle.txt'),'utf8').split('\n').filter(Boolean).map(l=>l.split('|'));
const stats={}, diffs=[];
for(const [_,drv,action,layer,key,status,...rest] of lines){
  if(drv==='parse'){ let threw=false; try{ api.parseActionToMacro(action);}catch(e){threw=true;} stats.parse=stats.parse||{ok:0,bad:0}; (threw?stats.parse.ok++:stats.parse.bad++); if(!threw) diffs.push(['parse-accepts-what-rust-rejects',action]); continue; }
  const s=stats[drv]=stats[drv]||{ok:0,bad:0};
  let mine,err;
  try{ const macro=api.parseActionToMacro(action); mine=api.bindPackets(drv,+layer,KEYS[key],macro).map(p=>{
      const b=Array.from(api.makeReport(p)); while(b.length&&b[b.length-1]===0)b.pop(); return b.map(x=>x.toString(16).padStart(2,'0')).join(' '); }).join(' ; ');
  }catch(e){ err=e.message; }
  if(status==='ERR'){ if(err){s.ok++;} else {s.bad++; diffs.push([drv,action,layer,key,'rust ERR ('+rest.join('|')+') but mine OK']);} continue; }
  const rust=rest[0].split(' ; ').map(ch=>ch.split(' ').slice(1).join(' ')).join(' ; ');   // drop leading report-id byte 03
  if(err && /out of range -127\.\.127/.test(err) && /-128/.test(action)){ s.ok++; (global.__dev=global.__dev||new Set()).add(action); }   // intentional: editor limits movement to -127..127
  else if(err){ s.bad++; diffs.push([drv,action,layer,key,'mine ERR ('+err+') but rust OK']); }
  else if(mine===rust) s.ok++; else { s.bad++; diffs.push([drv,action,layer,key,'\n   mine: '+mine+'\n   rust: '+rust]); }
}
console.log(JSON.stringify(stats));
const byKind={}; diffs.forEach(d=>{const k=d[0]+'|'+d[1]; byKind[k]=(byKind[k]||0)+1;});
console.log('distinct differing (driver|action):',Object.keys(byKind).length);
const seen=new Set(); diffs.forEach(d=>{const k=d[0]+"|"+d[1]; if(!seen.has(k)){seen.add(k); console.log(d.join(" ").slice(0,260));}});

// orientation: independent port of reorient_grid / reorient_row from the original config.rs
function reorientGrid(o,rows,cols,data){
  const tr={normal:(r,c)=>[r,c],upsidedown:(r,c)=>[rows-r-1,cols-c-1],clockwise:(r,c)=>[c,rows-r-1],counterclockwise:(r,c)=>[cols-c-1,r]}[o];
  return Array.from({length:rows*cols},(_,i)=>{const [r,c]=tr(Math.floor(i/cols),i%cols); return data[r][c];});
}
const reorientRow=(o,d)=> (o==='upsidedown'||o==='clockwise') ? [...d].reverse() : [...d];
let ob=0;
for(const o of ['normal','upsidedown','clockwise','counterclockwise']) for(const [rows,cols,knobs] of [[3,4,2],[4,4,3],[1,3,1],[2,6,4]]){
  const vert=o==='clockwise'||o==='counterclockwise', R=vert?cols:rows, C=vert?rows:cols;
  const grid=Array.from({length:R},(_,r)=>Array.from({length:C},(_,c)=>'k'+r+'_'+c));
  const knobv=Array.from({length:knobs},(_,i)=>'n'+i);
  const want=reorientGrid(o,rows,cols,grid), wantK=reorientRow(o,knobv);
  const st={model:'x',orientation:o,rows,columns:cols,knobs,layers:[{buttons:grid,knobs:knobv.map(v=>({ccw:v+'c',press:v+'p',cw:v+'w'}))}]};
  // plan with fake actions: use letters so every cell parses; map cell text -> action via lookup
  const lab={}; let n=0; const act=()=>'f'+(1+(n++%24));
  const g2=grid.map(r=>r.map(v=>{const a=act(); lab[a+'#'+v]=v; return a;}));
  // simpler: validate buttonIndex directly
  for(let r=0;r<R;r++)for(let c=0;c<C;c++){ const idx=api.buttonIndex(st,r,c); if(want[idx]!==grid[r][c]){ob++; console.log('ORIENT button mismatch',o,rows,cols,r,c);} }
}
// knobs: planUpload physical knob index for user knob i
for(const o of ['normal','upsidedown','clockwise','counterclockwise']){
  const knobs=3, st=api.normalizeState({model:'x',orientation:o,rows:3,columns:4,knobs,layers:[]});
  st.layers[0].knobs.forEach((k,i)=>{k.press='f'+(i+1);});
  const plan=api.planUpload(st,'884x',0);
  const wantK=reorientRow(o,[0,1,2]);   // physical j holds user knob wantK[j]
  for(const p of plan.packets){ if(!p.desc) continue; const m=p.desc.match(/knob (\d+) press <- f(\d+)/); if(!m) continue;
    const userKnob=+m[1]-1; const kid=p.bytes[1]; const physical=Math.floor((kid-16)/3);
    if(wantK[physical]!==userKnob){ob++; console.log('ORIENT knob mismatch',o,'user',userKnob,'went to physical',physical);} }
}
console.log('orientation mismatches:',ob);
if(global.__dev) console.log('intentional -128 rejections:',[...global.__dev].join(' , '));
process.exit((diffs.length||ob)?1:0);
