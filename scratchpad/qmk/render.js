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
  return h('button',{type:'button',class:cls.join(' '),title:label+': '+(val||'(empty)'),'aria-pressed':String(on),
    onclick:()=>select(t)},
    h('span',{class:'lbl',text:label}), h('span',{class:'val'+(val?'':' empty'),text:val||'—'}));
}
function renderDevice(){
  const dev=$('device'); dev.className='device '+state.orientation; dev.replaceChildren();
  const {R,C}=dims();
  const grid=h('div',{class:'grid'}); grid.style.gridTemplateColumns='repeat('+C+',70px)';
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
